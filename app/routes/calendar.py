from flask import Blueprint, render_template, jsonify, request
from flask_login import login_required, current_user
from app.models import Appointment, Patient, Treatment
from app.enums import AppointmentStatus, TreatmentStatus, UserRole
from datetime import datetime
from app.extensions import db
from app.utils.tooth_helpers import update_tooth_chart_on_completion

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
    
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    query = Appointment.query.join(Patient).filter(
        Appointment.status != AppointmentStatus.DELETED,
        Appointment.status != AppointmentStatus.CANCELLED
    )
    
    if start and end:
        query = query.filter(Appointment.start_time >= start, Appointment.end_time <= end)
    
    if current_user.role.lower() not in [UserRole.ADMIN, UserRole.DENTIST]:
        query = query.filter(Appointment.dentist_id == current_user.id)
    
    appointments = query.all()
    appointments_data = []
    
    for appt in appointments:
        patient = appt.patient
        full_name = f"{patient.first_name} {patient.last_name}"
        
        # NEW: Gather all treatment names for this appointment
        treatment_names = [t.procedure_name for t in appt.treatments.all()]
        display_treatment = ", ".join(treatment_names) if treatment_names else "Consultation"
        treatment_ids = [t.id for t in appt.treatments.all()]  # ✅ ADD THIS LINE

        appointments_data.append({
            'id': appt.id,
            'patient_name': full_name,
            'patient_first_name': patient.first_name,
            'patient_last_name': patient.last_name,
            'start_time': appt.start_time.isoformat(),
            'end_time': appt.end_time.isoformat(),
            'treatment_type': display_treatment, # Kept key name for frontend compatibility
            'treatment_ids': treatment_ids,  # ✅ ADD THIS LINE
            'status': appt.status,
            'dentist_id': appt.dentist_id,
            'patient_id': appt.patient_id,
            'completed_at': appt.completed_at.isoformat() if appt.completed_at else None,
            'color': '#4285F4' if appt.status == AppointmentStatus.SCHEDULED else ('#0F9D58' if appt.status == AppointmentStatus.COMPLETED else '#DB4437'),
            'patient_phone': patient.phone
        })
    
    return jsonify(appointments_data)


@calendar_bp.route('/appointments', methods=['POST'])
@login_required
def create_appointment():
    data = request.get_json()
    print(" RECEIVED PAYLOAD:", data) # DEBUG
    
    try:
        start_time = datetime.strptime(data['start_time'], '%Y-%m-%dT%H:%M:%S')
        end_time = datetime.strptime(data['end_time'], '%Y-%m-%dT%H:%M:%S')
        
        appointment = Appointment(
            dentist_id=current_user.id,
            patient_id=data['patient_id'],
            start_time=start_time,
            end_time=end_time,
            status=AppointmentStatus.SCHEDULED
        )
        db.session.add(appointment)
        
        treatments_to_link = []

        # 1. Link EXISTING planned treatments and mark them as SCHEDULED
        existing_ids = data.get('treatment_ids', [])
        if existing_ids:
            existing_treatments = Treatment.query.filter(Treatment.id.in_(existing_ids)).all()
            for t in existing_treatments:
                # ✅ CRITICAL FIX: Change status from PLANNED to SCHEDULED
                if t.status == TreatmentStatus.PLANNED:
                    t.status = TreatmentStatus.SCHEDULED
            treatments_to_link.extend(existing_treatments)

        # 2. Create and link NEW treatments on the fly
        new_treatment_names = data.get('new_treatments', [])
        print(" NEW TREATMENTS TO CREATE:", new_treatment_names) # DEBUG
        
        for name in new_treatment_names:
            name = name.strip()
            if not name: continue
            
            # Check if it already exists to avoid duplicates
            existing = Treatment.query.filter_by(
                patient_id=data['patient_id'], 
                procedure_name=name
            ).first()
            
            if existing:
                # If it exists but was planned, mark it scheduled
                if existing.status == TreatmentStatus.PLANNED:
                    existing.status = TreatmentStatus.SCHEDULED
                treatments_to_link.append(existing)
                print(f"  ↳ Linked existing treatment: {name}")
            else:
                # Create the new Treatment Plan record
                # ✅ CRITICAL FIX: Set initial status to SCHEDULED instead of PLANNED
                new_t = Treatment(
                    patient_id=data['patient_id'],
                    procedure_name=name,
                    cost=0.0, 
                    status=TreatmentStatus.SCHEDULED 
                )
                db.session.add(new_t)
                db.session.flush() # Get the ID immediately
                treatments_to_link.append(new_t)
                print(f"  ↳ Created NEW treatment: {name}")

        # 3. Attach all treatments to the appointment
        for t in treatments_to_link:
            appointment.treatments.append(t)
            
        db.session.commit()
        print("✅ Appointment and treatments saved successfully!")
        
        patient = Patient.query.get(data['patient_id'])
        treatment_names = [t.procedure_name for t in appointment.treatments.all()]
        
        return jsonify({
            'id': appointment.id,
            'patient_name': f"{patient.first_name} {patient.last_name}",
            'start_time': start_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'end_time': end_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'treatment_type': ", ".join(treatment_names) if treatment_names else "Consultation",
            'patient_phone': patient.phone
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print("❌ ERROR SAVING APPOINTMENT:", str(e)) # DEBUG
        return jsonify({'error': str(e)}), 400

@calendar_bp.route('/patients/<int:patient_id>/planned-treatments')
@login_required
def get_planned_treatments(patient_id):
    # ✅ STRICT FILTER: Only return treatments that are truly 'planned'
    # This prevents scheduled, in-progress, or completed treatments from showing up in the "Add" list
    treatments = Treatment.query.filter_by(
        patient_id=patient_id,
        status='planned'  # <--- THE CRITICAL CHANGE
    ).all()
    
    return jsonify([{
        'id': t.id, 
        'name': t.procedure_name, 
        'tooth': t.tooth_number or 'General', 
        'cost': t.cost,
        'status': t.status
    } for t in treatments])

@calendar_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@login_required
def update_appointment(appointment_id):
    data = request.get_json()
    
    try:
        appointment = Appointment.query.get_or_404(appointment_id)
        new_start = datetime.fromisoformat(data['start_time'])
        new_end = datetime.fromisoformat(data['end_time'])
        
        # 1. Conflict Check
        conflict = Appointment.query.filter(
            Appointment.id != appointment_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.status != AppointmentStatus.DELETED,
            ((Appointment.start_time < new_end) & (Appointment.end_time > new_start))
        ).first()
        
        if conflict:
            conflict_patient = f"{conflict.patient.first_name} {conflict.patient.last_name}"
            return jsonify({
                'error': f'Time conflicts with {conflict_patient}\'s appointment at {conflict.start_time.strftime("%I:%M %p")}'
            }), 400
            
        appointment.start_time = new_start
        appointment.end_time = new_end
        
        # 2. Smart Treatment Linking (The "Scheduled" Logic)
        new_treatment_ids = set(data.get('treatment_ids', []))
        current_treatment_ids = set(t.id for t in appointment.treatments.all())
        
        to_add = new_treatment_ids - current_treatment_ids
        to_remove = current_treatment_ids - new_treatment_ids
        
        # Link new treatments and mark as SCHEDULED
        if to_add:
            treatments_to_link = Treatment.query.filter(Treatment.id.in_(to_add)).all()
            for t in treatments_to_link:
                # ✅ USE THE ENUM HERE
                t.status = TreatmentStatus.SCHEDULED 
            appointment.treatments.extend(treatments_to_link)
        
        # Unlink removed treatments and revert to PLANNED
        if to_remove:
            treatments_to_unlink = Treatment.query.filter(Treatment.id.in_(to_remove)).all()
            for t in treatments_to_unlink:
                # ✅ USE THE ENUM HERE
                t.status = TreatmentStatus.PLANNED
            for t in treatments_to_unlink:
                appointment.treatments.remove(t)
        
        db.session.commit()
        
        # 3. Prepare Response Data
        patient = appointment.patient
        treatment_names = [t.procedure_name for t in appointment.treatments.all()]
        
        return jsonify({
            'id': appointment.id,
            'patient_name': f"{patient.first_name} {patient.last_name}",
            'start_time': appointment.start_time.isoformat(),
            'end_time': appointment.end_time.isoformat(),
            'treatment_type': ", ".join(treatment_names) if treatment_names else "Consultation",
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
            dentist_id=current_user.id
        ).first_or_404()
        
        for t in appointment.treatments.all():
            if t.status == TreatmentStatus.SCHEDULED:
                t.status = TreatmentStatus.PLANNED
        appointment.status = AppointmentStatus.CANCELLED
        appointment.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Appointment cancelled'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/complete', methods=['POST'])
@login_required
def complete_appointment(appointment_id):
    try:
        appointment = Appointment.query.filter_by(
            id=appointment_id,
            dentist_id=current_user.id
        ).first_or_404()
        
        appointment.status = AppointmentStatus.COMPLETED
        appointment.completed_at = datetime.utcnow()
        
        # Auto-mark linked treatments as completed AND update chart
        for treatment in appointment.treatments.all():
            treatment.status = TreatmentStatus.COMPLETED
            
            # 1. Set Clinical Date to match the Appointment Date
            treatment.completed_date = appointment.start_time.date()
            
            # 2. Set Audit Log to the exact moment of clicking
            treatment.admin_completed_at = datetime.utcnow()
            
            # 3. Call the helper if the treatment has a specific tooth number
            if treatment.tooth_number:
                update_tooth_chart_on_completion(treatment)
            
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
    
    # ✅ ULTIMATE SELF-HEAL: Fix stuck 'PLANNED' treatments immediately
    needs_commit = False
    for t in appointment.treatments.all():
        if t.status == TreatmentStatus.PLANNED:
            t.status = TreatmentStatus.SCHEDULED
            needs_commit = True
            
    if needs_commit:
        db.session.commit()
        print(f"🔧 Self-healed {appointment_id}: Changed stuck PLANNED treatments to SCHEDULED")

    # ... [Keep your existing treatments_data serialization here] ...
    treatments_data = [{
        'id': t.id,
        'name': t.procedure_name,
        'tooth': t.tooth_number,
        'status': t.status,
        'cost': t.cost
    } for t in appointment.treatments.all()]

    return jsonify({
        'id': appointment.id,
        'start_time': appointment.start_time.isoformat(),
        'end_time': appointment.end_time.isoformat(),
        'treatment_type': ", ".join([t['name'] for t in treatments_data]) if treatments_data else "Consultation",
        'treatments': treatments_data,       # <--- THIS IS THE MISSING PIECE
        'treatment_ids': [t['id'] for t in treatments_data],
        'status': appointment.status,
        'patient_id': appointment.patient_id,
        'patient_first_name': appointment.patient.first_name,
        'patient_last_name': appointment.patient.last_name,
        'patient_phone': appointment.patient.phone
    })

@calendar_bp.route('/patients/search')
@login_required
def search_patients():
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify([])
    
    search_terms = query.split()
    results = Patient.query
    
    for term in search_terms:
        term_filter = db.or_(
            Patient.first_name.ilike(f'%{term}%'),
            Patient.last_name.ilike(f'%{term}%'),
            Patient.phone.ilike(f'%{term}%'),
            Patient.email.ilike(f'%{term}%')
        )
        results = results.filter(term_filter)
    
    patients = results.limit(20).all()
    
    return jsonify([{
        'id': p.id,
        'first_name': p.first_name,
        'last_name': p.last_name,
        'phone': p.phone,
        'email': p.email
    } for p in patients])