from decimal import Decimal
from flask import Blueprint, render_template, jsonify, request
from flask_login import login_required, current_user
from app.auth.routes import role_required
from app.models import Appointment, Patient, Treatment, TreatmentCatalog, PatientPayment, User
from app.enums import AppointmentStatus, TreatmentStatus, UserRole
from datetime import datetime
from app.extensions import db
from app.utils.tooth_helpers import update_tooth_chart_on_completion

def _resolve_dentist_id(payload_dentist_id=None):
    """Resolve dentist_id for a new appointment.

    - Exactly 1 candidate (dentist or admin) → auto-assign that user.
    - Multiple candidates → require payload_dentist_id, validate it.
    - Zero candidates → error (should not happen; admin seed guarantees 1).
    """
    candidates = User.query.filter(
        User.role.in_([UserRole.DENTIST.value, UserRole.ADMIN.value])
    ).all()
    if not candidates:
        raise ValueError('No dentist or admin users exist.')
    if len(candidates) == 1:
        return candidates[0].id
    if not payload_dentist_id:
        raise ValueError('Multiple dentists exist; dentist_id is required.')
    try:
        chosen = User.query.get(int(payload_dentist_id))
    except (TypeError, ValueError):
        raise ValueError('Invalid dentist_id format.')
    if not chosen or chosen.role not in (UserRole.DENTIST.value, UserRole.ADMIN.value):
        raise ValueError('Invalid dentist_id.')
    return chosen.id

calendar_bp = Blueprint('calendar_api', __name__, url_prefix='/api')

def validate_treatment_transition(current_status: TreatmentStatus, new_status: TreatmentStatus, procedure_name: str):
    """
    ✅ LOGIC-005: Centralized legal state transition validation.
    Prevents arbitrary, illegal, or downgrading status changes during appointment completion.
    """
    # 1. Immutable states: Once completed or cancelled, they cannot be changed via this route
    if current_status == TreatmentStatus.COMPLETED:
        raise ValueError(f"Cannot modify status of already completed treatment: '{procedure_name}'")
    
    if current_status == TreatmentStatus.CANCELLED:
        raise ValueError(f"Cannot modify status of cancelled treatment: '{procedure_name}'")
        
    # 2. Prevent downgrading clinical progress
    if current_status == TreatmentStatus.IN_PROGRESS:
        if new_status in [TreatmentStatus.PLANNED, TreatmentStatus.SCHEDULED, TreatmentStatus.CANCELLED]:
            raise ValueError(f"Cannot downgrade clinical progress for '{procedure_name}' from in_progress to {new_status.value}")
            
    # 3. (Optional but safe) Prevent skipping straight from planned to completed without being scheduled first
    # (Though if it's linked to this appointment, it should be at least 'scheduled')
    if current_status == TreatmentStatus.PLANNED and new_status == TreatmentStatus.COMPLETED:
        # We allow this ONLY if it's a single-visit scenario, but we'll let the future-appt guard handle the complex logic.
        pass 

@calendar_bp.route('/calendar')
@login_required
def dashboard():
    dentists = User.query.filter(
        User.role.in_([UserRole.DENTIST.value, UserRole.ADMIN.value])
    ).order_by(User.name).all()
    return render_template('calendar/dashboard.html', dentists=dentists)

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
    
    if current_user.role.lower() == UserRole.DENTIST.value:
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
@role_required('secretary', 'dentist', 'admin')
def create_appointment():
    data = request.get_json()

    try:
        start_time_str = data['start_time'].replace('Z', '+00:00')
        end_time_str = data['end_time'].replace('Z', '+00:00')
        
        start_time = datetime.fromisoformat(start_time_str)
        end_time = datetime.fromisoformat(end_time_str)
        
        appointment = Appointment(
            dentist_id=_resolve_dentist_id(data.get('dentist_id')),
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
            existing_treatments = Treatment.query.filter(Treatment.id.in_(existing_ids),Treatment.patient_id == data['patient_id'],Treatment.status.in_([TreatmentStatus.PLANNED,TreatmentStatus.IN_PROGRESS,])).all()
            for t in existing_treatments:
                if t.status == TreatmentStatus.PLANNED:
                    t.status = TreatmentStatus.SCHEDULED
            treatments_to_link.extend(existing_treatments)

        # 2. Create and link NEW treatments on the fly (Dynamic Rows)
        new_treatments_data = data.get('new_treatments', [])
      
        for t_data in new_treatments_data:
            name = t_data.get('name', '').strip()
            tooth = t_data.get('tooth', '').strip() if t_data.get('tooth') else None
            cost = Decimal(str(t_data.get('cost', '0.00'))) # <-- Fixed
            
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

        # 3. Attach all treatments to the appointment
        for t in treatments_to_link:
            appointment.treatments.append(t)
            
        db.session.commit()
        
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
            'default_cost': float(item.default_price), # <-- Cast to float for JSON
            'requires_tooth': item.target_type == 'single_tooth' if hasattr(item, 'target_type') else False
        })
    
    return jsonify(data)

@calendar_bp.route('/patients/<int:patient_id>/planned-treatments')
@login_required
def get_planned_treatments(patient_id):
    treatments = Treatment.query.filter_by(
        patient_id=patient_id,
        status='planned'
    ).all()
    
    return jsonify([{
        'id': t.id, 
        'name': t.procedure_name, 
        'tooth': t.tooth_number or 'General', 
        'cost': float(t.cost), # <-- Cast to float for JSON
        'status': t.status
    } for t in treatments])

@calendar_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@login_required
@role_required('secretary', 'dentist', 'admin')
def update_appointment(appointment_id):
    data = request.get_json()

    try:
        # ✅ SEC-006: Scope appointment access by role
        query = Appointment.query.filter(Appointment.id == appointment_id)
        if current_user.role.lower() == UserRole.DENTIST.value:
            query = query.filter(Appointment.dentist_id == current_user.id)
        appointment = query.first_or_404()

        start_time_str = data['start_time'].replace('Z', '+00:00')
        end_time_str = data['end_time'].replace('Z', '+00:00')

        appointment.start_time = datetime.fromisoformat(start_time_str)
        appointment.end_time = datetime.fromisoformat(end_time_str)

        # ✅ LOGIC-004: Atomic final-set reconciliation
        # Reject legacy payload shape
        if 'treatments_to_unlink' in data:
            return jsonify({
                'error': 'Legacy payload format not supported. Send treatment_ids as the final desired set.'
            }), 400

        # Get current linked treatment IDs
        current_treatment_ids = {t.id for t in appointment.treatments.all()}
        
        # Get desired final treatment IDs from payload
        desired_treatment_ids = set(data.get('treatment_ids', []))
        
        # Validate all desired IDs belong to this patient
        if desired_treatment_ids:
            valid_treatments = Treatment.query.filter(
                Treatment.id.in_(desired_treatment_ids),
                Treatment.patient_id == appointment.patient_id
            ).all()
            
            if len(valid_treatments) != len(desired_treatment_ids):
                return jsonify({
                    'error': 'Invalid treatment IDs: some treatments do not belong to this patient'
                }), 400
        
        # Compute additions and removals
        to_add = desired_treatment_ids - current_treatment_ids
        to_remove = current_treatment_ids - desired_treatment_ids
        
        # ✅ Process removals first (with validation)
        if to_remove:
            treatments_to_remove = Treatment.query.filter(Treatment.id.in_(to_remove)).all()
            
            # Block removal of completed/in_progress treatments (industry standard)
            blocked = [t for t in treatments_to_remove 
                      if t.status in [TreatmentStatus.COMPLETED, TreatmentStatus.IN_PROGRESS]]
            
            if blocked:
                blocked_names = [f"{t.procedure_name} (status: {t.status})" for t in blocked]
                return jsonify({
                    'error': f'Cannot remove treatments with status completed or in_progress. '
                            f'Blocked: {", ".join(blocked_names)}. '
                            f'Please reverse the appointment completion first.'
                }), 400
            
            # Apply reconciliation rule for each removal
            for treatment in treatments_to_remove:
                # Only scheduled treatments can be reverted to planned
                if treatment.status == TreatmentStatus.SCHEDULED:
                    # Check if any other active appointment still links this treatment
                    other_active_appt = Appointment.query.join(Appointment.treatments).filter(
                        Treatment.id == treatment.id,
                        Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS]),
                        Appointment.id != appointment.id
                    ).first()
                    
                    # If no other active appointments, revert to planned
                    if not other_active_appt:
                        treatment.status = TreatmentStatus.PLANNED
                
                # Remove the link
                appointment.treatments.remove(treatment)
        
        # ✅ Process additions
        if to_add:
            treatments_to_add = Treatment.query.filter(Treatment.id.in_(to_add)).all()
            
            for treatment in treatments_to_add:
                # Apply scheduling transition: planned → scheduled
                if treatment.status == TreatmentStatus.PLANNED:
                    treatment.status = TreatmentStatus.SCHEDULED
                # in_progress stays in_progress (never downgrade)
                
                # Add the link
                appointment.treatments.append(treatment)
        
        # ✅ Handle new inline treatments (unchanged from current logic)
        new_treatments_data = data.get('new_treatments', [])
        
        for t_data in new_treatments_data:
            name = t_data.get('name', '').strip()
            tooth = t_data.get('tooth', '').strip() if t_data.get('tooth') else None
            cost = Decimal(str(t_data.get('cost', '0.00')))
            
            if not name:
                continue
            
            # Check if already linked (by name + tooth)
            already_linked = any(
                t.procedure_name == name and t.tooth_number == tooth
                for t in appointment.treatments.all()
            )
            
            if already_linked:
                continue
            
            # Check if a PLANNED treatment with this name already exists for this patient
            existing_planned = Treatment.query.filter_by(
                patient_id=appointment.patient_id,
                procedure_name=name,
                status=TreatmentStatus.PLANNED.value
            ).first()
            
            if existing_planned:
                if tooth:
                    existing_planned.tooth_number = tooth
                existing_planned.cost = cost
                existing_planned.status = TreatmentStatus.SCHEDULED
                appointment.treatments.append(existing_planned)
            else:
                new_t = Treatment(
                    patient_id=appointment.patient_id,
                    procedure_name=name,
                    tooth_number=tooth,
                    cost=cost,
                    status=TreatmentStatus.SCHEDULED
                )
                db.session.add(new_t)
                db.session.flush()
                appointment.treatments.append(new_t)
        
        # ✅ Atomic commit
        db.session.commit()
        
        return jsonify({
            'id': appointment.id,
            'message': 'Appointment updated',
            'treatment_count': len(appointment.treatments.all())
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/cancel', methods=['POST'])
@login_required
@role_required('secretary', 'dentist', 'admin')
def cancel_appointment(appointment_id):
    try:
        # ✅ SEC-006: Scope appointment access by role
        query = Appointment.query.filter(Appointment.id == appointment_id)
        if current_user.role.lower() == UserRole.DENTIST.value:
            query = query.filter(Appointment.dentist_id == current_user.id)
        appointment = query.first_or_404()

        # ✅ LOGIC-002: Reconcile treatments before cancelling
        for treatment in appointment.treatments.all():
            # Only evaluate treatments that are currently scheduled
            if treatment.status == TreatmentStatus.SCHEDULED:
                
                # Check if this treatment is linked to ANY OTHER active appointment
                other_active_appt = Appointment.query.join(Appointment.treatments).filter(
                    Treatment.id == treatment.id,
                    Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS]),
                    Appointment.id != appointment.id
                ).first()

                # If NO other active appointments exist, revert to planned
                if not other_active_appt:
                    treatment.status = TreatmentStatus.PLANNED

        # ✅ STEP 2: Soft-cancel the appointment (keeps history)
        appointment.status = AppointmentStatus.CANCELLED
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Appointment cancelled'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>/complete', methods=['POST'])
@login_required
@role_required('dentist', 'admin')
def complete_appointment(appointment_id):
    try:
        data = request.get_json()
        treatment_updates = data.get('treatment_statuses', [])
        treatment_payments = data.get('treatment_payments', [])
        total_payment = Decimal(str(data.get('total_payment', '0.00')))
        payment_method = data.get('payment_method', 'Cash')
        payment_date_str = data.get('payment_date')
        allocation_mode = data.get('allocation_mode', 'waterfall')
        
        # Load appointment with dentist scope
        query = Appointment.query.filter(Appointment.id == appointment_id)
        if current_user.role.lower() == UserRole.DENTIST.value:
            query = query.filter(Appointment.dentist_id == current_user.id)
        appointment = query.first_or_404()
        
        # ✅ SEC-004: Build set of valid treatment IDs for this appointment
        valid_treatment_ids = {t.id for t in appointment.treatments.all()}
        
        # ✅ DATA-007 & LOGIC-005: Validate all treatment updates BEFORE applying any changes
        for update in treatment_updates:
            t_id = update.get('id')
            new_status_str = update.get('status')
            
            # Verify treatment is linked to this appointment
            if t_id not in valid_treatment_ids:
                return jsonify({'error': f'Treatment {t_id} is not linked to this appointment'}), 400
            
            treatment = Treatment.query.get(t_id)
            current_status = TreatmentStatus(treatment.status)
            
            try:
                new_status = TreatmentStatus(new_status_str)
            except ValueError:
                return jsonify({'error': f'Invalid status value provided: {new_status_str}'}), 400
            
            # ✅ LOGIC-005: Enforce legal state transitions
            try:
                validate_treatment_transition(current_status, new_status, treatment.procedure_name)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
            
            # Validate future appointment guard (existing logic)
            if new_status == TreatmentStatus.COMPLETED:
                future_appt = Appointment.query.join(Appointment.treatments).filter(
                    Appointment.patient_id == appointment.patient_id,
                    Treatment.id == t_id,
                    Appointment.start_time > appointment.start_time,
                    Appointment.id != appointment.id,
                    Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS])
                ).first()
                
                if future_appt:
                    return jsonify({
                        'error': f"Cannot complete '{treatment.procedure_name}'. It is scheduled for a future visit on {future_appt.start_time.strftime('%d/%m/%Y')}."
                    }), 400
        
        # ✅ DATA-007: Validate all payment allocations BEFORE applying
        if total_payment > 0:
            for payment in treatment_payments:
                t_id = payment.get('treatment_id')
                if t_id not in valid_treatment_ids:
                    return jsonify({'error': f'Payment allocation references treatment {t_id} which is not linked to this appointment'}), 400
        
        # ✅ All validation passed — now apply changes atomically
        
        # 1. Mark appointment as completed
        appointment.status = AppointmentStatus.COMPLETED
        appointment.completed_at = datetime.utcnow()
        
        # 2. Update treatment statuses (Safe, because pre-flight validation passed)
        for update in treatment_updates:
            t_id = update.get('id')
            new_status_str = update.get('status')
            treatment = Treatment.query.get(t_id)
            new_status = TreatmentStatus(new_status_str)
            
            treatment.status = new_status
            
            if new_status == TreatmentStatus.COMPLETED:
                treatment.completed_date = appointment.start_time.date()
                treatment.admin_completed_at = datetime.utcnow()
                if treatment.tooth_number:
                    update_tooth_chart_on_completion(treatment)
        
        # 3. Process payments
        if total_payment > 0:
            payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date() if payment_date_str else datetime.now().date()
            remaining = total_payment
            
            if allocation_mode == 'waterfall':
                # A. Apply manual payments specified by user
                for payment in treatment_payments:
                    if remaining <= 0:
                        break
                    t_id = payment.get('treatment_id')
                    amount = Decimal(str(payment.get('amount', '0.00')))
                    treatment = Treatment.query.get(t_id)
                    
                    if treatment and treatment.id in valid_treatment_ids:
                        already_paid = sum((p.amount for p in treatment.payments), Decimal('0.00'))
                        balance = (treatment.cost - (treatment.insurance_amount or Decimal('0.00'))) - already_paid
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
                    split_amount = remaining / Decimal(str(len(completed_treatments)))
                    for t in completed_treatments:
                        already_paid = sum((p.amount for p in t.payments), Decimal('0.00'))
                        balance = (t.cost - (t.insurance_amount or Decimal('0.00'))) - already_paid
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

                # C. Apply remaining to IN_PROGRESS treatments (Partial Payment)
                in_progress_treatments = [t for t in appointment.treatments.all() 
                                          if t.status == TreatmentStatus.IN_PROGRESS]
                if in_progress_treatments and remaining > 0:
                    split_amount = remaining / Decimal(str(len(in_progress_treatments)))
                    for t in in_progress_treatments:
                        already_paid = sum((p.amount for p in t.payments), Decimal('0.00'))
                        balance = (t.cost - (t.insurance_amount or Decimal('0.00'))) - already_paid
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
                    already_paid = sum((p.amount for p in t.payments), Decimal('0.00'))
                    balance = (t.cost - (t.insurance_amount or Decimal('0.00'))) - already_paid
                    
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
            
            # ✅ Handle overflow with Decimal comparison
            if remaining > Decimal('0.01'):
                patient = Patient.query.get(appointment.patient_id)
                patient.credit_balance = (patient.credit_balance or Decimal('0.00')) + remaining
        
        db.session.commit()
        return jsonify({'success': True, 'appointment': {'id': appointment.id}})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@calendar_bp.route('/appointments/<int:appointment_id>', methods=['GET'])
@login_required
def get_appointment(appointment_id):
    query = Appointment.query.filter(Appointment.id == appointment_id)
    if current_user.role.lower() == UserRole.DENTIST.value:
        query = query.filter(Appointment.dentist_id == current_user.id)
    appointment = query.first_or_404()
    treatments_data = []
    for t in appointment.treatments.all():
        # Calculate total paid for this specific treatment
        paid_amount = sum((p.amount for p in t.payments), Decimal('0.00')) # <-- Fixed
        # Calculate remaining balance (never negative)
        balance = max(Decimal('0.00'), (t.cost - (t.insurance_amount or Decimal('0.00'))) - paid_amount) # <-- Fixed
        
        # Format payments for the frontend
        payments_list = [{
            'id': p.id,
            'amount': float(p.amount), # <-- Cast to float for JSON
            'method': p.method,
            'date': p.date.strftime('%Y-%m-%d') if p.date else None
        } for p in t.payments]

        treatments_data.append({
            'id': t.id,
            'name': t.procedure_name,
            'tooth': t.tooth_number,
            'status': t.status,
            'cost': float(t.cost), # <-- Cast to float for JSON
            'insurance_amount': float(t.insurance_amount or 0), # <-- Cast to float for JSON
            'paid_amount': float(paid_amount), # <-- Cast to float for JSON
            'balance': float(balance), # <-- Cast to float for JSON
            'payments': payments_list
        })

    return jsonify({
        'id': appointment.id,
        'start_time': appointment.start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'end_time': appointment.end_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'treatment_type': ", ".join([t['name'] for t in treatments_data]) if treatments_data else "Consultation",
        'treatments': treatments_data, 
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