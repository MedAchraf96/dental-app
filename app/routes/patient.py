from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from sqlalchemy import select, delete, func, or_
from app.models import db, Patient, Appointment, User, ToothRecord, Prosthetic, Treatment,PatientPayment,TreatmentCatalog
from app.enums import AppointmentStatus, TreatmentStatus, ToothState, ProstheticType
from app.utils.tooth_helpers import update_tooth_chart_on_completion
from collections import defaultdict 
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
        
        upcoming_appointments = db.session.scalars(
            select(Appointment)
            .join(User, Appointment.dentist_id == User.id)
            .where(
                Appointment.patient_id == patient_id,
                Appointment.status == AppointmentStatus.SCHEDULED.value,
                Appointment.start_time >= datetime.now()
            )
            .order_by(Appointment.start_time)
        ).all()

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

# ==========================================
# TREATMENTS
# ==========================================

@patient_bp.route('/<int:patient_id>/treatments')
@login_required
def treatments(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        flash('Patient not found!', 'error')
        return redirect(url_for('patient.home'))
    
    patient_treatments = Treatment.query.filter_by(patient_id=patient_id).order_by(Treatment.created_at.desc()).all()
    selected_tooth = request.args.get('tooth')
    catalog = TreatmentCatalog.query.filter_by(is_active=True).order_by(TreatmentCatalog.category, TreatmentCatalog.name).all()
    return render_template(
        'patient/treatments.html',
        patient=patient,
        treatments=patient_treatments,
        selected_tooth=selected_tooth,
        catalog=catalog
    )

@patient_bp.route('/<int:patient_id>/treatments/add', methods=['POST'])
@login_required
def add_treatment(patient_id):
    # ✅ 1. Get the ID from the dropdown instead of raw text
    procedure_id = request.form.get('procedure_id', type=int)
    tooth_number = request.form.get('tooth_number', '').strip()
    cost = request.form.get('cost', 0.0, type=float)
    status = request.form.get('status', TreatmentStatus.PLANNED.value)
    
    # ✅ 2. Fetch the official procedure from the catalog
    catalog_item = TreatmentCatalog.query.get(procedure_id)
    if not catalog_item:
        flash('Invalid procedure selected', 'error')
        return redirect(url_for('patient.treatments', patient_id=patient_id))
    
    # ✅ 3. Create the treatment using the catalog's data
    new_treatment = Treatment(
        patient_id=patient_id,
        tooth_number=tooth_number if tooth_number else None,
        procedure_name=catalog_item.name,       # From catalog
        procedure_code=catalog_item.code,       # From catalog (NEW)
        cotation=catalog_item.cotation,         # From catalog (NEW)
        cost=cost,                              # From form (allows manual override)
        status=status
    )
    
    db.session.add(new_treatment)
    db.session.commit()
    flash(f'Treatment "{catalog_item.name}" added successfully!', 'success')
    return redirect(url_for('patient.treatments', patient_id=patient_id))

@patient_bp.route('/treatments/<int:treatment_id>/update-status', methods=['POST'])
@login_required
def update_treatment_status(treatment_id):
    treatment = Treatment.query.get_or_404(treatment_id)
    new_status = request.form.get('status')
    
    if new_status in [e.value for e in TreatmentStatus]:
        treatment.status = new_status
        
        # ✅ PRO LOGIC: If marking as completed
        if new_status == TreatmentStatus.COMPLETED.value:
            # 1. Record exactly when the button was clicked (Audit Log)
            treatment.admin_completed_at = datetime.utcnow()
            
            # 2. Ensure the Clinical Date is set (default to today if empty)
            if not treatment.completed_date:
                treatment.completed_date = datetime.now().date()
                
            # 3. Update the visual chart if it's a specific tooth
            if treatment.tooth_number:
                update_tooth_chart_on_completion(treatment)
            
        db.session.commit()
        flash('Treatment status updated.', 'success')
    else:
        flash('Invalid status provided!', 'error')

    return redirect(url_for('patient.treatments', patient_id=treatment.patient_id))

@patient_bp.route('/treatments/<int:treatment_id>/delete', methods=['POST'])
@login_required
def delete_treatment(treatment_id):
    treatment = Treatment.query.get_or_404(treatment_id)
    patient_id = treatment.patient_id
    
    # ✅ FIX: Delete associated payments first to avoid the NOT NULL constraint error
    PatientPayment.query.filter_by(treatment_id=treatment_id).delete()
    
    # Now it's safe to delete the treatment
    db.session.delete(treatment)
    db.session.commit()
    
    flash('Treatment and its associated payments removed from plan.', 'success')
    return redirect(url_for('patient.treatments', patient_id=patient_id))
# ==========================================
# FINANCIAL / LEDGER
# ==========================================

@patient_bp.route('/<int:patient_id>/financial')
@login_required
def financial(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        flash('Patient not found!', 'error')
        return redirect(url_for('patient.home'))

    # 1. Get all COMPLETED treatments for the Ledger
    ledger_entries = Treatment.query.filter_by(
        patient_id=patient_id, 
        status='completed'
    ).order_by(Treatment.completed_date.desc()).all()

    # 2. Get all PAYMENTS for this patient (for the Payment History table)
    all_payments = PatientPayment.query.join(Treatment).filter(
        Treatment.patient_id == patient_id
    ).order_by(PatientPayment.date.desc()).all()

    # 3. Get COMPLETED APPOINTMENTS (for the Appointment History table)
    completed_appointments = Appointment.query.filter_by(
        patient_id=patient_id,
        status=AppointmentStatus.COMPLETED
    ).order_by(Appointment.completed_at.desc()).all()

    # Calculate totals
    total_billed = sum(t.cost for t in ledger_entries)
    total_insurance = sum(t.insurance_amount or 0.0 for t in ledger_entries)
    total_paid = sum(p.amount for p in all_payments)
    total_balance = (total_billed - total_insurance) - total_paid

    return render_template(
        'patient/financial.html',
        patient=patient,
        ledger_entries=ledger_entries,
        all_payments=all_payments,       # NEW: For Payment History table
        completed_appointments=completed_appointments, # NEW: For Appt History table
        total_billed=total_billed,
        total_insurance=total_insurance,
        total_paid=total_paid,
        total_balance=total_balance,
        now=datetime.now()
    )

# Add this route right below the financial route to handle the form submission
@patient_bp.route('/<int:patient_id>/financial/add-payment', methods=['POST'])
@login_required
def add_payment(patient_id):
    treatment_id = request.form.get('treatment_id')
    amount = request.form.get('amount', 0, type=float)
    method = request.form.get('method', 'Cash')
    date_str = request.form.get('payment_date')
    
    if not treatment_id or amount <= 0:
        flash('Invalid payment data', 'error')
        return redirect(url_for('patient.financial', patient_id=patient_id))

    payment_date = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else datetime.now().date()

    payment = PatientPayment(
        treatment_id=treatment_id,
        amount=amount,
        method=method,
        date=payment_date
    )
    
    db.session.add(payment)
    db.session.commit()
    flash(f'Payment of {amount} DT recorded successfully', 'success')
    return redirect(url_for('patient.financial', patient_id=patient_id))

# ==========================================
# CHART & API
# ==========================================

@patient_bp.route('/<int:patient_id>/documents')
@login_required
def documents(patient_id):
    return redirect(url_for('patient.profile', patient_id=patient_id))

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
    if state not in [e.value for e in ToothState]:
        return jsonify({'error': f'Invalid tooth state: {state}'}), 400
        
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

@patient_bp.route('/<int:patient_id>/api/prosthetics', methods=['GET'])
@login_required
def get_prosthetics(patient_id):
    prosthetics = Prosthetic.query.filter_by(patient_id=patient_id).all()
    data = [{"id": p.id, "type": p.type, "start": p.start_tooth, "end": p.end_tooth} for p in prosthetics]
    return jsonify(data)

@patient_bp.route('/<int:patient_id>/api/prosthetics', methods=['POST'])
@login_required
def save_prosthetic(patient_id):
    data = request.get_json()
    p_type = data.get('type')
    if not p_type or p_type not in [e.value for e in ProstheticType]:
        return jsonify({'error': f'Invalid prosthetic type: {p_type}'}), 400

    new_prosthetic = Prosthetic(
        patient_id=patient_id,
        type=p_type,
        start_tooth=str(data['start']),
        end_tooth=str(data['end'])
    )
    db.session.add(new_prosthetic)
    db.session.commit()
    return jsonify({"success": True, "id": new_prosthetic.id})

@patient_bp.route('/<int:patient_id>/api/prosthetics/<int:prosthetic_id>', methods=['DELETE'])
@login_required
def delete_prosthetic(patient_id, prosthetic_id):
    prosthetic = Prosthetic.query.get_or_404(prosthetic_id)
    db.session.delete(prosthetic)
    db.session.commit()
    return jsonify({"success": True})

@patient_bp.route('/<int:patient_id>/api/prosthetics', methods=['DELETE'])
@login_required
def delete_all_prosthetics(patient_id):
    Prosthetic.query.filter_by(patient_id=patient_id).delete()
    db.session.commit()
    return jsonify({"success": True})



# ==========================================
# Documents
# ==========================================

@patient_bp.route('/<int:patient_id>/clinical-log')
@login_required
def clinical_log(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        flash('Patient not found!', 'error')
        return redirect(url_for('patient.home'))

    # Fetch ALL treatments sorted by date (oldest first for timeline)
    all_treatments = Treatment.query.filter_by(patient_id=patient_id).order_by(Treatment.created_at.asc()).all()

    # Group treatments by Tooth Number
    tooth_history = defaultdict(list)
    general_history = []

    for t in all_treatments:
        if t.tooth_number:
            tooth_history[t.tooth_number].append(t)
        else:
            general_history.append(t) # Scaling, Consultations, etc.

    return render_template(
        'patient/clinical_log.html',
        patient=patient,
        tooth_history=tooth_history, 
        general_history=general_history
    )