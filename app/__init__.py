from flask import Flask, url_for, redirect
from pathlib import Path
import os
from .extensions import db, login_manager, migrate, cors
from .config import DevelopmentConfig, basedir
from flask_wtf.csrf import CSRFProtect
import logging
from logging.handlers import RotatingFileHandler  # Add this import


def create_app(config_class=DevelopmentConfig):
    app = Flask(__name__, template_folder='templates',instance_path=str(Path(__file__).parent / 'instance'),
)
    app.config.from_object(config_class)
    
    # app.config['SECRET_KEY'] = 'your-very-secret-key-here'  # Change this!
    # app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(
    #     os.path.abspath(os.path.dirname(__file__)), 
    #     'instance', 
    #     'patients.db'
    # )    
    # app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    csrf = CSRFProtect(app)

    # Configure instance folder
    configure_instance_folder(app)
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Setup database
    initialize_database(app)
    

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    )
    
    # File handler (optional)
    file_handler = RotatingFileHandler('appointments.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.DEBUG)
    app.logger.addHandler(file_handler)
    
    app.logger.setLevel(logging.DEBUG)
    app.logger.info('Appointment Management Startup')


    return app

def configure_instance_folder(app):
    """Ensure instance folder exists with proper permissions"""
    instance_path = Path(app.instance_path)
    try:
        instance_path.mkdir(parents=True, exist_ok=True)
        if os.name == 'nt':  # Windows
            os.chmod(instance_path, 0o777)
        print(f"✓ Instance folder ready at: {instance_path}")
    except Exception as e:
        print(f"⚠️ Error creating instance folder: {e}")
        raise

def initialize_extensions(app):
    """Initialize Flask extensions"""
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)

    
    @login_manager.user_loader
    def load_user(user_id):
        from .models import User
        return db.session.get(User, int(user_id))

def register_blueprints(app):
    """Register all blueprints with URL prefixes"""
    from .auth.routes import auth_bp
    from .routes.patient import patient_bp
    from .routes.calendar import calendar_bp
    from .routes.dashboard import dashboard_bp
    from .routes.appointment import appointment_bp
    from .routes.finance import finance_bp
    # Register with URL prefixes
    app.register_blueprint(auth_bp)
    app.register_blueprint(patient_bp) 
    app.register_blueprint(calendar_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(appointment_bp)
    app.register_blueprint(finance_bp)

    # Add root route
    @app.route('/')
    def index():
        return redirect(url_for('dashboard.dashboard_home'))

def initialize_database(app):
    """Initialize database with sample data"""
    with app.app_context():
        try:
            # 1. Ensure instance directory exists
            instance_path = Path(app.instance_path)
            instance_path.mkdir(exist_ok=True, parents=True)
            
            # 2. Create all tables
            db.create_all()
            print(f"✓ Database initialized at: {app.config['SQLALCHEMY_DATABASE_URI']}")
            
            from .models import User
            from werkzeug.security import generate_password_hash
            
            # 3. Check for existing admin user more robustly
            admin = User.query.filter_by(username='admin').first()
            
            if admin:
                print(f"✓ Admin user exists (ID: {admin.id}, Role: {admin.role})")
            else:
                try:
                    # 4. Create new admin with additional details
                    new_admin = User(
                        username='admin',
                        password=generate_password_hash('admin123'),
                        role='admin',
                        name='System Administrator'
                    )
                    db.session.add(new_admin)
                    db.session.commit()
                    print("✓ Admin user created successfully")
                    print(f"   Username: admin")
                    print(f"   Password: admin123 (change this immediately)")
                except Exception as create_error:
                    db.session.rollback()
                    print(f"⚠️ Failed to create admin user: {create_error}")
                    raise
                
        except Exception as e:
            print(f"⚠️ Database initialization failed: {str(e)}")
            db.session.rollback()
            raise