"""Admin-only endpoints: statistics and CRUD for careers, skills and courses/learning resources."""
from collections import Counter
from datetime import timedelta

from flask import Blueprint, request
from sqlalchemy import func

from extensions import db
from models import (Assessment, Career, CareerSkill, ChatHistory, Course, Recommendation, ResumeAnalysis, Skill, User,
                    utcnow)
from routes.careers import career_public
from utils import (admin_required, clean_list, clean_str, err, get_json, ok)

bp = Blueprint("admin", __name__, url_prefix="/admin")
LEVELS = ("beginner", "intermediate", "advanced")
TYPES = ("course", "certification", "resource")


@bp.get("/stats")
@admin_required
def stats():
    since = (utcnow() - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    days = [(since + timedelta(days=i)).date() for i in range(14)]
    series = {d: {"date": d.isoformat(), "registrations": 0, "assessments": 0, "chats": 0} for d in days}
    for (ts,) in db.session.query(User.created_at).filter(User.created_at >= since, User.role == "student"):
        series[ts.date()]["registrations"] += 1
    for (ts,) in db.session.query(Assessment.created_at).filter(Assessment.created_at >= since):
        series[ts.date()]["assessments"] += 1
    for (ts,) in db.session.query(ChatHistory.created_at).filter(ChatHistory.created_at >= since, ChatHistory.role == "user"):
        series[ts.date()]["chats"] += 1

    top1 = dict(db.session.query(Career.title, func.count(Recommendation.id)).join(Recommendation, Recommendation.career_id == Career.id)
                .filter(Recommendation.rank == 1).group_by(Career.title).all())
    top5 = dict(db.session.query(Career.title, func.count(Recommendation.id)).join(Recommendation, Recommendation.career_id == Career.id)
                .group_by(Career.title).all())
    most = sorted(({"career": t, "top_pick": top1.get(t, 0), "times_recommended": n} for t, n in top5.items()),
                  key=lambda r: (-r["top_pick"], -r["times_recommended"], r["career"]))[:8]
    skills_counter = Counter()
    for r in Recommendation.query.filter(Recommendation.rank <= 5).all():
        for m in (r.missing_skills or [])[:3]:
            skills_counter[m["skill"]] += 1
    return ok({
        "totals": {"students": User.query.filter_by(role="student").count(), "assessments": Assessment.query.count(),
                   "careers": Career.query.count(), "courses": Course.query.count(), "skills": Skill.query.count(),
                   "chat_messages": ChatHistory.query.count(), "resumes": ResumeAnalysis.query.count()},
        "most_recommended": most, "activity": list(series.values()),
        "common_skill_gaps": [{"skill": s, "count": n} for s, n in skills_counter.most_common(8)],
    })


@bp.get("/users")
@admin_required
def users():
    rows = User.query.order_by(User.id.desc()).limit(200).all()
    counts = dict(db.session.query(Assessment.user_id, func.count(Assessment.id)).group_by(Assessment.user_id).all())
    return ok({"users": [{**u.to_dict(), "is_active": u.is_active, "assessments": counts.get(u.id, 0),
                          "last_login": u.last_login.isoformat() if u.last_login else None} for u in rows]})


@bp.put("/users/<int:uid>/active")
@admin_required
def toggle_user(uid):
    u = db.session.get(User, uid)
    if not u:
        err("User not found.", 404)
    if u.role == "admin":
        err("Administrator accounts cannot be disabled here.", 403)
    u.is_active = bool(get_json(request).get("is_active"))
    db.session.commit()
    return ok({"id": u.id, "is_active": u.is_active})


# ---------------- skills ----------------
@bp.get("/skills")
@admin_required
def skills():
    return ok({"skills": [s.to_dict() for s in Skill.query.order_by(Skill.category, Skill.name).all()]})


@bp.post("/skills")
@admin_required
def create_skill():
    d = get_json(request)
    name = clean_str(d.get("name"), "Skill name", required=True, max_len=80)
    if Skill.query.filter(func.lower(Skill.name) == name.lower()).first():
        err("A skill with this name already exists.", 409)
    s = Skill(name=name, category=clean_str(d.get("category"), "Category", max_len=60) or "General")
    db.session.add(s)
    db.session.commit()
    return ok(s.to_dict(), 201)


@bp.put("/skills/<int:sid>")
@admin_required
def update_skill(sid):
    s = db.session.get(Skill, sid) or err("Skill not found.", 404)
    d = get_json(request)
    if "name" in d:
        name = clean_str(d["name"], "Skill name", required=True, max_len=80)
        dup = Skill.query.filter(func.lower(Skill.name) == name.lower(), Skill.id != sid).first()
        if dup:
            err("A skill with this name already exists.", 409)
        s.name = name
    if "category" in d:
        s.category = clean_str(d["category"], "Category", max_len=60) or "General"
    db.session.commit()
    return ok(s.to_dict())


@bp.delete("/skills/<int:sid>")
@admin_required
def delete_skill(sid):
    s = db.session.get(Skill, sid) or err("Skill not found.", 404)
    if CareerSkill.query.filter_by(skill_id=sid).first():
        err("This skill is required by a career. Remove it from the career first.", 409)
    db.session.delete(s)
    db.session.commit()
    return ok({"message": "Deleted."})


# ---------------- careers ----------------
def _apply_career(c: Career, d: dict, creating: bool):
    if creating or "title" in d:
        title = clean_str(d.get("title"), "Title", required=True, max_len=120)
        dup = Career.query.filter(func.lower(Career.title) == title.lower(), Career.id != (c.id or 0)).first()
        if dup:
            err("A career with this title already exists.", 409)
        c.title = title
    if creating or "description" in d:
        c.description = clean_str(d.get("description"), "Description", required=True, max_len=2000)
    if "opportunities" in d:
        c.opportunities = clean_str(d["opportunities"], "Opportunities", max_len=2000)
    for f in ("education_required", "education_related", "interest_keywords", "work_environments"):
        if f in d:
            setattr(c, f, [x.lower() if f != "work_environments" else x for x in clean_list(d[f], f)])
    if "is_active" in d:
        c.is_active = bool(d["is_active"])
    if "skills" in d:
        entries = d["skills"]
        if not isinstance(entries, list) or (creating and not entries):
            err("A career needs at least one required skill.", 422)
        names = {s.name: s for s in Skill.query.all()}
        new = {}
        for e in entries:
            if not isinstance(e, dict) or e.get("name") not in names:
                err(f"Unknown skill: {e.get('name') if isinstance(e, dict) else e}", 422)
            lvl = e.get("required_level")
            if not isinstance(lvl, int) or isinstance(lvl, bool) or not 1 <= lvl <= 3:
                err("Required level must be 1, 2 or 3.", 422)
            new[e["name"]] = lvl
        c.skills = [CareerSkill(skill=names[n], required_level=l) for n, l in new.items()]


def _career_admin(c: Career) -> dict:
    return {**career_public(c), "education_related": c.education_related, "interest_keywords": c.interest_keywords,
            "is_active": c.is_active}


@bp.get("/careers")
@admin_required
def admin_careers():
    return ok({"careers": [_career_admin(c) for c in Career.query.order_by(Career.title).all()]})


@bp.post("/careers")
@admin_required
def create_career():
    c = Career(learning_path=[])
    _apply_career(c, get_json(request), True)
    db.session.add(c)
    db.session.commit()
    return ok(_career_admin(c), 201)


@bp.put("/careers/<int:cid>")
@admin_required
def update_career(cid):
    c = db.session.get(Career, cid) or err("Career not found.", 404)
    _apply_career(c, get_json(request), False)
    db.session.commit()
    return ok(_career_admin(c))


@bp.delete("/careers/<int:cid>")
@admin_required
def delete_career(cid):
    c = db.session.get(Career, cid) or err("Career not found.", 404)
    db.session.delete(c)
    db.session.commit()
    return ok({"message": "Deleted."})


# ---------------- courses / learning resources ----------------
def _apply_course(c: Course, d: dict, creating: bool):
    if creating or "title" in d:
        c.title = clean_str(d.get("title"), "Title", required=True, max_len=200)
    if creating or "platform" in d:
        c.platform = clean_str(d.get("platform"), "Platform", required=True, max_len=80)
    if creating or "skill_category" in d:
        c.skill_category = clean_str(d.get("skill_category"), "Skill category", required=True, max_len=60)
    if creating or "level" in d:
        if d.get("level") not in LEVELS:
            err("Level must be beginner, intermediate or advanced.", 422)
        c.level = d["level"]
    if creating or "url" in d:
        url = clean_str(d.get("url"), "URL", required=True, max_len=500)
        if not url.lower().startswith(("https://", "http://")):
            err("URL must start with http:// or https://", 422)
        c.url = url
    if "description" in d:
        c.description = clean_str(d["description"], "Description", max_len=1000)
    if "resource_type" in d:
        if d["resource_type"] not in TYPES:
            err("Type must be course, certification or resource.", 422)
        c.resource_type = d["resource_type"]
    if "skills" in d:
        names = {s.name for s in Skill.query.all()}
        items = clean_list(d["skills"], "Skills")
        if any(i not in names for i in items):
            err("One or more skills do not exist.", 422)
        c.skills = items
    if "is_active" in d:
        c.is_active = bool(d["is_active"])


@bp.get("/courses")
@admin_required
def admin_courses():
    return ok({"courses": [c.to_dict() for c in Course.query.order_by(Course.title).all()]})


@bp.post("/courses")
@admin_required
def create_course():
    c = Course(resource_type="course", skills=[])
    _apply_course(c, get_json(request), True)
    db.session.add(c)
    db.session.commit()
    return ok(c.to_dict(), 201)


@bp.put("/courses/<int:cid>")
@admin_required
def update_course(cid):
    c = db.session.get(Course, cid) or err("Course not found.", 404)
    _apply_course(c, get_json(request), False)
    db.session.commit()
    return ok(c.to_dict())


@bp.delete("/courses/<int:cid>")
@admin_required
def delete_course(cid):
    c = db.session.get(Course, cid) or err("Course not found.", 404)
    db.session.delete(c)
    db.session.commit()
    return ok({"message": "Deleted."})
