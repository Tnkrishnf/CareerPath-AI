import io
import os
import sys

import pytest
from reportlab.pdfgen import canvas

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app  # noqa: E402
from config import TestConfig  # noqa: E402
from extensions import db  # noqa: E402
from models import User  # noqa: E402
from seed import make_user, seed_reference_data  # noqa: E402

STUDENT = {"full_name": "Test Student", "email": "t@example.com", "password": "Secret123"}
ASSESSMENT = {
    "full_name": "Test Student", "education_level": "Bachelor's degree", "degree": "B.Sc Computer Science", "department": "Computer Science",
    "skills": [{"name": "Python", "level": 3}, {"name": "SQL", "level": 2}, {"name": "Pandas", "level": 2}, {"name": "Statistics", "level": 2}],
    "interests": ["Artificial Intelligence", "Data Analysis"], "favourite_subjects": ["Statistics", "Machine Learning"],
    "work_environment": "Hybrid", "career_goals": "I want to become a data scientist", "learning_preference": "Hands-on projects",
}


@pytest.fixture()
def client():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        seed_reference_data()
        make_user("admin@example.com", "Admin", "Admin12345", role="admin")
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def auth(client, email="t@example.com", pw="Secret123"):
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def register(client):
    r = client.post("/api/auth/register", json=STUDENT)
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def make_pdf(text_lines):
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    y = 800
    for line in text_lines:
        c.drawString(50, y, line)
        y -= 18
    c.save()
    return buf.getvalue()


# ---------- auth ----------
def test_register_hashes_password_and_validates(client):
    assert client.post("/api/auth/register", json={**STUDENT, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**STUDENT, "email": "bad"}).status_code == 422
    register(client)
    assert client.post("/api/auth/register", json=STUDENT).status_code == 409
    u = User.query.filter_by(email="t@example.com").first()
    assert u.password_hash != "Secret123" and u.password_hash.startswith(("scrypt", "pbkdf2"))


def test_login_logout_and_protected_routes(client):
    assert client.get("/api/profile").status_code == 401
    register(client)
    assert client.post("/api/auth/login", json={"email": "t@example.com", "password": "wrong"}).status_code == 401
    h = auth(client)
    assert client.get("/api/auth/me", headers=h).get_json()["user"]["role"] == "student"
    assert client.post("/api/auth/logout", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401  # token revoked


def test_password_reset_flow(client):
    register(client)
    token = client.post("/api/auth/forgot-password", json={"email": "t@example.com"}).get_json()["reset_token"]
    assert client.post("/api/auth/reset-password", json={"token": "nope", "password": "NewPass123"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "NewPass123"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "t@example.com", "password": "NewPass123"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "Another123"}).status_code == 400  # one-time


def test_role_based_access(client):
    h = register(client)
    assert client.get("/api/admin/stats", headers=h).status_code == 403
    a = auth(client, "admin@example.com", "Admin12345")
    assert client.get("/api/admin/stats", headers=a).status_code == 200


# ---------- assessment & recommendations ----------
def test_assessment_generates_explainable_top5(client):
    h = register(client)
    assert client.post("/api/assessments", headers=h, json={**ASSESSMENT, "skills": []}).status_code == 422
    assert client.post("/api/assessments", headers=h, json={**ASSESSMENT, "skills": [{"name": "Nope", "level": 2}]}).status_code == 422
    r = client.post("/api/assessments", headers=h, json=ASSESSMENT)
    assert r.status_code == 201
    recs = r.get_json()["recommendations"]
    assert len(recs) == 5
    assert recs[0]["career"]["title"] == "Data Scientist"
    assert [x["rank"] for x in recs] == [1, 2, 3, 4, 5]
    scores = [x["match_percent"] for x in recs]
    assert scores == sorted(scores, reverse=True) and all(0 <= s <= 100 for s in scores)
    top = recs[0]
    assert top["explanation"] and top["missing_skills"] and set(top["breakdown"]) >= {"skills", "interests", "education", "preferences"}
    assert any(m["skill"] == "Machine Learning" for m in top["missing_skills"])
    # saved to profile
    prof = client.get("/api/profile", headers=h).get_json()
    assert prof["profile"]["degree"] == "B.Sc Computer Science" and len(prof["skills"]) == 4
    assert len(client.get("/api/recommendations", headers=h).get_json()["recommendations"]) == 5


def test_recommender_is_deterministic(client):
    h = register(client)
    a = client.post("/api/assessments", headers=h, json=ASSESSMENT).get_json()["recommendations"]
    b = client.post("/api/assessments", headers=h, json=ASSESSMENT).get_json()["recommendations"]
    assert [(x["career"]["id"], x["match_percent"]) for x in a] == [(x["career"]["id"], x["match_percent"]) for x in b]


# ---------- skill gap / roadmap / courses ----------
def test_skill_gap_roadmap_and_courses(client):
    h = register(client)
    client.post("/api/assessments", headers=h, json=ASSESSMENT)
    ds = next(c for c in client.get("/api/careers").get_json()["careers"] if c["title"] == "Data Scientist")
    gap = client.get(f"/api/skill-gap/{ds['id']}", headers=h).get_json()
    assert gap["missing"] and gap["existing"] is not None and 0 < gap["readiness_percent"] < 100
    assert any(p["skill"] == "Machine Learning" and p["priority"] == "High" for p in gap["priorities"])

    rm = client.get(f"/api/roadmaps/{ds['id']}", headers=h).get_json()
    assert rm["percent"] == 0 and len(rm["stages"]) == 3 and rm["stages"][0]["resources"]
    key = rm["stages"][0]["topics"][0]["key"]
    up = client.put(f"/api/roadmaps/{ds['id']}/progress", headers=h, json={"item_key": key, "completed": True}).get_json()
    assert up["completed"] == 1 and up["percent"] > 0 and up["stages"][0]["topics"][0]["completed"]
    assert client.put(f"/api/roadmaps/{ds['id']}/progress", headers=h, json={"item_key": "9:topics:9", "completed": True}).status_code == 422
    back = client.put(f"/api/roadmaps/{ds['id']}/progress", headers=h, json={"item_key": key, "completed": False}).get_json()
    assert back["completed"] == 0

    beginners = client.get("/api/courses?level=beginner", headers=h).get_json()["courses"]
    assert beginners and all(c["level"] == "beginner" and c["url"].startswith("https://") for c in beginners)
    rec = client.get(f"/api/courses?career_id={ds['id']}&only_gap=1", headers=h).get_json()
    assert rec["gap_skills"] and all(c["matches_gap"] for c in rec["courses"])
    assert client.get("/api/courses?level=expert", headers=h).status_code == 422


def test_saved_careers(client):
    h = register(client)
    cid = client.get("/api/careers").get_json()["careers"][0]["id"]
    assert client.post("/api/saved-careers", headers=h, json={"career_id": cid}).status_code == 201
    client.post("/api/saved-careers", headers=h, json={"career_id": cid})  # idempotent
    assert len(client.get("/api/saved-careers", headers=h).get_json()["saved"]) == 1
    client.delete(f"/api/saved-careers/{cid}", headers=h)
    assert client.get("/api/saved-careers", headers=h).get_json()["saved"] == []


# ---------- resume ----------
def test_resume_upload_validation_and_analysis(client):
    h = register(client)
    pdf = make_pdf(["Summary: Aspiring data scientist", "Education: B.Sc Computer Science", "Skills: Python, SQL, Pandas, scikit-learn, Git",
                    "Projects: Churn prediction using machine learning", "github.com/test"])
    r = client.post("/api/resume/analyze", headers=h, data={"resume": (io.BytesIO(pdf), "cv.pdf"), "career_id": "2"}, content_type="multipart/form-data")
    assert r.status_code == 201, r.get_json()
    res = r.get_json()["result"]
    assert {"Python", "SQL", "Pandas", "Scikit-learn", "Git"} <= set(res["skills"])
    assert "B.Sc" in res["education"] and res["missing_skills"] is not None
    # bad uploads
    bad = client.post("/api/resume/analyze", headers=h, data={"resume": (io.BytesIO(b"hello"), "cv.txt")}, content_type="multipart/form-data")
    assert bad.status_code == 422
    fake = client.post("/api/resume/analyze", headers=h, data={"resume": (io.BytesIO(b"not a pdf at all"), "cv.pdf")}, content_type="multipart/form-data")
    assert fake.status_code == 422
    assert len(client.get("/api/resume", headers=h).get_json()["analyses"]) == 1


# ---------- chatbot ----------
def test_chat_offline_rag_and_history(client):
    h = register(client)
    r = client.post("/api/chat", headers=h, json={"message": "How do I start learning Python?"}).get_json()
    assert r["mode"] == "offline" and "Python" in r["reply"]
    assert any(s["url"].startswith("https://docs.python.org") for s in r["sources"])
    sid = r["session_id"]
    client.post("/api/chat", headers=h, json={"message": "What about SQL?", "session_id": sid})
    msgs = client.get(f"/api/chat/sessions/{sid}", headers=h).get_json()["messages"]
    assert len(msgs) == 4
    assert client.get("/api/chat/sessions", headers=h).get_json()["sessions"][0]["messages"] == 4
    # unknown topic must not invent facts
    r2 = client.post("/api/chat", headers=h, json={"message": "What is the exact salary of a Data Scientist at XYZ?"}).get_json()
    assert not any("salary" in s["title"].lower() and "http" in s["url"] for s in r2["sources"])
    assert client.post("/api/chat", headers=h, json={"message": ""}).status_code == 422
    client.delete(f"/api/chat/sessions/{sid}", headers=h)
    assert client.get(f"/api/chat/sessions/{sid}", headers=h).status_code == 404


# ---------- dashboards / admin CRUD ----------
def test_dashboards_and_admin_crud(client):
    h = register(client)
    client.post("/api/assessments", headers=h, json=ASSESSMENT)
    d = client.get("/api/dashboard", headers=h).get_json()
    assert d["has_assessment"] and d["readiness"] and d["skill_radar"]

    a = auth(client, "admin@example.com", "Admin12345")
    s = client.get("/api/admin/stats", headers=a).get_json()
    assert s["totals"]["students"] == 1 and s["totals"]["assessments"] == 1 and len(s["activity"]) == 14 and s["most_recommended"]

    c = client.post("/api/admin/courses", headers=a, json={"title": "New", "platform": "X", "skill_category": "Web", "level": "beginner",
                                                            "url": "https://example.com", "skills": ["HTML"]})
    assert c.status_code == 201
    cid = c.get_json()["id"]
    assert client.put(f"/api/admin/courses/{cid}", headers=a, json={"level": "bogus"}).status_code == 422
    assert client.put(f"/api/admin/courses/{cid}", headers=a, json={"level": "advanced"}).get_json()["level"] == "advanced"
    assert client.delete(f"/api/admin/courses/{cid}", headers=a).status_code == 200

    sk = client.post("/api/admin/skills", headers=a, json={"name": "Rust", "category": "Programming"}).get_json()
    cr = client.post("/api/admin/careers", headers=a, json={"title": "Systems Programmer", "description": "Low-level software.",
                                                             "skills": [{"name": "Rust", "required_level": 3}]})
    assert cr.status_code == 201
    assert client.delete(f"/api/admin/skills/{sk['id']}", headers=a).status_code == 409  # in use
    assert client.delete(f"/api/admin/careers/{cr.get_json()['id']}", headers=a).status_code == 200
    assert client.delete(f"/api/admin/skills/{sk['id']}", headers=a).status_code == 200


def test_sql_injection_attempt_is_harmless(client):
    register(client)
    r = client.post("/api/auth/login", json={"email": "' OR '1'='1", "password": "x"})
    assert r.status_code == 401
    h = auth(client)
    assert client.get("/api/courses?q=%27%3B%20DROP%20TABLE%20users%3B--", headers=h).status_code == 200
    assert User.query.count() >= 2
