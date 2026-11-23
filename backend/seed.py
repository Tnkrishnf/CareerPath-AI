"""Create the database/tables and load sample data.

Usage:
    python seed.py            # create DB (MySQL) + tables + reference data + demo accounts
    python seed.py --reset    # drop all tables first
    python seed.py --no-demo  # reference data + admin only (no demo students)
"""
import os
import random
import sys
from datetime import timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from werkzeug.security import generate_password_hash

from app import create_app
from config import Config
from data.seed_data import CAREERS, COURSES, SKILLS
from extensions import db
from models import (Assessment, AssessmentAnswer, Career, CareerSkill, ChatHistory, Course, Recommendation, Skill, StudentProfile,
                    StudentSkill, User, utcnow)
from services import recommender
from utils import active_careers


def ensure_mysql_database():
    url = make_url(Config.SQLALCHEMY_DATABASE_URI)
    if not url.drivername.startswith("mysql"):
        return
    server_engine = create_engine(url.set(database=None))
    with server_engine.connect() as conn:
        conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{url.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
        conn.commit()
    server_engine.dispose()


def seed_reference_data():
    if Skill.query.first():
        return
    skills = {}
    for category, names in SKILLS.items():
        for n in names:
            s = Skill(name=n, category=category)
            db.session.add(s)
            skills[n] = s
    db.session.flush()
    for c in CAREERS:
        career = Career(title=c["title"], description=c["description"], opportunities=c["opportunities"],
                        education_required=c["education_required"], education_related=c["education_related"],
                        interest_keywords=c["interest_keywords"], work_environments=c["work_environments"],
                        learning_path=c["learning_path"])
        career.skills = [CareerSkill(skill=skills[n], required_level=l) for n, l in c["skills"].items()]
        db.session.add(career)
    for c in COURSES:
        unknown = [s for s in c["skills"] if s not in skills]
        assert not unknown, f"Unknown skills in course {c['title']}: {unknown}"
        db.session.add(Course(**c))
    db.session.commit()


def make_user(email, name, password, role="student", created_at=None):
    u = User.query.filter_by(email=email).first()
    if u:
        return u
    u = User(email=email, full_name=name, role=role, password_hash=generate_password_hash(password),
             created_at=created_at or utcnow())
    u.profile = StudentProfile()
    db.session.add(u)
    db.session.commit()
    return u


def run_assessment(user, data, when=None):
    """Same logic as POST /api/assessments, used for demo data."""
    skills = {s.name: s for s in Skill.query.all()}
    p = user.profile
    for k in ("education_level", "degree", "department", "interests", "favourite_subjects", "work_environment",
              "career_goals", "learning_preference"):
        setattr(p, k, data.get(k))
    StudentSkill.query.filter_by(user_id=user.id).delete()
    for name, lvl in data["skills"].items():
        db.session.add(StudentSkill(user_id=user.id, skill_id=skills[name].id, level=lvl))
    a = Assessment(user_id=user.id, created_at=when or utcnow())
    db.session.add(a)
    db.session.flush()
    for k, v in data.items():
        db.session.add(AssessmentAnswer(assessment_id=a.id, question_key=k, answer=v))
    results = recommender.recommend({**p.to_dict(), "skills": data["skills"]}, active_careers(), 5)
    for r in results:
        db.session.add(Recommendation(assessment_id=a.id, user_id=user.id, career_id=r["career"]["id"], rank=r["rank"],
                                      score=r["score"], breakdown=r["breakdown"], explanation=r["explanation"],
                                      missing_skills=r["missing_skills"], created_at=when or utcnow()))
    db.session.commit()


DEMO_STUDENTS = [
    ("Aarav Sharma", "B.Sc Computer Science", "Computer Science", {"Python": 2, "SQL": 2, "Pandas": 1, "Statistics": 2, "Git": 1},
     ["Artificial Intelligence", "Data Analysis"], ["Mathematics", "Statistics", "Machine Learning"], "Hybrid",
     "I want to become a data scientist and work with machine learning."),
    ("Diya Patel", "BCA", "Computer Applications", {"HTML": 3, "CSS": 3, "JavaScript": 2, "React": 1, "Git": 2},
     ["Web Development", "UI/UX Design"], ["Web Technologies", "Design"], "Remote", "Build beautiful websites as a frontend developer."),
    ("Rohan Iyer", "B.Sc Information Technology", "Information Technology", {"Linux": 2, "Computer Networks": 2, "Cybersecurity Fundamentals": 1, "Python": 1},
     ["Cybersecurity", "Cloud Computing"], ["Networking", "Security", "Operating Systems"], "Office", "Work in security and protect networks."),
    ("Meera Nair", "B.Sc Computer Science", "Computer Science", {"Java": 2, "Kotlin": 1, "OOP": 2, "Data Structures": 2},
     ["Mobile Apps", "Problem Solving"], ["Programming", "Algorithms"], "Startup", "Create Android apps."),
    ("Kabir Singh", "B.Sc Mathematics", "Mathematics", {"Python": 3, "NumPy": 2, "Statistics": 3, "Machine Learning": 2, "Scikit-learn": 1},
     ["Artificial Intelligence", "Research", "Mathematics"], ["Mathematics", "Machine Learning"], "Research / academia", "Research machine learning."),
    ("Sana Khan", "B.Com", "Commerce", {"Excel": 3, "SQL": 1, "Data Visualization": 2, "Communication": 3},
     ["Data Analysis"], ["Statistics", "Databases"], "Office", "Become a data analyst for a business team."),
    ("Vikram Rao", "B.E Computer Science", "Computer Science", {"Python": 2, "Flask": 2, "SQL": 2, "MySQL": 2, "REST APIs": 1, "Git": 2},
     ["Web Development", "Databases"], ["Databases", "Software Engineering"], "Hybrid", "Backend developer building APIs."),
    ("Ananya Das", "B.Des", "Design", {"Figma": 2, "UI/UX Design": 2, "HTML": 1, "Communication": 2},
     ["UI/UX Design", "Web Development"], ["Design"], "Freelance", "Be a UX designer."),
]


def seed_demo(admin_pw, demo_email, demo_pw):
    rng = random.Random(42)
    now = utcnow()
    for i, (name, degree, dept, skills, interests, subjects, env, goal) in enumerate(DEMO_STUDENTS):
        when = now - timedelta(days=rng.randint(0, 12), hours=rng.randint(0, 20))
        u = make_user(f"demo{i + 1}@careerpath.ai", name, "Demo@12345", created_at=when)
        if not Assessment.query.filter_by(user_id=u.id).first():
            run_assessment(u, {"education_level": "Bachelor's degree", "degree": degree, "department": dept, "skills": skills,
                               "interests": interests, "favourite_subjects": subjects, "work_environment": env, "career_goals": goal,
                               "learning_preference": "Hands-on projects"}, when)
            db.session.add(ChatHistory(user_id=u.id, session_id=f"demo-session-{i}", role="user", message="Which skills should I learn first?", created_at=when))
            db.session.add(ChatHistory(user_id=u.id, session_id=f"demo-session-{i}", role="assistant", message="Start with the skills marked high priority in your skill-gap analysis.", created_at=when))
    db.session.commit()
    student = make_user(demo_email, "Demo Student", demo_pw)
    if not Assessment.query.filter_by(user_id=student.id).first():
        run_assessment(student, {"education_level": "Bachelor's degree", "degree": "B.Sc Computer Science", "department": "Computer Science",
                                 "skills": {"Python": 2, "SQL": 2, "HTML": 2, "CSS": 1, "JavaScript": 1, "Git": 1},
                                 "interests": ["Web Development", "Artificial Intelligence"], "favourite_subjects": ["Programming", "Databases"],
                                 "work_environment": "Hybrid", "career_goals": "I want to work as a software developer and learn machine learning.",
                                 "learning_preference": "Hands-on projects"})


def main():
    reset = "--reset" in sys.argv
    app = create_app()
    ensure_mysql_database()
    with app.app_context():
        if reset:
            db.drop_all()
        db.create_all()
        seed_reference_data()
        admin_email = os.getenv("ADMIN_EMAIL", "admin@careerpath.ai")
        admin_pw = os.getenv("ADMIN_PASSWORD", "Admin@12345")
        make_user(admin_email, "Platform Admin", admin_pw, role="admin")
        demo_email = os.getenv("DEMO_STUDENT_EMAIL", "student@careerpath.ai")
        demo_pw = os.getenv("DEMO_STUDENT_PASSWORD", "Student@12345")
        if "--no-demo" not in sys.argv:
            seed_demo(admin_pw, demo_email, demo_pw)
        print(f"Database ready: {db.engine.url.render_as_string(hide_password=True)}")
        print(f"  Admin   : {admin_email} / {admin_pw}")
        if "--no-demo" not in sys.argv:
            print(f"  Student : {demo_email} / {demo_pw}")
        print(f"  Careers: {Career.query.count()}  Skills: {Skill.query.count()}  Courses: {Course.query.count()}  Users: {User.query.count()}")


if __name__ == "__main__":
    main()
