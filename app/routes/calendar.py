from flask import Blueprint, render_template, jsonify, request, abort
from flask_login import login_required, current_user
from app.models import Appointment, Patient, Treatment, TreatmentCatalog, PatientPayment
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
        treatment_names = [t.procedure_name for t in appt.treatments.all()]
        display_treatment = ", ".join(treatment_names) if treatment_names else "Consultation"
        treatment_ids = [t.id for t in appt.treatments.all()]

        appointments_data.append({
            'id': appt.id,
            'patient_name': full_name,
            'patient_first_name': patient.first_name,
            'patient_last_name': patient.last_name,
            'start_time': appt.start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'end_time': appt.end_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'treatment_type': display_treatment, 
            'treatment_ids': treatment_ids,  
            'status': appt.status,
            'dentist_id': appt.dentist_id,
            'patient_id': appt.patient_id,
            'completed_at': appt.completed_at.strftime('%Y-%m-%dT%H:%M:%SZ') if appt.completed_at else None,
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
        # ✅ FIX: Use fromisoformat() to handle ISO 8601 with milliseconds and Z
        # Remove the 'Z' and replace with '+00:00' for Python compatibility
        start_time_str = data['start_time'].replace('Z', '+00:00')
        end_time_str = data['end_time'].replace('Z', '+00:00')
        
        start_time = datetime.fromisoformat(start_time_str)
        end_time = datetime.fromisoformat(end_time_str)
        
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
                if t.status == TreatmentStatus.PLANNED:
                    t.status = TreatmentStatus.SCHEDULED
            treatments_to_link.extend(existing_treatments)

        # 2. Create and link NEW treatments on the fly (Dynamic Rows)
        new_treatments_data = data.get('new_treatments', [])
        print("🆕 NEW TREATMENTS DATA:", new_treatments_data) # DEBUG
        
        for t_data in new_treatments_data:
            name = t_data.get('name', '').strip()
            tooth = t_data.get('tooth', '').strip() if t_data.get('tooth') else None
            cost = float(t_data.get('cost', 0.0))
            
            if not name:
                continue
            
            # Check if a PLANNED treatment with this exact name already exists
            existing = Treatment.query.filter_by(
                patient_id=data['patient_id'], 
                procedure_name=name,
                status=TreatmentStatus.PLANNED.value
            ).first()
            
            if existing:
                if tooth:
                    existing.tooth_number = tooth
                existing.cost = cost 
                existing.status = TreatmentStatus.SCHEDULED
                treatments_to_link.append(existing)
                print(f"  ↳ Linked & Updated existing planned treatment: {name}")
            else:
                new_t = Treatment(
                    patient_id=data['patient_id'],
                    procedure_name=name,
                    tooth_number=tooth,
                    cost=cost, 
                    status=TreatmentStatus.SCHEDULED 
                )
                db.session.add(new_t)
                db.session.flush()
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

@calendar_bp.route('/catalog/search')
@login_required
def search_treatment_catalog():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    
    # Search for procedures matching the query
    results = TreatmentCatalog.query.filter(
        TreatmentCatalog.is_active == True,
        TreatmentCatalog.name.ilike(f'%{query}%')
    ).limit(10).all()
    
    data = []
    for item in results:
        data.append({
            'id': item.id,
            'name': item.name,
            'code': item.code,
            'cotation': item.cotation,
            'default_cost': item.default_price, # Assuming your column is named 'cost'
            'requires_tooth': item.target_type == 'single_tooth' if hasattr(item, 'target_type') else False
        })
    
    return jsonify(data)

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
    print("🔄 UPDATE PAYLOAD:", data)
    
    try:
        appointment = Appointment.query.get_or_404(appointment_id)
        
        # Update basic appointment details
        start_time_str = data['start_time'].replace('Z', '+00:00')
        end_time_str = data['end_time'].replace('Z', '+00:00')
        
        appointment.start_time = datetime.fromisoformat(start_time_str)
        appointment.end_time = datetime.fromisoformat(end_time_str)
        
        # ✅ STEP 0: Handle treatments to unlink (User unchecked them)
        treatments_to_unlink = data.get('treatments_to_unlink', [])
        if treatments_to_unlink:
            print(f"🔗 Unlinking {len(treatments_to_unlink)} treatments")
            for treatment_id in treatments_to_unlink:
                treatment = Treatment.query.get(treatment_id)
                # Check if it exists and is actually linked to this appointment
                if treatment and treatment in appointment.treatments.all():
                    # Revert status back to PLANNED so it shows up in the treatment plan again
                    treatment.status = TreatmentStatus.PLANNED
                    appointment.treatments.remove(treatment)
                    print(f"  ✓ Unlinked treatment: {treatment.procedure_name} (ID: {treatment_id})")
        
        # ✅ STEP 1: Handle new treatments (Quick Add)
        new_treatments_data = data.get('new_treatments', [])
        print(f"🆕 Processing {len(new_treatments_data)} new treatments")
        
        for t_data in new_treatments_data:
            name = t_data.get('name', '').strip()
            tooth = t_data.get('tooth', '').strip() if t_data.get('tooth') else None
            cost = float(t_data.get('cost', 0.0))
            
            if not name:
                continue
            
            # Check if this treatment is already linked to this appointment
            already_linked = False
            for existing_t in appointment.treatments.all():
                if existing_t.procedure_name == name and existing_t.tooth_number == tooth:
                    already_linked = True
                    print(f"  ⚠️ Treatment '{name}' already linked, skipping")
                    break
            
            if already_linked:
                continue
            
            # Check if a PLANNED treatment with this name exists for this patient
            existing_planned = Treatment.query.filter_by(
                patient_id=appointment.patient_id,
                procedure_name=name,
                status=TreatmentStatus.PLANNED.value
            ).first()
            
            if existing_planned:
                # Update the planned treatment and mark as scheduled
                if tooth:
                    existing_planned.tooth_number = tooth
                existing_planned.cost = cost
                existing_planned.status = TreatmentStatus.SCHEDULED
                appointment.treatments.append(existing_planned)
                print(f"  ✓ Linked existing planned treatment: {name} (ID: {existing_planned.id})")
            else:
                # Create a brand new treatment
                new_t = Treatment(
                    patient_id=appointment.patient_id,
                    procedure_name=name,
                    tooth_number=tooth,
                    cost=cost,
                    status=TreatmentStatus.SCHEDULED
                )
                db.session.add(new_t)
                db.session.flush()  # Get the ID immediately
                appointment.treatments.append(new_t)
                print(f"  ✓ Created and linked NEW treatment: {name} (ID: {new_t.id})")
        
        # ✅ STEP 2: Handle treatment_ids from checkboxes (Treatment Plan)
        treatment_ids = data.get('treatment_ids', [])
        if treatment_ids:
            print(f"📋 Linking {len(treatment_ids)} treatments from checkboxes")
            existing_treatments = Treatment.query.filter(Treatment.id.in_(treatment_ids)).all()
            
            for t in existing_treatments:
                if t.status == TreatmentStatus.PLANNED:
                    t.status = TreatmentStatus.SCHEDULED
                if t not in appointment.treatments:
                    appointment.treatments.append(t)
                    print(f"  ✓ Linked treatment from plan: {t.procedure_name} (ID: {t.id})")
        
        # ✅ STEP 3: COMMIT ALL CHANGES
        print("💾 Committing changes to database...")
        db.session.commit()
        print("✅ Appointment updated successfully!")
        
        return jsonify({
            'id': appointment.id,
            'message': 'Appointment updated',
            'treatment_count': len(appointment.treatments.all())
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("❌ ERROR UPDATING APPOINTMENT:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/cancel', methods=['POST'])
@login_required
def cancel_appointment(appointment_id):
    try:
        appointment = Appointment.query.get_or_404(appointment_id)

        # ✅ STEP 1: Revert all linked treatments back to PLANNED status
        for treatment in appointment.treatments.all():
            if treatment.status == TreatmentStatus.SCHEDULED.value:
                treatment.status = TreatmentStatus.PLANNED.value
                print(f"  ↩️ Reverted treatment '{treatment.procedure_name}' to PLANNED")

        # ✅ STEP 2: Soft-cancel the appointment (keeps history for the delete page)
        appointment.status = AppointmentStatus.CANCELLED
        db.session.commit()

        print(f"✅ Appointment {appointment_id} cancelled successfully")

        return jsonify({
            'success': True,
            'message': 'Appointment cancelled'
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR cancelling appointment: {str(e)}")
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/complete', methods=['POST'])
@login_required
def complete_appointment(appointment_id):
    try:
        data = request.get_json()
        treatment_updates = data.get('treatment_statuses', [])
        treatment_payments = data.get('treatment_payments', [])
        total_payment = float(data.get('total_payment', 0))
        payment_method = data.get('payment_method', 'Cash')
        payment_date_str = data.get('payment_date')
        allocation_mode = data.get('allocation_mode', 'waterfall')
        
        appointment = Appointment.query.filter_by(
            id=appointment_id,
            dentist_id=current_user.id
        ).first_or_404()
        
        appointment.status = AppointmentStatus.COMPLETED
        appointment.completed_at = datetime.utcnow()
        
        # 1. Update treatment statuses & VALIDATE
        for update in treatment_updates:
            t_id = update.get('id')
            new_status_str = update.get('status')
            treatment = Treatment.query.get(t_id)
            
            if treatment and treatment in appointment.treatments.all():
                new_status = TreatmentStatus(new_status_str)
                
                # ✅ CRITICAL FIX: Prevent early completion
                if new_status == TreatmentStatus.COMPLETED:
                    # Check if this treatment is linked to any FUTURE appointment for this patient
                    future_appt = Appointment.query.join(Appointment.treatments).filter(
                        Appointment.patient_id == appointment.patient_id,
                        Treatment.id == t_id,
                        Appointment.start_time > appointment.start_time,
                        Appointment.id != appointment.id
                    ).first()
                    
                    if future_appt:
                        # Rollback status changes made in this loop so far
                        db.session.rollback() 
                        return jsonify({
                            'error': f"Cannot complete '{treatment.procedure_name}'. It is scheduled for a future visit on {future_appt.start_time.strftime('%d/%m/%Y')}."
                        }), 400

                treatment.status = new_status
                
                if new_status == TreatmentStatus.COMPLETED:
                    treatment.completed_date = appointment.start_time.date()
                    treatment.admin_completed_at = datetime.utcnow()
                    if treatment.tooth_number:
                        update_tooth_chart_on_completion(treatment)
        
        # 2. Process payments
        if total_payment > 0:
            payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date() if payment_date_str else datetime.now().date()
            remaining = total_payment
            
            if allocation_mode == 'waterfall':
                # A. Apply manual payments specified by user
                for payment in treatment_payments:
                    if remaining <= 0:
                        break
                    t_id = payment.get('treatment_id')
                    amount = payment.get('amount')
                    treatment = Treatment.query.get(t_id)
                    
                    if treatment:
                        # Prevent overpaying a specific treatment manually beyond its balance
                        already_paid = sum(p.amount for p in treatment.payments)
                        balance = (treatment.cost - (treatment.insurance_amount or 0)) - already_paid
                        apply_amount = min(amount, balance)
                        
                        if apply_amount > 0:
                            new_payment = PatientPayment(
                                treatment_id=t_id,
                                amount=apply_amount,
                                method=payment_method,
                                date=payment_date
                            )
                            db.session.add(new_payment)
                            remaining -= apply_amount
                
                # B. Auto-split remaining among COMPLETED treatments
                completed_treatments = [t for t in appointment.treatments.all() 
                                       if t.status == TreatmentStatus.COMPLETED]
                if completed_treatments and remaining > 0:
                    split_amount = remaining / len(completed_treatments)
                    for t in completed_treatments:
                        already_paid = sum(p.amount for p in t.payments)
                        balance = (t.cost - (t.insurance_amount or 0)) - already_paid
                        if balance > 0:
                            apply_amount = min(split_amount, balance)
                            new_payment = PatientPayment(
                                treatment_id=t.id,
                                amount=apply_amount,
                                method=payment_method,
                                date=payment_date
                            )
                            db.session.add(new_payment)
                            remaining -= apply_amount

                # ✅ C. NEW: Apply remaining to IN_PROGRESS treatments (Partial Payment)
                # This prevents creating "Credit" when the user just wants to pay part of an ongoing treatment
                in_progress_treatments = [t for t in appointment.treatments.all() 
                                          if t.status == TreatmentStatus.IN_PROGRESS]
                if in_progress_treatments and remaining > 0:
                    split_amount = remaining / len(in_progress_treatments)
                    for t in in_progress_treatments:
                        already_paid = sum(p.amount for p in t.payments)
                        balance = (t.cost - (t.insurance_amount or 0)) - already_paid
                        if balance > 0:
                            apply_amount = min(split_amount, balance)
                            new_payment = PatientPayment(
                                treatment_id=t.id,
                                amount=apply_amount,
                                method=payment_method,
                                date=payment_date
                            )
                            db.session.add(new_payment)
                            remaining -= apply_amount
            
            else:  # FIFO mode
                all_treatments = Treatment.query.filter_by(
                    patient_id=appointment.patient_id
                ).order_by(Treatment.created_at.asc()).all()
                
                for t in all_treatments:
                    if remaining <= 0:
                        break
                    already_paid = sum(p.amount for p in t.payments)
                    balance = (t.cost - (t.insurance_amount or 0)) - already_paid
                    
                    if balance > 0:
                        apply_amount = min(remaining, balance)
                        new_payment = PatientPayment(
                            treatment_id=t.id,
                            amount=apply_amount,
                            method=payment_method,
                            date=payment_date
                        )
                        db.session.add(new_payment)
                        remaining -= apply_amount
            
            # 3. Handle TRUE overflow (Only if payment exceeds TOTAL cost of all treatments in visit)
            if remaining > 0.01:
                patient = Patient.query.get(appointment.patient_id)
                patient.credit_balance = (patient.credit_balance or 0.0) + remaining
                print(f" Added {remaining} DT to Patient Credit Balance")
        
        db.session.commit()
        return jsonify({'success': True, 'appointment': {'id': appointment.id}})
        
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
    treatments_data = []
    for t in appointment.treatments.all():
        # Calculate total paid for this specific treatment
        paid_amount = sum(p.amount for p in t.payments)
        # Calculate remaining balance (never negative)
        balance = max(0, (t.cost - (t.insurance_amount or 0)) - paid_amount)
        
        # Format payments for the frontend
        payments_list = [{
            'id': p.id,
            'amount': p.amount,
            'method': p.method,
            'date': p.date.strftime('%Y-%m-%d') if p.date else None
        } for p in t.payments]

        treatments_data.append({
            'id': t.id,
            'name': t.procedure_name,
            'tooth': t.tooth_number,
            'status': t.status,
            'cost': t.cost,
            'insurance_amount': t.insurance_amount or 0,
            'paid_amount': paid_amount,
            'balance': balance, # ✅ Frontend can use this directly!
            'payments': payments_list
        })

    return jsonify({
        'id': appointment.id,
        'start_time': appointment.start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'end_time': appointment.end_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'treatment_type': ", ".join([t['name'] for t in treatments_data]) if treatments_data else "Consultation",
        'treatments': treatments_data,       # <--- THIS IS THE MISSING PIECE
        'treatment_ids': [t['id'] for t in treatments_data],
        'status': appointment.status,
        'patient_id': appointment.patient_id,
        'patient_first_name': appointment.patient.first_name,
        'patient_last_name': appointment.patient.last_name,
        'patient_phone': appointment.patient.phone,
        'patient_dob': appointment.patient.date_of_birth.strftime('%Y-%m-%d') if appointment.patient.date_of_birth else None,

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