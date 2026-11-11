import os
from pathlib import Path
from dotenv import load_dotenv

# Get the absolute path to the app/ directory (where __init__.py lives)
basedir = Path(__file__).parent.absolute()

# Load .env from the repo root (one level above app/) if present.
# Existing environment variables take precedence (override=False is the default).
load_dotenv(basedir.parent / '.env')


def _require_env(name):
    """Return a required env var or fail fast with a clear message."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Set it in your .env file (see .env.example)."
        )
    return value


class Config:
    SECRET_KEY = _require_env('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        f"sqlite:///{basedir / 'instance' / 'patients.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ADMIN_USERNAME = _require_env('ADMIN_USERNAME')
    ADMIN_PASSWORD = _require_env('ADMIN_PASSWORD')


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = True  # Show SQL queries in console