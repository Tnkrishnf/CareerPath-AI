"""Flask application factory for CareerPath AI."""
import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from config import Config
from extensions import TOKEN_BLOCKLIST, cors, db, jwt, limiter
from utils import ApiError


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    logging.basicConfig(level=logging.INFO)

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    limiter.init_app(app)  # reads RATELIMIT_DEFAULT / RATELIMIT_STORAGE_URI from config

    from routes import all_blueprints
    for bp in all_blueprints:
        app.register_blueprint(bp, url_prefix="/api" + (bp.url_prefix or ""))

    # ---- JWT error responses ----
    @jwt.token_in_blocklist_loader
    def is_revoked(_header, payload):
        return payload["jti"] in TOKEN_BLOCKLIST

    @jwt.unauthorized_loader
    def missing(reason):
        return jsonify(error="Authentication required.", detail=reason), 401

    @jwt.invalid_token_loader
    def invalid(reason):
        return jsonify(error="Invalid token.", detail=reason), 401

    @jwt.expired_token_loader
    def expired(_h, _p):
        return jsonify(error="Session expired. Please log in again."), 401

    @jwt.revoked_token_loader
    def revoked(_h, _p):
        return jsonify(error="Token has been revoked."), 401

    # ---- Error handlers (never leak stack traces) ----
    @app.errorhandler(ApiError)
    def api_error(e):
        body = {"error": e.message}
        if e.details:
            body["details"] = e.details
        return jsonify(body), e.status

    @app.errorhandler(HTTPException)
    def http_error(e):
        messages = {413: "File too large (max 5 MB).", 429: "Too many requests. Please slow down and try again shortly."}
        return jsonify(error=messages.get(e.code, e.description)), e.code

    @app.errorhandler(Exception)
    def unexpected(e):
        app.logger.exception("Unhandled error")
        db.session.rollback()
        return jsonify(error="Something went wrong on the server."), 500

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000, debug=Config.DEBUG_RESET_TOKEN)
