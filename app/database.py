import os
from werkzeug.security import generate_password_hash
from typing import Optional
from .extensions import db


def initialize_database(app):
    """Initialize the database with app context"""
    with app.app_context():
        db.create_all()
        
        # Create initial admin user if needed
        from .models import User
        if not User.query.first():
            admin = User(
                username='admin',
                password=generate_password_hash('admin123'),
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()  