"""Shared helpers: JSON errors, validation, authorisation decorators, profile loading."""
import re
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from extensions import db
from models import Career, Skill, StudentSkill, User
from services.recommender import career_to_dict

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ApiError(Exception):
    def __init__(self, message, status=400, details=None):
        super().__init__(message)
        self.message, self.status, self.details = message, status, details


def err(message, status=400, details=None):
    raise ApiError(message, status, details)


def ok(data=None, status=200, **extra):
    body = data if data is not None else {}
    if extra:
        body = {**body, **extra}
    return jsonify(body), status


def current_user() -> User:
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active:
        err("Account not found or disabled.", 401)
    return user


def student_or_admin(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        verify_jwt_in_request()
        return fn(*a, **kw)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        verify_jwt_in_request()
        if get_jwt().get("role") != "admin":
            err("Administrator access required.", 403)
        return fn(*a, **kw)
    return wrapper


# ---------- validation ----------
def clean_str(value, field, required=False, max_len=255):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            err(f"{field} is required.", 422)
        return None
    if not isinstance(value, str):
        err(f"{field} must be text.", 422)
    value = value.strip()
    if len(value) > max_len:
        err(f"{field} must be at most {max_len} characters.", 422)
    return value


def clean_list(value, field, max_items=30, max_len=80):
    if value is None:
        return []
    if not isinstance(value, list):
        err(f"{field} must be a list.", 422)
    out = []
    for item in value[:max_items]:
        if not isinstance(item, str) or not item.strip() or len(item) > max_len:
            err(f"{field} contains an invalid entry.", 422)
        out.append(item.strip())
    return list(dict.fromkeys(out))


def validate_password(pw):
    if not isinstance(pw, str) or len(pw) < 8 or len(pw) > 128:
        err("Password must be 8-128 characters.", 422)
    if not (re.search(r"[A-Za-z]", pw) and re.search(r"\d", pw)):
        err("Password must contain at least one letter and one number.", 422)


def clean_skill_entries(entries):
    """[{name, level}] -> {Skill: level}. Rejects unknown skills and levels outside 1-3."""
    if entries is None:
        return {}
    if not isinstance(entries, list):
        err("skills must be a list.", 422)
    result = {}
    names = {s.name: s for s in Skill.query.all()}
    for e in entries:
        if not isinstance(e, dict) or e.get("name") not in names:
            err(f"Unknown skill: {e.get('name') if isinstance(e, dict) else e}", 422)
        level = e.get("level")
        if not isinstance(level, int) or isinstance(level, bool) or not 1 <= level <= 3:
            err("Skill level must be 1 (beginner), 2 (intermediate) or 3 (advanced).", 422)
        result[e["name"]] = level
    return {names[n]: l for n, l in result.items()}


def get_json(request):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        err("Request body must be a JSON object.", 400)
    return data


# ---------- data loading ----------
def student_skill_map(user_id: int) -> dict:
    rows = StudentSkill.query.filter_by(user_id=user_id).all()
    return {r.skill.name: r.level for r in rows}


def active_careers() -> list[dict]:
    return [career_to_dict(c) for c in Career.query.filter_by(is_active=True).order_by(Career.id).all()]


def profile_dict(user: User) -> dict:
    p = user.profile
    base = p.to_dict() if p else {}
    return {"name": user.full_name, **base, "skills": student_skill_map(user.id)}
