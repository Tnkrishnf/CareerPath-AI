"""Explainable career recommendation engine (scikit-learn + NumPy).

Final match score = weighted sum of four transparent components, each in [0, 1]:

  skills       (0.55)  weighted partial credit: for each required skill,
                       min(student_level / required_level, 1), weighted by required_level
  interests    (0.20)  TF-IDF cosine similarity between the student's interests/subjects
                       and each career's keyword profile, scaled so the best career = 1.0
  education    (0.15)  1.0 if degree/department matches the career's primary fields,
                       0.6 if it matches related fields, 0.3 for any other stated degree
  preferences  (0.10)  50% work-environment match + 50% career-goal keyword match

Nothing is random and no percentage is invented: every number can be traced back to the
inputs. The score expresses *profile similarity*, not a prediction of employment.
"""
from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

LEVEL_NAMES = {0: "Not started", 1: "Beginner", 2: "Intermediate", 3: "Advanced"}
WEIGHTS = {"skills": 0.55, "interests": 0.20, "education": 0.15, "preferences": 0.10}
DISCLAIMER = ("Match percentages describe how closely your profile resembles each career's requirements. "
              "They are guidance only and do not predict or guarantee employment.")


def career_to_dict(career) -> dict:
    return {
        "id": career.id, "title": career.title, "description": career.description,
        "opportunities": career.opportunities,
        "education_required": career.education_required or [],
        "education_related": career.education_related or [],
        "interest_keywords": career.interest_keywords or [],
        "work_environments": career.work_environments or [],
        "learning_path": career.learning_path or [],
        "skills": {cs.skill.name: cs.required_level for cs in career.skills},
    }


def _skill_score(student_skills: dict, required: dict):
    if not required:
        return 0.0, [], [], []
    total = earned = 0.0
    met, partial, missing = [], [], []
    for name, req in required.items():
        have = int(student_skills.get(name, 0))
        credit = min(have / req, 1.0)
        total += req
        earned += req * credit
        if have >= req:
            met.append(name)
        elif have > 0:
            partial.append({"skill": name, "current_level": have, "required_level": req})
        if have < req:
            missing.append({"skill": name, "current_level": have, "required_level": req, "gap": req - have})
    missing.sort(key=lambda m: (-m["gap"] * m["required_level"], m["skill"]))
    return earned / total, met, partial, missing


def _education_score(profile: dict, career: dict):
    text = f"{profile.get('degree') or ''} {profile.get('department') or ''}".lower().strip()
    if not text:
        return 0.0, "No degree or department was provided."
    if any(k in text for k in career["education_required"]):
        deg, dep = (profile.get("degree") or "").strip(), (profile.get("department") or "").strip()
        label = deg if dep.lower() in deg.lower() else f"{deg} {dep}".strip()
        return 1.0, f"Your background ({label}) is a direct fit."
    if any(k in text for k in career["education_related"]):
        return 0.6, "Your degree is in a related field; skills and projects can bridge the remaining gap."
    return 0.3, "Your degree is outside this career's usual fields; this path is possible but needs stronger evidence of skills."


def _preference_score(profile: dict, career: dict):
    env = profile.get("work_environment")
    env_match = 1.0 if env and env in career["work_environments"] else 0.0
    goal = (profile.get("career_goals") or "").lower()
    keys = {w for w in career["title"].lower().replace("/", " ").split() if len(w) > 3}
    keys |= {k.lower() for k in career["interest_keywords"]}
    hits = [k for k in keys if k in goal]
    goal_match = min(len(hits) / 2.0, 1.0)
    return 0.5 * env_match + 0.5 * goal_match, env_match == 1.0, hits


def _interest_scores(profile: dict, careers: list[dict]) -> np.ndarray:
    query = " ".join((profile.get("interests") or []) + (profile.get("favourite_subjects") or []))
    if not query.strip():
        return np.zeros(len(careers))
    docs = [" ".join(c["interest_keywords"] * 3 + [c["description"]] + list(c["skills"].keys())) for c in careers]
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vec.fit_transform(docs + [query])
    sims = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
    top = sims.max()
    return sims / top if top > 0 else sims


def recommend(profile: dict, careers: list[dict], top_n: int = 5) -> list[dict]:
    """profile: skills{name: level 1-3}, interests[], favourite_subjects[], degree, department,
    work_environment, career_goals. Returns the top_n careers with score, breakdown and explanation."""
    interest = _interest_scores(profile, careers)
    results = []
    for idx, career in enumerate(careers):
        s, met, partial, missing = _skill_score(profile.get("skills", {}), career["skills"])
        e, edu_text = _education_score(profile, career)
        p, env_ok, goal_hits = _preference_score(profile, career)
        i = float(interest[idx])
        total = WEIGHTS["skills"] * s + WEIGHTS["interests"] * i + WEIGHTS["education"] * e + WEIGHTS["preferences"] * p

        explanation = []
        n_req = len(career["skills"])
        if met:
            explanation.append(f"Skills: you already meet the required level for {len(met)} of {n_req} skills ({', '.join(met[:5])}).")
        if partial:
            names = ", ".join(f"{x['skill']} ({LEVEL_NAMES[x['current_level']]} → {LEVEL_NAMES[x['required_level']]})" for x in partial[:3])
            explanation.append(f"Partial credit for skills you can grow: {names}.")
        if not met and not partial:
            explanation.append("Skills: none of the core skills are in your profile yet, so this career would need a fresh start.")
        shared = [t for t in (profile.get("interests") or []) if t.lower() in [k.lower() for k in career["interest_keywords"]]]
        if shared:
            explanation.append(f"Interests: your interest in {', '.join(shared)} matches this career.")
        elif i >= 0.5:
            explanation.append("Interests: your selected interests and subjects are textually similar to this career's focus.")
        explanation.append("Education: " + edu_text)
        if env_ok:
            explanation.append(f"Work style: {profile.get('work_environment')} is a common environment for this role.")
        if goal_hits:
            explanation.append("Goals: your stated goals mention " + ", ".join(sorted(goal_hits)[:3]) + ".")

        results.append({
            "career": career,
            "score": round(total * 100, 1),
            "breakdown": {
                "skills": round(s * 100, 1), "interests": round(i * 100, 1),
                "education": round(e * 100, 1), "preferences": round(p * 100, 1),
                "weights": WEIGHTS,
            },
            "explanation": explanation,
            "met_skills": met,
            "missing_skills": missing,
        })
    results.sort(key=lambda r: (-r["score"], r["career"]["title"]))
    for rank, r in enumerate(results[:top_n], start=1):
        r["rank"] = rank
    return results[:top_n]


def analyze_gap(student_skills: dict, career: dict) -> dict:
    """Skill-gap analysis of a student's skills against one career."""
    comparison, existing, missing = [], [], []
    for name, req in sorted(career["skills"].items(), key=lambda kv: (-kv[1], kv[0])):
        have = int(student_skills.get(name, 0))
        row = {"skill": name, "required": req, "current": have, "required_label": LEVEL_NAMES[req],
               "current_label": LEVEL_NAMES[have], "gap": max(req - have, 0)}
        comparison.append(row)
        (existing if have >= req else missing).append(row)
    # Skills the student has that the career does not list (still useful to show)
    extra = [{"skill": n, "level": l, "level_label": LEVEL_NAMES[l]} for n, l in student_skills.items()
             if n not in career["skills"]]
    priorities = []
    for row in sorted(missing, key=lambda r: (-r["gap"] * r["required"], r["skill"])):
        priority = "High" if row["gap"] * row["required"] >= 4 or row["current"] == 0 and row["required"] == 3 else \
            ("Medium" if row["gap"] >= 1 and row["required"] >= 2 else "Low")
        if row["current"] == 0:
            tip = f"Start {row['skill']} from the basics and aim for {row['required_label']} level."
        else:
            tip = f"Move {row['skill']} from {row['current_label']} to {row['required_label']} with project practice."
        priorities.append({**row, "priority": priority, "suggestion": tip})
    required_total = sum(career["skills"].values()) or 1
    covered = sum(min(student_skills.get(n, 0), r) for n, r in career["skills"].items())
    return {
        "career": {"id": career["id"], "title": career["title"]},
        "readiness_percent": round(100 * covered / required_total, 1),
        "comparison": comparison, "existing": existing, "missing": missing, "extra_skills": extra,
        "priorities": priorities,
    }
