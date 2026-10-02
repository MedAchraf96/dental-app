from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from sqlalchemy import select, delete, func, or_
from app.models import db, Patient, Appointment, User, ToothRecord

patient_bp = Blueprint('patient', __name__, url_prefix='/patients')

@patient_bp.route("/")
@login_required
def home():
    try:
        search_query = request.args.get('search', '').strip()
        
        if search_query:
            stmt = select(Patient).where(
                or_(
                    func.concat(Patient.first_name, ' ', Patient.last_name).ilike(f'%{search_query}%'),
                    Patient.phone.ilike(f'%{search_query}%'),
                    Patient.email.ilike(f'%{search_query}%')
                )
            ).order_by(Patient.last_name, Patient.first_name)
        else:
            stmt = select(Patient).order_by(Patient.last_name, Patient.first_name)
            
        patients = db.session.execute(stmt).scalars().all()
        return render_template("patient/list.html", patients=patients, search_query=search_query)
    except Exception as e:
        current_app.logger.error(f"Error fetching patients: {str(e)}")
        flash('Error loading patient records', 'error')
        return redirect(url_for('dashboard.dashboard_home'))

@patient_bp.route("/add", methods=["GET"])
@login_required
def add_patient():
    return render_template("patient/edit.html", patient=None)

@patient_bp.route("/add", methods=["POST"])
@login_required
def add_patient_route():
    try:
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        
        if not first_name or not last_name:
            flash('First name and last name are required', 'error')
            return redirect(url_for('patient.add_patient'))
            
        dob = request.form.get("date_of_birth")
        dob_date = datetime.strptime(dob, '%Y-%m-%d').date() if dob else None
        
        new_patient = Patient(
            first_name=first_name,
            last_name=last_name,
            date_of_birth=dob_date,
            phone=request.form.get("phone", ""),
            email=request.form.get("email", ""),
            gender=request.form.get("gender", ""),
            insurance_provider=request.form.get("insurance_provider", ""),
            allergies=request.form.get("allergies", ""),
            medical_history=request.form.get("medical_history", ""),
            notes=request.form.get("notes", ""),
            created_by=current_user.id
        )
        
        db.session.add(new_patient)
        db.session.commit()
        flash('Patient added successfully!', 'success')
        return redirect(url_for('patient.profile', patient_id=new_patient.id))
        
    except ValueError as ve:
        db.session.rollback()
        flash(f'Invalid data format: {str(ve)}', 'error')
        return redirect(url_for('patient.add_patient'))
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding patient: {str(e)}")
        flash('Error adding patient!', 'error')
        return redirect(url_for('patient.add_patient'))

@patient_bp.route('/<int:patient_id>')
@login_required
def profile(patient_id):
    try:
        patient = db.session.get(Patient, patient_id)
        if not patient:
            flash('Patient not found!', 'error')
            return redirect(url_for('patient.home'))
        
        # Get upcoming appointments
        upcoming_appointments = db.session.scalars(
            select(Appointment)
            .join(User, Appointment.dentist_id == User.id)
            .where(
                Appointment.patient_id == patient_id,
                Appointment.status == 'scheduled',
                Appointment.start_time >= datetime.now()
            )
            .order_by(Appointment.start_time)
            
        ).all()
        # Add this to your route for debugging
        current_time = datetime.now()
        print(f"Current time: {current_time}")
        print(f"First appointment time: {db.session.scalar(select(Appointment.start_time).limit(1))}")
        print(f"DEBUG - Upcoming Appointments: {upcoming_appointments}")  # Add this line

        return render_template(
            'patient/profile.html',
            patient=patient,
            upcoming_appointments=upcoming_appointments,
            now=datetime.now()
        )
    except Exception as e:
        current_app.logger.error(f"Error loading patient profile {patient_id}: {str(e)}")
        flash('Error loading patient profile', 'error')
        return redirect(url_for('patient.home'))
    
@patient_bp.route('/<int:id>/edit', methods=['GET'])
@login_required
def edit_patient(id):
    try:
        patient = db.session.get(Patient, id)
        if not patient:
            flash('Patient not found!', 'error')
            return redirect(url_for('patient.home'))
        
        return render_template(
            'patient/edit.html',
            patient=patient,
            formatted_dob=patient.date_of_birth.strftime('%Y-%m-%d') if patient.date_of_birth else ''
        )
    except Exception as e:
        current_app.logger.error(f"Error loading patient {id}: {str(e)}")
        flash('Error loading patient record', 'error')
        return redirect(url_for('patient.home'))

@patient_bp.route('/<int:id>/update', methods=['POST'])
@login_required
def update_patient(id):
    try:
        patient = db.session.get(Patient, id)
        if not patient:
            flash('Patient not found!', 'error')
            return redirect(url_for('patient.home'))
            
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        
        if not first_name or not last_name:
            flash('First name and last name are required', 'error')
            return redirect(url_for('patient.edit_patient', id=id))
            
        dob = request.form.get("date_of_birth")
        try:
            patient.first_name = first_name
            patient.last_name = last_name
            patient.date_of_birth = datetime.strptime(dob, '%Y-%m-%d').date() if dob else None
            patient.phone = request.form.get("phone", "")
            patient.email = request.form.get("email", "")
            patient.gender = request.form.get("gender", "")
            patient.insurance_provider = request.form.get("insurance_provider", "")
            patient.allergies = request.form.get("allergies", "")
            patient.medical_history = request.form.get("medical_history", "")
            patient.notes = request.form.get("notes", "")
            
            db.session.commit()
            flash('Patient updated successfully!', 'success')
        except ValueError as ve:
            db.session.rollback()
            flash(f'Invalid date format: {str(ve)}', 'error')
            return redirect(url_for('patient.edit_patient', id=id))
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating patient {id}: {str(e)}")
        flash('Error updating patient!', 'error')
    return redirect(url_for('patient.profile', patient_id=id))

@patient_bp.route('/<int:id>/delete', methods=['POST'])
@login_required
def delete_patient(id):
    try:
        patient = db.session.get(Patient, id)
        if patient:
            try:
                db.session.execute(
                    delete(Appointment).where(Appointment.patient_id == id)
                )
                db.session.delete(patient)
                db.session.commit()
                flash('Patient and all appointments deleted!', 'success')
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error deleting patient {id}: {str(e)}")
                flash('Error deleting patient and associated data', 'error')
        else:
            flash('Patient not found!', 'error')
    except Exception as e:
        current_app.logger.error(f"Error in delete operation: {str(e)}")
        flash('An error occurred', 'error')
    return redirect(url_for('patient.home'))

@patient_bp.route('/<int:patient_id>/treatments')
@login_required
def treatments(patient_id):
    return redirect(url_for('patient.home'))

@patient_bp.route('/<int:patient_id>/financial')
@login_required
def financial(patient_id):
    return redirect(url_for(''))

@patient_bp.route('/<int:patient_id>/documents')
@login_required
def documents(patient_id):
    return redirect(url_for('patient.home'))


@patient_bp.route('/<int:patient_id>/teeth-chart')
@login_required
def teeth_chart(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        flash('Patient not found!', 'error')
        return redirect(url_for('patient.home'))
    return render_template('patient/teeth_chart.html', patient=patient)

@patient_bp.route('/<int:patient_id>/api/teeth-chart', methods=['GET'])
@login_required
def get_teeth_chart(patient_id):
    records = ToothRecord.query.filter_by(patient_id=patient_id).all()
    # Return a dictionary like {"11": "filled", "48": "missing"}
    data = {r.tooth_number: r.state for r in records}
    return jsonify(data)

@patient_bp.route('/<int:patient_id>/api/teeth-chart', methods=['POST'])
@login_required
def save_teeth_chart(patient_id):
    data = request.get_json()
    tooth_number = str(data.get('tooth_number'))
    state = data.get('state')
    
    if not tooth_number or not state:
        return jsonify({'error': 'Missing data'}), 400
        
    record = ToothRecord.query.filter_by(patient_id=patient_id, tooth_number=tooth_number).first()
    if record:
        record.state = state
    else:
        record = ToothRecord(patient_id=patient_id, tooth_number=tooth_number, state=state)
        db.session.add(record)
    
    db.session.commit()
    return jsonify({'success': True, 'tooth': tooth_number, 'state': state})

@patient_bp.route('/<int:patient_id>/api/teeth-chart', methods=['DELETE'])
@login_required
def reset_teeth_chart(patient_id):
    ToothRecord.query.filter_by(patient_id=patient_id).delete()
    db.session.commit()
    return jsonify({'success': True, 'message': 'All teeth reset to healthy'})