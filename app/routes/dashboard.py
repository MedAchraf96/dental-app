from flask import Blueprint, render_template
from flask_login import login_required, current_user
from datetime import datetime, timedelta, time
from app.models import Patient, Appointment

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
@login_required
def dashboard_home():
    print(f"Current user: {current_user}, Name: {current_user.name}")
    now = datetime.now()
    current_time = now.time()
    
    # After 18:00 (6 PM), show tomorrow's appointments instead
    if current_time >= time(18, 0):
        target_date = now.date() + timedelta(days=1)
        date_label = "tomorrow"
    else:
        target_date = now.date()
        date_label = "today"
    
    # Get appointments for target date
    appointments = Appointment.query.filter(
        Appointment.start_time >= datetime.combine(target_date, time.min),
        Appointment.start_time <= datetime.combine(target_date, time.max),
        Appointment.status != 'cancelled'
    ).order_by(Appointment.start_time).all()
    
    # Check if no appointments
    no_appointments_message = None
    if not appointments:
        no_appointments_message = f"No appointments scheduled for {date_label}"
    
    # Get stats
    stats = {
        'total_patients': Patient.query.count(),
        'appointments': appointments,
        'appointments_date_label': date_label.capitalize() + "'s",
        'upcoming_appointments': Appointment.query.filter(
            Appointment.start_time > now,
            Appointment.status == 'scheduled'
        ).count(),
        'recent_patients': Patient.query.count(),
        'no_appointments_message': no_appointments_message
    }
    
    return render_template('dashboard/home.html', 
        stats=stats,
        user=current_user, 
        now=now,        timedelta=timedelta)