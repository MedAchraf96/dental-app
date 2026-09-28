import os
from pathlib import Path

# Get the absolute path to the app/ directory (where __init__.py lives)
basedir = Path(__file__).parent.absolute()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        f"sqlite:///{basedir / 'instance' / 'patients.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = True  # Show SQL queries in console