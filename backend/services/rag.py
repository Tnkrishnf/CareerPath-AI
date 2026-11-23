"""Retrieval-Augmented Generation: TF-IDF retrieval over a curated knowledge base.

Documents come from (1) data/knowledge_base.json and (2) the careers table, so the chatbot
only ever cites facts and links that exist in the database or the curated JSON file.
"""
from __future__ import annotations

import json
import os
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base.json")


class KnowledgeBase:
    def __init__(self, extra_docs: list[dict] | None = None):
        with open(KB_PATH, encoding="utf-8") as fh:
            docs = json.load(fh)
        self.docs = docs + (extra_docs or [])
        corpus = [f"{d['title']} {d['title']} {d['topic']} {d['text']}" for d in self.docs]
        stop = {"and", "the", "for", "vs", "of", "to", "in", "a"}
        self.title_tokens = [{w for w in re.findall(r"[a-z+#.]+", d["title"].lower()) if w not in stop} for d in self.docs]
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        self.matrix = self.vectorizer.fit_transform(corpus)

    def search(self, query: str, k: int = 4, min_score: float = 0.08) -> list[dict]:
        if not query.strip():
            return []
        sims = cosine_similarity(self.vectorizer.transform([query]), self.matrix).ravel()
        # Title boost: a query that names a topic ("Python", "SQL", "Git") should retrieve that topic first.
        words = set(re.findall(r"[a-z+#.]+", query.lower().replace("?", " ")))
        for i, toks in enumerate(self.title_tokens):
            if toks:
                sims[i] += 0.4 * len(toks & words) / len(toks)
        order = sims.argsort()[::-1][:k]
        return [{**self.docs[i], "score": float(sims[i])} for i in order if sims[i] >= min_score]


def career_docs(careers: list[dict]) -> list[dict]:
    docs = []
    for c in careers:
        skills = ", ".join(f"{n} ({['', 'beginner', 'intermediate', 'advanced'][l]})" for n, l in c["skills"].items())
        stages = "; ".join(f"{s['title']}: {', '.join(s['topics'][:3])}" for s in c["learning_path"])
        docs.append({
            "id": f"career-{c['id']}", "topic": "Career opportunities", "title": c["title"],
            "text": f"{c['title']}. {c['description']} Opportunities: {c['opportunities']} Required skills: {skills}. "
                    f"Usual education fields: {', '.join(c['education_required'])}. Learning path: {stages}.",
            "links": [],
        })
    return docs


_cache: dict = {"sig": None, "kb": None}


def get_kb(careers: list[dict]) -> KnowledgeBase:
    sig = tuple(sorted((c["id"], c["title"], len(c["skills"])) for c in careers))
    if _cache["sig"] != sig:
        _cache["kb"] = KnowledgeBase(career_docs(careers))
        _cache["sig"] = sig
    return _cache["kb"]
