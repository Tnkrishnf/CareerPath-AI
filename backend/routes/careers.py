"""Careers, assessment, recommendations, skill-gap analysis and saved careers."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from extensions import db
from models import Assessment, AssessmentAnswer, Career, Recommendation, SavedCareer
from routes.profile import clean_skill_entries, replace_skills, save_profile_fields
from services import recommender
from utils import active_careers, clean_list, clean_str, current_user, err, get_json, ok, student_skill_map

bp = Blueprint("careers", __name__)


def career_public(c: Career) -> dict:
    return {"id": c.id, "title": c.title, "description": c.description, "opportunities": c.opportunities,
            "education_required": c.education_required, "work_environments": c.work_environments,
            "skills": [{"name": cs.skill.name, "required_level": cs.required_level} for cs in c.skills],
            "learning_path": [{"title": s["title"], "duration": s["duration"]} for s in (c.learning_path or [])]}


def rec_to_dict(rec: Recommendation) -> dict:
    c = rec.career
    return {"id": rec.id, "rank": rec.rank, "match_percent": float(rec.score), "breakdown": rec.breakdown,
            "explanation": rec.explanation, "missing_skills": rec.missing_skills, "career": career_public(c)}


@bp.get("/careers")
def list_careers():
    return ok({"careers": [career_public(c) for c in Career.query.filter_by(is_active=True).order_by(Career.title).all()]})


@bp.get("/careers/<int:career_id>")
def get_career(career_id):
    c = db.session.get(Career, career_id)
    if not c or not c.is_active:
        err("Career not found.", 404)
    return ok({"career": career_public(c)})


# ---------- assessment ----------
@bp.post("/assessments")
@jwt_required()
def submit_assessment():
    u = current_user()
    d = get_json(request)
    clean_str(d.get("degree"), "Degree", required=True, max_len=120)
    clean_str(d.get("education_level"), "Educational qualification", required=True, max_len=60)
    skill_map = clean_skill_entries(d.get("skills"))
    if not skill_map:
        err("Add at least one skill with a proficiency level.", 422)
    if not clean_list(d.get("interests"), "Interests"):
        err("Select at least one area of interest.", 422)

    save_profile_fields(u, d)
    replace_skills(u.id, skill_map)
    assessment = Assessment(user_id=u.id, status="completed")
    db.session.add(assessment)
    db.session.flush()
    keys = ["full_name", "education_level", "degree", "department", "skills", "interests", "favourite_subjects",
            "work_environment", "career_goals", "learning_preference"]
    for k in keys:
        if k in d:
            db.session.add(AssessmentAnswer(assessment_id=assessment.id, question_key=k, answer=d[k]))
    db.session.flush()

    profile = {**u.profile.to_dict(), "skills": {s.name: l for s, l in skill_map.items()}}
    results = recommender.recommend(profile, active_careers(), top_n=5)
    for r in results:
        db.session.add(Recommendation(
            assessment_id=assessment.id, user_id=u.id, career_id=r["career"]["id"], rank=r["rank"], score=r["score"],
            breakdown=r["breakdown"], explanation=r["explanation"], missing_skills=r["missing_skills"]))
    db.session.commit()
    return ok({"assessment_id": assessment.id, "disclaimer": recommender.DISCLAIMER,
               "recommendations": _latest_recs(u.id)}, 201)


def _latest_recs(user_id):
    last = Assessment.query.filter_by(user_id=user_id).order_by(Assessment.id.desc()).first()
    if not last:
        return []
    recs = Recommendation.query.filter_by(assessment_id=last.id).order_by(Recommendation.rank).all()
    return [rec_to_dict(r) for r in recs]


@bp.get("/assessments")
@jwt_required()
def list_assessments():
    u = current_user()
    rows = Assessment.query.filter_by(user_id=u.id).order_by(Assessment.id.desc()).all()
    out = []
    for a in rows:
        top = Recommendation.query.filter_by(assessment_id=a.id, rank=1).first()
        out.append({"id": a.id, "created_at": a.created_at.isoformat(),
                    "top_career": top.career.title if top else None, "top_score": float(top.score) if top else None})
    return ok({"assessments": out})


@bp.get("/recommendations")
@jwt_required()
def recommendations():
    u = current_user()
    return ok({"recommendations": _latest_recs(u.id), "disclaimer": recommender.DISCLAIMER})


# ---------- skill gap ----------
@bp.get("/skill-gap/<int:career_id>")
@jwt_required()
def skill_gap(career_id):
    u = current_user()
    c = db.session.get(Career, career_id)
    if not c or not c.is_active:
        err("Career not found.", 404)
    return ok(recommender.analyze_gap(student_skill_map(u.id), recommender.career_to_dict(c)))


# ---------- saved careers ----------
@bp.get("/saved-careers")
@jwt_required()
def list_saved():
    u = current_user()
    rows = SavedCareer.query.filter_by(user_id=u.id).order_by(SavedCareer.id.desc()).all()
    return ok({"saved": [{"id": r.id, "saved_at": r.created_at.isoformat(), "career": career_public(r.career)} for r in rows]})


@bp.post("/saved-careers")
@jwt_required()
def save_career():
    u = current_user()
    cid = get_json(request).get("career_id")
    if not isinstance(cid, int) or not db.session.get(Career, cid):
        err("Career not found.", 404)
    if not SavedCareer.query.filter_by(user_id=u.id, career_id=cid).first():
        db.session.add(SavedCareer(user_id=u.id, career_id=cid))
        db.session.commit()
    return ok({"message": "Career saved."}, 201)


@bp.delete("/saved-careers/<int:career_id>")
@jwt_required()
def unsave_career(career_id):
    u = current_user()
    SavedCareer.query.filter_by(user_id=u.id, career_id=career_id).delete()
    db.session.commit()
    return ok({"message": "Removed."})
