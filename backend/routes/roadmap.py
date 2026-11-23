from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from extensions import db
from models import Career, Course, LearningRoadmap, RoadmapProgress
from utils import current_user, err, get_json, ok

bp = Blueprint("roadmap", __name__)
SECTIONS = ("topics", "practice", "projects")


def _items(career: Career):
    """Yield (stage_index, section, item_index, text) for every checkable item."""
    for si, st in enumerate(career.learning_path or []):
        for sec in SECTIONS:
            for ii, text in enumerate(st.get(sec, [])):
                yield si, sec, ii, text


def _get_or_create(user_id, career) -> LearningRoadmap:
    rm = LearningRoadmap.query.filter_by(user_id=user_id, career_id=career.id).first()
    if not rm:
        rm = LearningRoadmap(user_id=user_id, career_id=career.id)
        db.session.add(rm)
        db.session.commit()
    return rm


def _serialize(rm: LearningRoadmap) -> dict:
    career = rm.career
    done = {p.item_key for p in rm.progress if p.completed}
    courses = Course.query.filter_by(is_active=True).all()
    stages, total, completed = [], 0, 0
    for si, st in enumerate(career.learning_path or []):
        stage_total = stage_done = 0
        sections = {}
        for sec in SECTIONS:
            items = []
            for ii, text in enumerate(st.get(sec, [])):
                key = f"{si}:{sec}:{ii}"
                is_done = key in done
                items.append({"key": key, "text": text, "completed": is_done})
                stage_total += 1
                stage_done += is_done
            sections[sec] = items
        wanted = set(st.get("skills", []))
        resources = sorted(({"title": c.title, "url": c.url, "platform": c.platform, "level": c.level,
                             "resource_type": c.resource_type, "overlap": len(wanted & set(c.skills or []))}
                            for c in courses if wanted & set(c.skills or [])), key=lambda r: (-r["overlap"], r["title"]))[:4]
        total += stage_total
        completed += stage_done
        stages.append({"index": si, "title": st["title"], "duration": st["duration"], "technologies": st.get("technologies", []),
                       **sections, "resources": resources, "total": stage_total, "done": stage_done,
                       "percent": round(100 * stage_done / stage_total) if stage_total else 0,
                       "status": "completed" if stage_total and stage_done == stage_total else ("in_progress" if stage_done else "not_started")})
    return {"career": {"id": career.id, "title": career.title}, "stages": stages, "total": total, "completed": completed,
            "percent": round(100 * completed / total) if total else 0}


@bp.get("/roadmaps")
@jwt_required()
def list_roadmaps():
    u = current_user()
    out = []
    for rm in LearningRoadmap.query.filter_by(user_id=u.id).all():
        s = _serialize(rm)
        out.append({"career": s["career"], "percent": s["percent"], "completed": s["completed"], "total": s["total"]})
    return ok({"roadmaps": out})


@bp.get("/roadmaps/<int:career_id>")
@jwt_required()
def get_roadmap(career_id):
    u = current_user()
    career = db.session.get(Career, career_id)
    if not career or not career.is_active:
        err("Career not found.", 404)
    return ok(_serialize(_get_or_create(u.id, career)))


@bp.put("/roadmaps/<int:career_id>/progress")
@jwt_required()
def update_progress(career_id):
    u = current_user()
    career = db.session.get(Career, career_id)
    if not career:
        err("Career not found.", 404)
    d = get_json(request)
    key, completed = d.get("item_key"), d.get("completed")
    valid = {f"{si}:{sec}:{ii}" for si, sec, ii, _ in _items(career)}
    if key not in valid:
        err("Unknown roadmap item.", 422)
    if not isinstance(completed, bool):
        err("completed must be true or false.", 422)
    rm = _get_or_create(u.id, career)
    row = RoadmapProgress.query.filter_by(roadmap_id=rm.id, item_key=key).first()
    if not row:
        row = RoadmapProgress(roadmap_id=rm.id, item_key=key)
        db.session.add(row)
    row.completed = completed
    db.session.commit()
    db.session.refresh(rm)
    return ok(_serialize(rm))
