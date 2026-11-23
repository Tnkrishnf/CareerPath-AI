from flask import Blueprint
from flask_jwt_extended import jwt_required

from models import Assessment, ChatHistory, LearningRoadmap, ResumeAnalysis, SavedCareer
from routes.careers import _latest_recs
from routes.roadmap import _serialize
from services import recommender
from utils import current_user, ok, student_skill_map

bp = Blueprint("dashboard", __name__)


@bp.get("/dashboard")
@jwt_required()
def student_dashboard():
    u = current_user()
    skills = student_skill_map(u.id)
    recs = _latest_recs(u.id)
    roadmaps = [{"career": _serialize(r)["career"], "percent": _serialize(r)["percent"]}
                for r in LearningRoadmap.query.filter_by(user_id=u.id).all()]
    radar, readiness = [], None
    if recs:
        from extensions import db
        from models import Career
        career = db.session.get(Career, recs[0]["career"]["id"])
        gap = recommender.analyze_gap(skills, recommender.career_to_dict(career))
        radar = [{"skill": r["skill"], "current": r["current"], "required": r["required"]} for r in gap["comparison"]]
        readiness = {"career": career.title, "percent": gap["readiness_percent"]}
    return ok({
        "name": u.full_name,
        "has_assessment": bool(recs),
        "stats": {"assessments": Assessment.query.filter_by(user_id=u.id).count(), "skills": len(skills),
                  "saved_careers": SavedCareer.query.filter_by(user_id=u.id).count(),
                  "chat_messages": ChatHistory.query.filter_by(user_id=u.id, role="user").count(),
                  "resumes": ResumeAnalysis.query.filter_by(user_id=u.id).count()},
        "top_recommendations": [{"career_id": r["career"]["id"], "title": r["career"]["title"], "match_percent": r["match_percent"]} for r in recs],
        "readiness": readiness, "skill_radar": radar, "roadmaps": roadmaps,
        "skill_levels": [{"skill": n, "level": l} for n, l in sorted(skills.items())],
    })
