import uuid

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from extensions import db, limiter
from models import ChatHistory, Course, Recommendation, Assessment
from services import chat_agent, rag
from utils import active_careers, current_user, err, get_json, ok, profile_dict

bp = Blueprint("chat", __name__)


def _user_key():
    verify_jwt_in_request(optional=True)
    return f"user:{get_jwt_identity() or request.remote_addr}"


@bp.post("/chat")
@jwt_required()
@limiter.limit(lambda: current_app.config["AI_RATE_LIMIT"], key_func=_user_key)
def chat():
    u = current_user()
    d = get_json(request)
    message = (d.get("message") or "").strip() if isinstance(d.get("message"), str) else ""
    if not message:
        err("Message cannot be empty.", 422)
    if len(message) > 1000:
        err("Message is too long (max 1000 characters).", 422)
    sid = d.get("session_id") or str(uuid.uuid4())
    if not isinstance(sid, str) or len(sid) > 36:
        err("Invalid session id.", 422)

    prior = ChatHistory.query.filter_by(user_id=u.id, session_id=sid).order_by(ChatHistory.id).all()
    history = [{"role": m.role, "content": m.message} for m in prior]

    profile = profile_dict(u)
    last = Assessment.query.filter_by(user_id=u.id).order_by(Assessment.id.desc()).first()
    if last:
        recs = Recommendation.query.filter_by(assessment_id=last.id).order_by(Recommendation.rank).limit(3).all()
        profile["top_careers"] = [r.career.title for r in recs]

    kb = rag.get_kb(active_careers())
    courses = [c.to_dict() for c in Course.query.filter_by(is_active=True).all()]
    cfg = {k: current_app.config[k] for k in ("LLM_PROVIDER", "LLM_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY")}
    result = chat_agent.answer(message, history, profile, kb, courses, cfg)

    db.session.add(ChatHistory(user_id=u.id, session_id=sid, role="user", message=message))
    db.session.add(ChatHistory(user_id=u.id, session_id=sid, role="assistant", message=result["reply"], sources=result["sources"]))
    db.session.commit()
    return ok({"session_id": sid, "reply": result["reply"], "sources": result["sources"], "mode": result["mode"]})


@bp.get("/chat/sessions")
@jwt_required()
def sessions():
    u = current_user()
    rows = ChatHistory.query.filter_by(user_id=u.id).order_by(ChatHistory.id).all()
    grouped = {}
    for r in rows:
        s = grouped.setdefault(r.session_id, {"session_id": r.session_id, "title": None, "messages": 0, "started": r.created_at, "updated": r.created_at})
        s["messages"] += 1
        s["updated"] = r.created_at
        if r.role == "user" and not s["title"]:
            s["title"] = r.message[:70]
    out = sorted(grouped.values(), key=lambda s: s["updated"], reverse=True)
    for s in out:
        s["started"], s["updated"] = s["started"].isoformat(), s["updated"].isoformat()
    return ok({"sessions": out})


@bp.get("/chat/sessions/<sid>")
@jwt_required()
def session_messages(sid):
    u = current_user()
    rows = ChatHistory.query.filter_by(user_id=u.id, session_id=sid).order_by(ChatHistory.id).all()
    if not rows:
        err("Conversation not found.", 404)
    return ok({"session_id": sid, "messages": [{"role": r.role, "content": r.message, "sources": r.sources or [],
                                                 "created_at": r.created_at.isoformat()} for r in rows]})


@bp.delete("/chat/sessions/<sid>")
@jwt_required()
def delete_session(sid):
    u = current_user()
    ChatHistory.query.filter_by(user_id=u.id, session_id=sid).delete()
    db.session.commit()
    return ok({"message": "Conversation deleted."})
