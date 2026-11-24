import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urlencode

import requests
from flask import Blueprint, current_app, redirect, request, session
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


def _frontend_redirect(path: str, **params) -> str:
    query = urlencode(params)
    return f"{current_app.config['FRONTEND_URL']}{path}" + (f"?{query}" if query else "")


@bp.get("/github/login")
@limiter.limit("20 per minute")
def github_login():
    client_id = current_app.config["GITHUB_CLIENT_ID"]
    if not client_id:
        err("GitHub sign-in is not configured.", 503)
    state = secrets.token_urlsafe(32)
    session["github_oauth_state"] = state
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": current_app.config["GITHUB_REDIRECT_URI"],
        "scope": "read:user user:email",
        "state": state,
    })
    return redirect(f"https://github.com/login/oauth/authorize?{params}")


@bp.get("/github/callback")
@limiter.limit("20 per minute")
def github_callback():
    error = request.args.get("error")
    if error:
        return redirect(_frontend_redirect("/login", error="GitHub authorization was cancelled or denied"))

    code = request.args.get("code")
    state = request.args.get("state")
    if not code or not state or state != session.pop("github_oauth_state", None):
        return redirect(_frontend_redirect("/login", error="Invalid or expired GitHub sign-in request"))

    client_id = current_app.config["GITHUB_CLIENT_ID"]
    client_secret = current_app.config["GITHUB_CLIENT_SECRET"]
    if not client_id or not client_secret:
        return redirect(_frontend_redirect("/login", error="GitHub sign-in is not configured"))

    try:
        token_response = requests.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": current_app.config["GITHUB_REDIRECT_URI"],
            },
            timeout=10,
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise ValueError("GitHub did not issue an access token")

        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
        profile_response = requests.get("https://api.github.com/user", headers=headers, timeout=10)
        profile_response.raise_for_status()
        github_profile = profile_response.json()

        email = github_profile.get("email")
        if not email:
            emails_response = requests.get("https://api.github.com/user/emails", headers=headers, timeout=10)
            emails_response.raise_for_status()
            email_entries = emails_response.json()
            email = next(
                (entry["email"] for entry in email_entries
                 if entry.get("primary") and entry.get("verified") and entry.get("email")),
                None,
            )
        if not email:
            return redirect(_frontend_redirect("/login", error="GitHub did not provide a verified email address"))

        email = email.strip().lower()
        if not EMAIL_RE.match(email):
            return redirect(_frontend_redirect("/login", error="GitHub returned an invalid email address"))

        user = User.query.filter_by(email=email).first()
        if user:
            if not user.is_active:
                return redirect(_frontend_redirect("/login", error="This account has been disabled"))
        else:
            full_name = clean_str(github_profile.get("name") or github_profile.get("login"), "Full name", required=True, max_len=120)
            user = User(
                email=email,
                full_name=full_name,
                role="student",
                password_hash=generate_password_hash(secrets.token_urlsafe(32)),
            )
            user.profile = StudentProfile()
            db.session.add(user)

        user.last_login = utcnow()
        db.session.commit()
        return redirect(_frontend_redirect(
            "/github/callback",
            token=_token_for(user),
            role=user.role,
        ))
    except requests.RequestException:
        current_app.logger.warning("GitHub OAuth request failed", exc_info=True)
        return redirect(_frontend_redirect("/login", error="Could not sign in with GitHub"))
    except ValueError:
        return redirect(_frontend_redirect("/login", error="Could not complete GitHub sign-in"))


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
