from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from data.seed_data import (EDUCATION_LEVELS, INTERESTS, LEARNING_PREFERENCES, SUBJECTS, WORK_ENVIRONMENTS)
from extensions import db
from models import Skill, StudentProfile, StudentSkill
from utils import (clean_list, clean_skill_entries, clean_str, current_user, err, get_json, ok, student_skill_map,
                   validate_password)

bp = Blueprint("profile", __name__)


def save_profile_fields(user, d, partial=True):
    """Validates and writes the shared profile fields used by both the profile page and the assessment."""
    p = user.profile or StudentProfile(user=user)
    if "full_name" in d:
        user.full_name = clean_str(d["full_name"], "Full name", required=True, max_len=120)
    if "education_level" in d:
        lvl = clean_str(d["education_level"], "Education level", max_len=60)
        if lvl and lvl not in EDUCATION_LEVELS:
            err("Unknown education level.", 422)
        p.education_level = lvl
    for field, label, size in (("degree", "Degree", 120), ("department", "Department", 120), ("career_goals", "Career goals", 1000),
                               ("bio", "Bio", 1000)):
        if field in d:
            setattr(p, field, clean_str(d[field], label, max_len=size))
    if "graduation_year" in d:
        y = d["graduation_year"]
        if y in (None, ""):
            p.graduation_year = None
        elif isinstance(y, int) and 1990 <= y <= 2100:
            p.graduation_year = y
        else:
            err("Graduation year must be between 1990 and 2100.", 422)
    if "work_environment" in d:
        w = clean_str(d["work_environment"], "Work environment", max_len=60)
        if w and w not in WORK_ENVIRONMENTS:
            err("Unknown work environment.", 422)
        p.work_environment = w
    if "learning_preference" in d:
        lp = clean_str(d["learning_preference"], "Learning preference", max_len=60)
        if lp and lp not in LEARNING_PREFERENCES:
            err("Unknown learning preference.", 422)
        p.learning_preference = lp
    if "interests" in d:
        items = clean_list(d["interests"], "Interests")
        if any(i not in INTERESTS for i in items):
            err("Unknown interest selected.", 422)
        p.interests = items
    if "favourite_subjects" in d:
        items = clean_list(d["favourite_subjects"], "Favourite subjects")
        if any(i not in SUBJECTS for i in items):
            err("Unknown subject selected.", 422)
        p.favourite_subjects = items
    db.session.add(p)
    return p


def replace_skills(user_id, skill_map):
    StudentSkill.query.filter_by(user_id=user_id).delete()
    for skill, level in skill_map.items():
        db.session.add(StudentSkill(user_id=user_id, skill_id=skill.id, level=level))


@bp.get("/meta/options")
def options():
    skills = [s.to_dict() for s in Skill.query.order_by(Skill.category, Skill.name).all()]
    return ok({"interests": INTERESTS, "subjects": SUBJECTS, "work_environments": WORK_ENVIRONMENTS,
               "learning_preferences": LEARNING_PREFERENCES, "education_levels": EDUCATION_LEVELS, "skills": skills})


@bp.get("/profile")
@jwt_required()
def get_profile():
    u = current_user()
    skills = [{"name": n, "level": l} for n, l in student_skill_map(u.id).items()]
    return ok({"user": u.to_dict(), "profile": u.profile.to_dict() if u.profile else {}, "skills": skills})


@bp.put("/profile")
@jwt_required()
def update_profile():
    u = current_user()
    d = get_json(request)
    skill_map = clean_skill_entries(d["skills"]) if "skills" in d else None
    save_profile_fields(u, d)
    if skill_map is not None:
        replace_skills(u.id, skill_map)
    db.session.commit()
    return get_profile()


@bp.put("/profile/password")
@jwt_required()
def change_password():
    u = current_user()
    d = get_json(request)
    if not check_password_hash(u.password_hash, d.get("current_password") or ""):
        err("Current password is incorrect.", 403)
    validate_password(d.get("new_password"))
    u.password_hash = generate_password_hash(d["new_password"])
    db.session.commit()
    return ok({"message": "Password changed."})
