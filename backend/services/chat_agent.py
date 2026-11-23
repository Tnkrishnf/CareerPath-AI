"""Conversational career agent: RAG retrieval + profile personalisation + LLM (with offline fallback).

Safety design: links are NEVER taken from the LLM's text. They come only from retrieved
knowledge-base entries and the courses table, and are returned separately as `sources`.
"""
from __future__ import annotations

import logging

import requests

from services.rag import KnowledgeBase

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are CareerPath AI, a friendly career guidance assistant for students.
Rules:
- Answer using the CONTEXT passages and the student's PROFILE. Keep explanations clear, simple and encouraging.
- Do NOT invent course names, URLs, salary figures, eligibility rules, exam dates or job openings. If the context does not contain
  such a fact, say you don't have verified information and suggest checking the official source.
- Do not include URLs in your answer; the app shows verified resource links separately.
- Never promise jobs or outcomes. Recommendations are guidance only.
- Personalise using the profile when relevant, and end with one short follow-up question to continue the conversation.
- Stay on career, education, skills and interview topics; politely redirect otherwise."""


def profile_summary(profile: dict) -> str:
    if not profile:
        return "No profile information available."
    skills = ", ".join(f"{n} (level {l}/3)" for n, l in profile.get("skills", {}).items()) or "none listed"
    lines = [f"Name: {profile.get('name', 'Student')}",
             f"Education: {profile.get('education_level') or '-'}, {profile.get('degree') or '-'} {profile.get('department') or ''}",
             f"Skills: {skills}",
             f"Interests: {', '.join(profile.get('interests') or []) or '-'}",
             f"Career goals: {profile.get('career_goals') or '-'}",
             f"Learning preference: {profile.get('learning_preference') or '-'}"]
    if profile.get("top_careers"):
        lines.append("Top recommended careers: " + ", ".join(profile["top_careers"]))
    return "\n".join(lines)


def _collect_links(passages: list[dict], extra_courses: list[dict]) -> list[dict]:
    seen, out = set(), []
    for p in passages:
        for link in p.get("links", []):
            if link["url"] not in seen:
                seen.add(link["url"])
                out.append({"title": link["title"], "url": link["url"]})
    for c in extra_courses:
        if c["url"] not in seen:
            seen.add(c["url"])
            out.append({"title": c["title"], "url": c["url"]})
    return out[:5]


def _offline_answer(message: str, passages: list[dict], profile: dict) -> str:
    name = (profile or {}).get("name", "there").split(" ")[0]
    if not passages:
        return (f"Hi {name}, I don't have verified information about that in my knowledge base. "
                "I can help with careers, programming languages, skills, certifications, higher education, interview "
                "preparation and learning roadmaps. Which of these would you like to explore?")
    best = passages[0]
    text = f"Here is what I can tell you about **{best['title']}**:\n\n{best['text']}"
    if len(passages) > 1:
        text += "\n\nRelated topics you may also want to read about: " + ", ".join(p["title"] for p in passages[1:3]) + "."
    if (profile or {}).get("top_careers"):
        text += f"\n\nBased on your assessment, your top matches are {', '.join(profile['top_careers'][:3])}."
    text += "\n\n_(Offline mode: answers come directly from the curated knowledge base. Add an LLM API key for conversational answers.)_"
    text += "\n\nWould you like a learning roadmap or a skill-gap analysis for one of these careers?"
    return text


def _call_anthropic(cfg, system: str, messages: list[dict]) -> str:
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": cfg["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": cfg["LLM_MODEL"], "max_tokens": 700, "system": system, "messages": messages}, timeout=40)
    resp.raise_for_status()
    return "".join(b.get("text", "") for b in resp.json().get("content", [])).strip()


def _call_openai(cfg, system: str, messages: list[dict]) -> str:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {cfg['OPENAI_API_KEY']}", "content-type": "application/json"},
        json={"model": cfg["LLM_MODEL"], "max_tokens": 700,
              "messages": [{"role": "system", "content": system}] + messages}, timeout=40)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def answer(message: str, history: list[dict], profile: dict, kb: KnowledgeBase, courses: list[dict], cfg) -> dict:
    """history: previous [{role, content}] turns (oldest first). Returns {reply, sources, mode}."""
    # Retrieval query includes the last user turn so that follow-ups ("what about its roadmap?") keep context.
    last_user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    passages = kb.search(f"{last_user} {message}" if len(message.split()) < 6 else message, k=4)
    matched_courses = _match_courses(message + " " + last_user, courses)
    sources = _collect_links(passages, matched_courses)

    provider = cfg["LLM_PROVIDER"]
    key_ok = (provider == "anthropic" and cfg["ANTHROPIC_API_KEY"]) or (provider == "openai" and cfg["OPENAI_API_KEY"])
    if not key_ok:
        return {"reply": _offline_answer(message, passages, profile), "sources": sources, "mode": "offline"}

    context = "\n\n".join(f"[{i + 1}] {p['title']}: {p['text']}" for i, p in enumerate(passages)) or "(no relevant passages found)"
    system = f"{SYSTEM_PROMPT}\n\nPROFILE:\n{profile_summary(profile)}\n\nCONTEXT:\n{context}"
    msgs = history[-10:] + [{"role": "user", "content": message}]
    try:
        reply = _call_anthropic(cfg, system, msgs) if provider == "anthropic" else _call_openai(cfg, system, msgs)
        return {"reply": reply, "sources": sources, "mode": provider}
    except Exception as exc:  # network error, bad key, rate limit...
        log.warning("LLM call failed: %s", exc)
        fallback = _offline_answer(message, passages, profile)
        return {"reply": fallback + "\n\n_(The AI service was unavailable, so this answer is from the knowledge base.)_",
                "sources": sources, "mode": "offline"}


def _match_courses(text: str, courses: list[dict]) -> list[dict]:
    t = text.lower()
    scored = []
    for c in courses:
        hits = sum(1 for s in c["skills"] if s.lower() in t)
        if hits:
            scored.append((hits, c))
    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:3]]
