import { formatDateForInput, formatTimeForInput } from "./helper.js";
import { completeAppointment, deleteAppointment } from "./API.js";

function initAppointmentForm(context, data = null) {
  const modal = document.getElementById('appointmentModal');
  const form = document.getElementById('appointmentForm');
  const submitBtn = form.querySelector('button[type="submit"]');
  const modalTitle = document.getElementById('appointmentModalTitle');
  const icon = '<i class="bi bi-calendar-plus"></i>';

  // Get modal footer buttons
  const deleteBtn = document.getElementById('deleteAppointmentBtn');
  const completeBtn = document.getElementById('completeAppointmentBtn');

  // Hide action buttons by default
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (completeBtn) completeBtn.style.display = 'none';

  // Get all patient-related elements
  const patientSearchLabel = document.querySelector('label[for="patientSearch"]');
  const patientSearch = document.getElementById('patientSearch');
  const patientSearchContainer = patientSearch.closest('.patient-select-container');
  const patientIdInput = document.getElementById('patientId');
  const patientInfo = document.getElementById('selectedPatientInfo');
  const patientFullName = document.getElementById('patientFullName');
  const patientPhone = document.getElementById('patientPhone');

  // Reset form and show all patient search elements by default
  form.reset();
  patientSearch.value = '';
  patientIdInput.value = '';
  patientSearchLabel.style.display = 'block';
  patientSearchContainer.style.display = 'block';
  patientInfo.style.display = 'none';

  // Clear any previous data
  delete form.dataset.appointmentId;
  delete form.dataset.originalValues;

  // Set form based on context
  switch (context) {
    case 'new':
      const now = new Date();
      let defaultDate = new Date();
      if (defaultDate.getDay() === 0) {
        defaultDate.setDate(defaultDate.getDate() + 1);
      }

      document.getElementById('appointmentDate').value = formatDateForInput(defaultDate);
      document.getElementById('startTime').value = '09:00';
      document.getElementById('duration').value = '30';
      submitBtn.textContent = 'Add Appointment';
      modalTitle.innerHTML = `${icon} New Appointment`;
      break;

    case 'edit':
      if (!data) return;

      // Show action buttons in edit mode
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
      if (completeBtn && data.status === 'scheduled') {
        completeBtn.style.display = 'inline-block';
      }

      // Hide the search field completely during edits
      patientSearchLabel.style.display = 'none';
      patientSearchContainer.style.display = 'none';

      const startTime = new Date(data.start_time);
      const endTime = new Date(data.end_time);
      const duration = Math.round((endTime - startTime) / 60000);

      // Store original values for comparison
      const originalData = {
        date: formatDateForInput(startTime),
        time: formatTimeForInput(startTime),
        duration: duration,
        patient_id: data.patient_id,
        treatment: data.treatment_type
      };

      // Populate patient info (show prominently in edit mode)
      patientIdInput.value = data.patient_id;
      patientFullName.textContent = `${data.patient_first_name} ${data.patient_last_name}`;
      patientPhone.textContent = data.patient_phone || 'Not provided';
      patientInfo.style.display = 'block';
      patientInfo.style.marginTop = '0'; // Remove extra margin since search is hidden

      // Populate other fields
      document.getElementById('appointmentDate').value = originalData.date;
      document.getElementById('startTime').value = originalData.time;
      document.getElementById('duration').value = originalData.duration;
      document.getElementById('treatmentType').value = originalData.treatment;

      // Store identifiers
      form.dataset.appointmentId = data.id;
      form.dataset.originalValues = JSON.stringify(originalData);
      form.dataset.patientId = data.patient_id;

      // Update UI
      submitBtn.textContent = 'Update Appointment';
      modalTitle.innerHTML = `${icon} Edit Appointment`;
      break;

    case 'timeslot':
      if (!data) return;

      document.getElementById('appointmentDate').value = formatDateForInput(data);
      document.getElementById('startTime').value = formatTimeForInput(data);
      document.getElementById('duration').value = '30';
      submitBtn.textContent = 'Add Appointment';
      modalTitle.innerHTML = `${icon} New Appointment`;
      break;
  }

  // Trigger mutual validation to sync dropdowns
  if (typeof window.triggerMutualValidation === 'function') {
    window.triggerMutualValidation();
  }

  // Use flex so CSS centering (align-items/justify-content) works
  modal.style.display = 'flex';
}

function handleTimeSlotClick(e) {
  if (!e.currentTarget.classList.contains('available') ||
    e.currentTarget.classList.contains('disabled')) return;

  const slotDate = new Date(e.currentTarget.dataset.date);
  initAppointmentForm('timeslot', slotDate);
}



async function handleCompleteAppointment(appointmentId, initCalendar) {
  if (!appointmentId) return;

  try {
    const result = await completeAppointment(appointmentId);
    if (result) {
      await initCalendar();
      return true;
    }
  } catch (error) {
    console.error('Error completing appointment:', error);
    alert('Failed to complete appointment');
  }
  return false;
}

async function handleEditAppointment(appointmentId, appointments) {
  try {
    if (!appointmentId) return;

    const appt = appointments[appointmentId];
    if (!appt) {
      console.error('Appointment not found');
      return;
    }

    await initAppointmentForm('edit', {
      ...appt,
      id: appointmentId
    });

  } catch (error) {
    console.error('Error handling edit appointment:', error);
    alert('Failed to load appointment for editing. Please try again.');
  }
}

async function handleDeleteAppointment(appointmentId, appointments, initCalendar) {
  if (!appointmentId) return;

  if (!confirm('Are you sure you want to delete this appointment?')) {
    return false;
  }

  try {
    const result = await deleteAppointment(appointmentId);

    if (result) {
      delete appointments[appointmentId];
      await initCalendar();
      return true;
    }
  } catch (error) {
    console.error('Error deleting appointment:', error);
    alert('Failed to delete appointment. Please try again.');
  }
  return false;
}

export {
  handleTimeSlotClick,
  handleCompleteAppointment,
  handleDeleteAppointment,
  handleEditAppointment,
  initAppointmentForm
}