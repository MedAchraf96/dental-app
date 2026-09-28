from flask import Blueprint, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from functools import wraps
from flask_wtf.csrf import validate_csrf, CSRFError
from app.models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        try:
            # Validate CSRF token first
            validate_csrf(request.form.get('csrf_token'))
            
            username = request.form.get('username', '').strip()
            password = request.form.get('password')
            
            if not username or not password:
                flash('Username and password are required', 'error')
                return redirect(url_for('auth.login'))
            
            user = User.query.filter_by(username=username).first()
            
            if user and check_password_hash(user.password, password):
                login_user(user)
                flash('Logged in successfully!', 'success')
                next_page = request.args.get('next')
                return redirect(next_page or url_for('dashboard.dashboard_home'))
            else:
                flash('Invalid username or password', 'error')
                
        except CSRFError:
            flash('Session expired. Please try again.', 'error')
            return redirect(url_for('auth.login'))
        except ValueError as e:
            flash('Authentication system error. Please contact admin.', 'error')
            print(f"Hash error: {str(e)}")
    
    return render_template('auth/login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('auth.login'))

def role_required(role):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('auth.login', next=request.url))
            if current_user.role != role:
                flash('You do not have permission to access this page', 'error')
                return redirect(url_for('dashboard.dashboard_home'))
            return fn(*args, **kwargs)
        return decorated_view
    return wrapper