from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from extensions import db
from models import Career, Course
from services import recommender
from utils import current_user, err, ok, student_skill_map

bp = Blueprint("courses", __name__)


@bp.get("/courses")
@jwt_required()
def list_courses():
    """Filters: level, category, type (course|certification|resource), q (search), career_id (recommended for gaps)."""
    u = current_user()
    q = Course.query.filter_by(is_active=True)
    level = request.args.get("level")
    if level:
        if level not in ("beginner", "intermediate", "advanced"):
            err("Invalid level.", 422)
        q = q.filter(Course.level == level)
    if request.args.get("category"):
        q = q.filter(Course.skill_category == request.args["category"])
    if request.args.get("type"):
        q = q.filter(Course.resource_type == request.args["type"])
    if request.args.get("q"):
        term = f"%{request.args['q'].strip()[:60]}%"
        q = q.filter(Course.title.ilike(term) | Course.description.ilike(term))
    courses = [c.to_dict() for c in q.order_by(Course.title).all()]

    focus, career_title = set(), None
    career_id = request.args.get("career_id", type=int)
    if career_id:
        career = db.session.get(Career, career_id)
        if not career:
            err("Career not found.", 404)
        career_title = career.title
        gap = recommender.analyze_gap(student_skill_map(u.id), recommender.career_to_dict(career))
        focus = {m["skill"] for m in gap["missing"]}
        for c in courses:
            c["matches_gap"] = [s for s in c["skills"] if s in focus]
        courses.sort(key=lambda c: (-len(c["matches_gap"]), c["title"]))
        if request.args.get("only_gap") == "1":
            courses = [c for c in courses if c["matches_gap"]]
    categories = sorted({c.skill_category for c in Course.query.filter_by(is_active=True).all()})
    return ok({"courses": courses, "categories": categories, "career": career_title, "gap_skills": sorted(focus)})
