# app/routes/settings.py
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import User,Appointment,ClinicalNote,Patient
from app.enums import UserRole
from app.auth.routes import role_required


settings_bp = Blueprint('settings', __name__, url_prefix='/settings')


@settings_bp.route('/users', methods=['GET'])
@login_required
@role_required('admin')
def users_list():
    """List all users + show the 'add user' form."""
    users = User.query.order_by(User.username.asc()).all()
    return render_template(
        'settings/users.html',
        users=users,
        roles=list(UserRole),   # passed to template for the dropdown
    )


@settings_bp.route('/users/add', methods=['POST'])
@login_required
@role_required('admin')
def add_user():
    """Create a new user account. Password is hashed before saving."""
    name     = (request.form.get('name')     or '').strip()
    username = (request.form.get('username') or '').strip()
    password =  request.form.get('password') or ''
    role     = (request.form.get('role')     or '').strip()

    # --- Validation -----------------------------------------------------
    if not username or not password or not role:
        flash('Username, password and role are required.', 'error')
        return redirect(url_for('settings.users_list'))

    valid_roles = {r.value for r in UserRole}
    if role not in valid_roles:
        flash('Invalid role selected.', 'error')
        return redirect(url_for('settings.users_list'))

    if User.query.filter_by(username=username).first():
        flash(f'Username "{username}" is already taken.', 'error')
        return redirect(url_for('settings.users_list'))

    # --- Create --------------------------------------------------------
    new_user = User(
        username=username,
        password=generate_password_hash(password),
        role=role,
        name=name or None,
    )
    db.session.add(new_user)
    db.session.commit()

    flash(f'User "{username}" created successfully.', 'success')
    return redirect(url_for('settings.users_list'))

@settings_bp.route('/users/<int:user_id>/delete', methods=['POST'])
@login_required
@role_required('admin')
def delete_user(user_id):
    """Delete a user, ensuring we don't break relational data or lock out the system."""
    user = db.session.get(User, user_id)
    
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('settings.users_list'))

    # 1. Prevent self-deletion
    if user.id == current_user.id:
        flash('You cannot delete your own account while logged in.', 'error')
        return redirect(url_for('settings.users_list'))

    # 2. Prevent deleting the last remaining admin
    if user.role == UserRole.ADMIN.value:
        admin_count = User.query.filter_by(role=UserRole.ADMIN.value).count()
        if admin_count <= 1:
            flash('Cannot delete the last remaining administrator.', 'error')
            return redirect(url_for('settings.users_list'))

    # 3. Check for relational dependencies (Data Integrity)
    # If they have appointments, wrote notes, or created patients, we block deletion.
    has_appointments = Appointment.query.filter_by(dentist_id=user.id).first()
    has_notes = ClinicalNote.query.filter_by(author_id=user.id).first()
    has_patients = Patient.query.filter_by(created_by=user.id).first()

    if has_appointments or has_notes or has_patients:
        flash('Cannot delete user: They are linked to existing patients, appointments, or clinical notes.', 'error')
        return redirect(url_for('settings.users_list'))

    # Safe to delete
    username = user.username
    db.session.delete(user)
    db.session.commit()
    
    flash(f'User "{username}" has been deleted.', 'success')
    return redirect(url_for('settings.users_list'))