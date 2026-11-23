"""SQLAlchemy models for the careerpath_ai database (15 core tables)."""
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Index, UniqueConstraint

from extensions import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Timestamped:
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


class User(db.Model, Timestamped):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    last_login = db.Column(db.DateTime)
    reset_token_hash = db.Column(db.String(64))
    reset_expires = db.Column(db.DateTime)
    profile = db.relationship("StudentProfile", uselist=False, back_populates="user", cascade="all, delete-orphan")
    __table_args__ = (CheckConstraint("role IN ('student','admin')", name="ck_users_role"), Index("ix_users_role", "role"))

    def to_dict(self):
        return {"id": self.id, "email": self.email, "full_name": self.full_name, "role": self.role,
                "created_at": self.created_at.isoformat()}


class StudentProfile(db.Model, Timestamped):
    __tablename__ = "student_profiles"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    education_level = db.Column(db.String(60))
    degree = db.Column(db.String(120))
    department = db.Column(db.String(120))
    graduation_year = db.Column(db.Integer)
    interests = db.Column(db.JSON, default=list)
    favourite_subjects = db.Column(db.JSON, default=list)
    work_environment = db.Column(db.String(60))
    career_goals = db.Column(db.Text)
    learning_preference = db.Column(db.String(60))
    bio = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    user = db.relationship("User", back_populates="profile")

    def to_dict(self):
        return {"education_level": self.education_level, "degree": self.degree, "department": self.department,
                "graduation_year": self.graduation_year, "interests": self.interests or [],
                "favourite_subjects": self.favourite_subjects or [], "work_environment": self.work_environment,
                "career_goals": self.career_goals, "learning_preference": self.learning_preference, "bio": self.bio}


class Skill(db.Model, Timestamped):
    __tablename__ = "skills"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)
    category = db.Column(db.String(60), nullable=False, default="General")
    __table_args__ = (Index("ix_skills_category", "category"),)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "category": self.category}


class StudentSkill(db.Model, Timestamped):
    __tablename__ = "student_skills"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id = db.Column(db.Integer, db.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level = db.Column(db.SmallInteger, nullable=False, default=1)  # 1 beginner, 2 intermediate, 3 advanced
    skill = db.relationship("Skill")
    __table_args__ = (UniqueConstraint("user_id", "skill_id", name="uq_student_skill"),
                      CheckConstraint("level BETWEEN 1 AND 3", name="ck_student_skill_level"))


class Career(db.Model, Timestamped):
    __tablename__ = "careers"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=False)
    opportunities = db.Column(db.Text)
    education_required = db.Column(db.JSON, default=list)   # primary degree/department keywords
    education_related = db.Column(db.JSON, default=list)    # related-field keywords (partial credit)
    interest_keywords = db.Column(db.JSON, default=list)
    work_environments = db.Column(db.JSON, default=list)
    learning_path = db.Column(db.JSON, default=list)        # list of stages (see seed_data.py)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    skills = db.relationship("CareerSkill", back_populates="career", cascade="all, delete-orphan")


class CareerSkill(db.Model):
    __tablename__ = "career_skills"
    id = db.Column(db.Integer, primary_key=True)
    career_id = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False)
    skill_id = db.Column(db.Integer, db.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required_level = db.Column(db.SmallInteger, nullable=False, default=2)
    career = db.relationship("Career", back_populates="skills")
    skill = db.relationship("Skill")
    __table_args__ = (UniqueConstraint("career_id", "skill_id", name="uq_career_skill"),
                      CheckConstraint("required_level BETWEEN 1 AND 3", name="ck_career_skill_level"),
                      Index("ix_career_skills_skill", "skill_id"))


class Assessment(db.Model, Timestamped):
    __tablename__ = "assessments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="completed")
    answers = db.relationship("AssessmentAnswer", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_assessments_user_created", "user_id", "created_at"),)


class AssessmentAnswer(db.Model):
    __tablename__ = "assessment_answers"
    id = db.Column(db.Integer, primary_key=True)
    assessment_id = db.Column(db.Integer, db.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    question_key = db.Column(db.String(60), nullable=False)
    answer = db.Column(db.JSON)
    __table_args__ = (Index("ix_answers_assessment", "assessment_id"),)


class Recommendation(db.Model, Timestamped):
    __tablename__ = "recommendations"
    id = db.Column(db.Integer, primary_key=True)
    assessment_id = db.Column(db.Integer, db.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    career_id = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False)
    rank = db.Column(db.SmallInteger, nullable=False)
    score = db.Column(db.Numeric(5, 2), nullable=False)
    breakdown = db.Column(db.JSON)
    explanation = db.Column(db.JSON)
    missing_skills = db.Column(db.JSON)
    career = db.relationship("Career")
    __table_args__ = (Index("ix_recs_user", "user_id"), Index("ix_recs_career", "career_id"),
                      Index("ix_recs_assessment", "assessment_id"))


class LearningRoadmap(db.Model, Timestamped):
    __tablename__ = "learning_roadmaps"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    career_id = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False)
    career = db.relationship("Career")
    progress = db.relationship("RoadmapProgress", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("user_id", "career_id", name="uq_roadmap_user_career"),)


class RoadmapProgress(db.Model):
    __tablename__ = "roadmap_progress"
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey("learning_roadmaps.id", ondelete="CASCADE"), nullable=False)
    item_key = db.Column(db.String(60), nullable=False)   # e.g. "0:topics:2"
    completed = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    __table_args__ = (UniqueConstraint("roadmap_id", "item_key", name="uq_progress_item"),)


class Course(db.Model, Timestamped):
    __tablename__ = "courses"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    platform = db.Column(db.String(80), nullable=False)
    skill_category = db.Column(db.String(60), nullable=False)
    level = db.Column(db.String(20), nullable=False)  # beginner | intermediate | advanced
    description = db.Column(db.Text)
    url = db.Column(db.String(500), nullable=False)
    resource_type = db.Column(db.String(20), nullable=False, default="course")  # course|certification|resource
    skills = db.Column(db.JSON, default=list)  # skill names this item teaches
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    __table_args__ = (CheckConstraint("level IN ('beginner','intermediate','advanced')", name="ck_course_level"),
                      Index("ix_courses_level", "level"), Index("ix_courses_category", "skill_category"))

    def to_dict(self):
        return {"id": self.id, "title": self.title, "platform": self.platform,
                "skill_category": self.skill_category, "level": self.level, "description": self.description,
                "url": self.url, "resource_type": self.resource_type, "skills": self.skills or [],
                "is_active": self.is_active}


class ChatHistory(db.Model, Timestamped):
    __tablename__ = "chat_history"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = db.Column(db.String(36), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # user | assistant
    message = db.Column(db.Text, nullable=False)
    sources = db.Column(db.JSON)
    __table_args__ = (CheckConstraint("role IN ('user','assistant')", name="ck_chat_role"),
                      Index("ix_chat_user_session", "user_id", "session_id", "created_at"))


class ResumeAnalysis(db.Model, Timestamped):
    __tablename__ = "resume_analysis"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_career_id = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="SET NULL"))
    original_filename = db.Column(db.String(255))
    page_count = db.Column(db.SmallInteger)
    result = db.Column(db.JSON, nullable=False)  # skills, education, keywords, missing skills, suggestions
    target_career = db.relationship("Career")
    __table_args__ = (Index("ix_resume_user", "user_id", "created_at"),)


class SavedCareer(db.Model, Timestamped):
    __tablename__ = "saved_careers"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    career_id = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False)
    career = db.relationship("Career")
    __table_args__ = (UniqueConstraint("user_id", "career_id", name="uq_saved_career"),)
