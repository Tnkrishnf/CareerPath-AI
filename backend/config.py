"""Central configuration. All secrets come from environment variables (.env)."""
import os
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-please-32b")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_HOURS", "12")))
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/careerpath_ai"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]

    GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:5000/api/auth/github/callback")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB upload cap (resume PDFs)
    MAX_PDF_PAGES = 10

    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "none").lower()
    LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

    AI_RATE_LIMIT = os.getenv("AI_RATE_LIMIT", "20 per minute")
    DEFAULT_RATE_LIMIT = os.getenv("DEFAULT_RATE_LIMIT", "300 per hour")
    RATELIMIT_DEFAULT = DEFAULT_RATE_LIMIT
    RATELIMIT_STORAGE_URI = "memory://"

    DEBUG_RESET_TOKEN = os.getenv("FLASK_ENV", "development") == "development"


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    LLM_PROVIDER = "none"
    RATELIMIT_ENABLED = False
    DEBUG_RESET_TOKEN = True
