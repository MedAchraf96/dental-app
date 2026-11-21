from flask import Blueprint, render_template, request, flash, redirect, url_for
from flask_login import login_required, current_user
from app.auth.routes import role_required
from app.models import Appointment, Patient, User, Treatment
from app.enums import AppointmentStatus, UserRole, TreatmentStatus
from datetime import datetime
from app.database import db
import logging
from flask import current_app as app

appointment_bp = Blueprint('appointment', __name__, url_prefix='/appointments')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@appointment_bp.route('/')
@login_required
def list_appointments():
    # Get filter parameters
    page = request.args.get('page', 1, type=int)
    per_page = 10  # or whatever number you prefer

    status_filter = request.args.get('status', 'all')
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    
    # Base query
    query = Appointment.query.join(Patient).join(User, Appointment.dentist_id == User.id)
    
    # Apply filters
    if status_filter != 'all':
        query = query.filter(Appointment.status == status_filter)
    
    if date_from:
        query = query.filter(Appointment.start_time >= datetime.fromisoformat(date_from))
    
    if date_to:
        query = query.filter(Appointment.start_time <= datetime.fromisoformat(date_to))
    
    # For non-Dentist/Admin, only show their own appointments
    if current_user.role.lower() not in [UserRole.DENTIST, UserRole.ADMIN]:
        query = query.filter(
            (Appointment.dentist_id == current_user.id) |
            (Patient.created_by == current_user.id)
        )
    
    # Order by date
    appointments = query.order_by(Appointment.start_time.desc()).all()
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    appointments = pagination.items

    return render_template('appointment/list.html', 
                         appointments=appointments,
                         pagination=pagination,
                         status_filter=status_filter,
                         date_from=date_from,
                         date_to=date_to)


from datetime import datetime

@appointment_bp.route('/appointments/cancel/<int:appointment_id>', methods=['POST'])
@login_required
@role_required('secretary', 'dentist', 'admin')
def cancel_appointment(appointment_id):
    appointment = Appointment.query.get_or_404(appointment_id)

    # ✅ SEC-005 & SEC-006: Role-based authorization
    # Admin and Secretary can cancel any appointment.
    # Dentist can ONLY cancel appointments assigned to them.
    if current_user.role.lower() == UserRole.DENTIST.value:
        if appointment.dentist_id != current_user.id:
            flash('You do not have permission to cancel an appointment assigned to another dentist.', 'error')
            return redirect(url_for('appointment.list_appointments'))

    try:
        # ✅ LOGIC-002 / LOGIC-007: Reconcile treatments before cancelling
        # (Ensures this HTML route behaves identically to the API route in calendar.py)
        for treatment in appointment.treatments.all():
            if treatment.status == TreatmentStatus.SCHEDULED:
                other_active_appt = Appointment.query.join(Appointment.treatments).filter(
                    Treatment.id == treatment.id,
                    Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS]),
                    Appointment.id != appointment.id
                ).first()

                # If no other active appointments exist, revert to planned
                if not other_active_appt:
                    treatment.status = TreatmentStatus.PLANNED

        # Set status to cancelled
        appointment.status = AppointmentStatus.CANCELLED
        appointment.deleted_at = datetime.utcnow()

        db.session.commit()
        flash('Appointment canceled successfully.', 'success')

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error during commit: {e}")
        flash('An error occurred while canceling the appointment.', 'error')

    return redirect(url_for('appointment.list_appointments'))

@appointment_bp.route('/appointments/bulk_hard_delete', methods=['POST'])
@login_required
@role_required('admin')
def bulk_hard_delete_appointment():
    if current_user.role.lower() not in [UserRole.DENTIST, UserRole.ADMIN]:
        flash('You do not have permission to delete appointments.', 'error')
        return redirect(url_for('appointment.list_appointments'))

    appointment_ids = request.form.getlist('appointment_ids')
    
    if not appointment_ids:
        flash('No appointments selected for deletion.', 'warning')
        return redirect(url_for('appointment.list_appointments'))

    success_count = 0
    failure_count = 0

    for appointment_id in appointment_ids:
        try:
            appointment = Appointment.query.get(appointment_id)
            if not appointment:
                failure_count += 1
                continue

            # Verify ownership/admin rights for each appointment
            if appointment.patient_id != current_user.id and current_user.role.lower() != UserRole.ADMIN:
                failure_count += 1
                continue

            db.session.delete(appointment)
            success_count += 1
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting appointment {appointment_id}: {e}")
            failure_count += 1

    try:
        db.session.commit()
        if success_count > 0:
            flash(f'Successfully deleted {success_count} appointment(s).', 'success')
        if failure_count > 0:
            flash(f'Failed to delete {failure_count} appointment(s).', 'warning')
    except Exception as e:
        db.session.rollback()
        flash('An error occurred during bulk deletion.', 'error')

    return redirect(url_for('appointment.list_appointments'))


@appointment_bp.route('/appointments/hard_delete/<int:appointment_id>', methods=['POST'])
@login_required
@role_required('admin')
def hard_delete_appointment(appointment_id):
    # Fetch the appointment
    appointment = Appointment.query.get_or_404(appointment_id)

    # Ensure that the user is authorized to delete this appointment
    if appointment.patient_id != current_user.id and current_user.role.lower() != UserRole.ADMIN:
        flash('You do not have permission to delete this appointment.', 'error')
        return redirect(url_for('appointment.list_appointments'))

    try:
        # Clear the session to ensure no conflicts
        db.session.remove()

        # Add the appointment to the session after clearing it
        db.session.add(appointment)

        # Perform the deletion
        db.session.delete(appointment)
        db.session.commit()
        flash('Appointment deleted successfully.', 'success')

    except Exception as e:
        db.session.rollback()  # Rollback in case of an error
        app.logger.error(f"Error during commit: {e}")
        flash(f"An error occurred: {str(e)}", 'error')

    # Redirect after the deletion
    return redirect(url_for('appointment.list_appointments'))