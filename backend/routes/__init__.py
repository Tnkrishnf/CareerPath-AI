from routes.admin import bp as admin_bp
from routes.ai_chat import bp as chat_bp
from routes.auth import bp as auth_bp
from routes.careers import bp as careers_bp
from routes.courses import bp as courses_bp
from routes.dashboard import bp as dashboard_bp
from routes.profile import bp as profile_bp
from routes.resume import bp as resume_bp
from routes.roadmap import bp as roadmap_bp

all_blueprints = [auth_bp, profile_bp, careers_bp, courses_bp, roadmap_bp, resume_bp, chat_bp, dashboard_bp, admin_bp]
