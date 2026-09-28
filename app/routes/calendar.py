from flask import Blueprint, render_template, jsonify, request,send_from_directory
from flask_login import login_required, current_user
from app.models import Appointment, Patient
from datetime import datetime
from app.extensions import db

calendar_bp = Blueprint('calendar_api', __name__, url_prefix='/api')

@calendar_bp.route('/calendar')
@login_required
def dashboard():
    return render_template('calendar/dashboard.html')

@calendar_bp.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

@calendar_bp.route('/appointments')
@login_required
def get_appointments():
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    # Convert string dates to datetime objects
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    # Base query - exclude deleted appointments
    query = Appointment.query.filter(
        Appointment.status != 'deleted',
        Appointment.status != 'cancelled'  # Also exclude cancelled if needed
    )
    
    # Filter by date range if provided
    if start and end:
        query = query.filter(
            Appointment.start_time >= start,
            Appointment.end_time <= end
        )
    
    # Optional: Filter by current dentist
    query = query.filter_by(dentist_id=current_user.id)
    
    appointments = query.all()
    
    # Format appointments for the calendar
    appointments_data = []
    for appt in appointments:
        patient = appt.patient
        full_name = f"{patient.first_name} {patient.last_name}"
        appointments_data.append({
            'id': appt.id,
            'patient_name': full_name,
            'patient_first_name': patient.first_name,
            'patient_last_name': patient.last_name,
            'start_time': appt.start_time.isoformat(),
            'end_time': appt.end_time.isoformat(),
            'treatment_type': appt.treatment_type,
            'status': appt.status,
            'dentist_id': appt.dentist_id,
            'patient_id': appt.patient_id,
            'completed_at': appt.completed_at.isoformat() if appt.completed_at else None,
            'color': get_status_color(appt.status),
            'patient_phone': patient.phone  # Add this line

        })
    
    return jsonify(appointments_data)

def get_status_color(status):
    """Helper function to determine color based on status"""
    return {
        'scheduled': '#4285F4',  # Blue
        'completed': '#0F9D58',  # Green
        'cancelled': '#DB4437',  # Red
    }.get(status, '#9E9E9E')  # Default gray

@calendar_bp.route('/appointments', methods=['POST'])
@login_required
def create_appointment():
    data = request.get_json()
    
    try:
        # Parse as local time (no timezone conversion)
        start_time = datetime.strptime(data['start_time'], '%Y-%m-%dT%H:%M:%S')
        end_time = datetime.strptime(data['end_time'], '%Y-%m-%dT%H:%M:%S')
        
        # Create appointment
        appointment = Appointment(
            dentist_id=current_user.id,
            patient_id=data['patient_id'],
            start_time=start_time,
            end_time=end_time,
            treatment_type=data['treatment_type']
        )
        
        db.session.add(appointment)
        db.session.commit()
        
        # Get patient full name
        patient = Patient.query.get(data['patient_id'])
        full_name = f"{patient.first_name} {patient.last_name}"
        
        # Return with same time format
        return jsonify({
            'id': appointment.id,
            'patient_name': full_name,
            'patient_first_name': patient.first_name,
            'patient_last_name': patient.last_name,
            'start_time': start_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'end_time': end_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'treatment_type': appointment.treatment_type,
            'patient_phone': patient.phone  # Add this line

        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@calendar_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@login_required
def update_appointment(appointment_id):
    data = request.get_json()
    
    try:
        appointment = Appointment.query.get_or_404(appointment_id)
        new_start = datetime.fromisoformat(data['start_time'])
        new_end = datetime.fromisoformat(data['end_time'])
        
        # Check for conflicts EXCLUDING the current appointment
        # and ignoring cancelled appointments
        conflict = Appointment.query.filter(
            Appointment.id != appointment_id,  # This is the key change
            Appointment.status != 'cancelled',
            ((Appointment.start_time < new_end) & (Appointment.end_time > new_start))
        ).first()
        
        if conflict:
            conflict_patient = f"{conflict.patient.first_name} {conflict.patient.last_name}"
            return jsonify({
                'error': f'Time conflicts with {conflict_patient}\'s appointment at {conflict.start_time.strftime("%I:%M %p")}'
            }), 400
            
        # Proceed with update if no conflicts with other appointments
        appointment.start_time = new_start
        appointment.end_time = new_end
        appointment.treatment_type = data['treatment_type']
        
        db.session.commit()
        
        patient = appointment.patient
        return jsonify({
            'id': appointment.id,
            'patient_name': f"{patient.first_name} {patient.last_name}",
            'start_time': appointment.start_time.isoformat(),
            'end_time': appointment.end_time.isoformat(),
            'treatment_type': appointment.treatment_type,
            'patient_phone': patient.phone
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@login_required
def delete_appointment(appointment_id):
    try:
        appointment = Appointment.query.filter_by(
            id=appointment_id,
            dentist_id=current_user.id  # Ensure owner
        ).first_or_404()
        
        appointment.status = 'cancelled'  # or 'deleted'
        appointment.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Appointment cancelled'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/complete', methods=['POST'])
@login_required
def complete_appointment(appointment_id):
    try:
        appointment = Appointment.query.filter_by(
            id=appointment_id,
            dentist_id=current_user.id  # Ensure owner
        ).first_or_404()
        
        appointment.status = 'completed'
        appointment.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'appointment': {
                'id': appointment.id,
                'status': appointment.status,
                'completed_at': appointment.completed_at.isoformat()
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>', methods=['GET'])
@login_required
def get_appointment(appointment_id):
    appointment = Appointment.query.filter(
        Appointment.id == appointment_id,
        Appointment.dentist_id == current_user.id
    ).first_or_404()
    
    return jsonify({
        'id': appointment.id,
        'start_time': appointment.start_time.isoformat(),
        'end_time': appointment.end_time.isoformat(),
        'treatment_type': appointment.treatment_type,
        'status': appointment.status
    })
@calendar_bp.route('/patients/search')
@login_required
def search_patients():
    query = request.args.get('q', '').strip()
    
    if not query or len(query) < 2:
        return jsonify([])
    
    search_terms = query.split()
    
    # Start with base query
    results = Patient.query
    
    # Build dynamic filters for each term
    for term in search_terms:
        term_filter = db.or_(
            Patient.first_name.ilike(f'%{term}%'),
            Patient.last_name.ilike(f'%{term}%'),
            Patient.phone.ilike(f'%{term}%'),
            Patient.email.ilike(f'%{term}%')
        )
        results = results.filter(term_filter)
    
    # Limit results and execute
    patients = results.limit(20).all()
    
    return jsonify([{
        'id': p.id,
        'first_name': p.first_name,
        'last_name': p.last_name,
        'phone': p.phone,
        'email': p.email
    } for p in patients])