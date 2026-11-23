from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)

# In-memory token blocklist for logout (cleared on restart; tokens also expire on their own).
TOKEN_BLOCKLIST: set[str] = set()
