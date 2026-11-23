import hashlib
import secrets
from datetime import timedelta

from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import TOKEN_BLOCKLIST, db, limiter
from models import StudentProfile, User, utcnow
from utils import EMAIL_RE, clean_str, current_user, err, get_json, ok, validate_password

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _token_for(user: User) -> str:
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role})


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@bp.post("/register")
@limiter.limit("10 per minute")
def register():
    d = get_json(request)
    name = clean_str(d.get("full_name"), "Full name", required=True, max_len=120)
    email = (clean_str(d.get("email"), "Email", required=True) or "").lower()
    if not EMAIL_RE.match(email):
        err("Please enter a valid email address.", 422)
    validate_password(d.get("password"))
    if User.query.filter_by(email=email).first():
        err("An account with this email already exists.", 409)
    user = User(email=email, full_name=name, role="student", password_hash=generate_password_hash(d["password"]))
    user.profile = StudentProfile()
    db.session.add(user)
    db.session.commit()
    return ok({"token": _token_for(user), "user": user.to_dict()}, 201)


@bp.post("/login")
@limiter.limit("20 per minute")
def login():
    d = get_json(request)
    email = (clean_str(d.get("email"), "Email", required=True) or "").lower()
    user = User.query.filter_by(email=email).first()
    # Same message for unknown email / wrong password prevents account enumeration.
    if not user or not check_password_hash(user.password_hash, d.get("password") or ""):
        err("Invalid email or password.", 401)
    if not user.is_active:
        err("This account has been disabled.", 403)
    user.last_login = utcnow()
    db.session.commit()
    return ok({"token": _token_for(user), "user": user.to_dict()})


@bp.post("/logout")
@jwt_required()
def logout():
    TOKEN_BLOCKLIST.add(get_jwt()["jti"])
    return ok({"message": "Logged out."})


@bp.get("/me")
@jwt_required()
def me():
    return ok({"user": current_user().to_dict()})


@bp.post("/forgot-password")
@limiter.limit("5 per minute")
def forgot_password():
    """Issues a one-time reset token (valid 30 min). No SMTP is configured in this project, so in development
    the token is returned in the response; in production it would be emailed instead."""
    d = get_json(request)
    email = (clean_str(d.get("email"), "Email", required=True) or "").lower()
    user = User.query.filter_by(email=email).first()
    body = {"message": "If that email is registered, a reset token has been generated."}
    if user:
        token = secrets.token_urlsafe(24)
        user.reset_token_hash = _hash_token(token)
        user.reset_expires = utcnow() + timedelta(minutes=30)
        db.session.commit()
        current_app.logger.info("Password reset token for %s: %s", email, token)
        if current_app.config["DEBUG_RESET_TOKEN"]:
            body["reset_token"] = token
    return ok(body)


@bp.post("/reset-password")
@limiter.limit("10 per minute")
def reset_password():
    d = get_json(request)
    token = clean_str(d.get("token"), "Reset token", required=True, max_len=200)
    validate_password(d.get("password"))
    user = User.query.filter_by(reset_token_hash=_hash_token(token)).first()
    if not user or not user.reset_expires or user.reset_expires < utcnow():
        err("The reset token is invalid or has expired.", 400)
    user.password_hash = generate_password_hash(d["password"])
    user.reset_token_hash = None
    user.reset_expires = None
    db.session.commit()
    return ok({"message": "Password updated. You can now log in."})
