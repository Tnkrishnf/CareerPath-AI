from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from extensions import db, limiter
from models import Career, ResumeAnalysis, Skill
from services import resume_parser
from utils import active_careers, current_user, err, ok

bp = Blueprint("resume", __name__)


def _limit_key():
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    verify_jwt_in_request(optional=True)
    return f"user:{get_jwt_identity() or request.remote_addr}"


def _dict(r: ResumeAnalysis) -> dict:
    return {"id": r.id, "filename": r.original_filename, "pages": r.page_count, "created_at": r.created_at.isoformat(),
            "result": r.result}


@bp.post("/resume/analyze")
@jwt_required()
@limiter.limit(lambda: current_app.config["AI_RATE_LIMIT"], key_func=_limit_key)
def analyze_resume():
    """The PDF is validated and parsed in memory; only the analysis result is stored (the file itself is not saved)."""
    u = current_user()
    file = request.files.get("resume")
    if not file or not file.filename:
        err("Please choose a PDF file to upload (field name: resume).", 422)
    if file.mimetype not in ("application/pdf", "application/x-pdf", "application/octet-stream"):
        err("Only PDF files are accepted.", 422)
    filename = secure_filename(file.filename)
    data = file.read(current_app.config["MAX_CONTENT_LENGTH"] + 1)
    try:
        reader = resume_parser.validate_pdf(filename, data, current_app.config["MAX_PDF_PAGES"])
        text = resume_parser.extract_text(reader)
    except resume_parser.ResumeError as exc:
        err(str(exc), 422)
    if not text.strip():
        err("No readable text was found. Please upload a text-based (not scanned) PDF.", 422)

    cid = request.form.get("career_id", type=int)
    if cid and not db.session.get(Career, cid):
        err("Selected career not found.", 404)
    result = resume_parser.analyze(text, {s.name for s in Skill.query.all()}, active_careers(), cid)
    row = ResumeAnalysis(user_id=u.id, target_career_id=(result["target_career"] or {}).get("id"), original_filename=filename[:255],
                         page_count=len(reader.pages), result=result)
    db.session.add(row)
    db.session.commit()
    return ok(_dict(row), 201)


@bp.get("/resume")
@jwt_required()
def history():
    u = current_user()
    rows = ResumeAnalysis.query.filter_by(user_id=u.id).order_by(ResumeAnalysis.id.desc()).limit(20).all()
    return ok({"analyses": [_dict(r) for r in rows]})
