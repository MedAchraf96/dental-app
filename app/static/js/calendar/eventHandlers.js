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

  // 1. Clear the "New Procedure" tags
  if (typeof window.renderNewTreatmentTags === 'function') {
    window.newTreatmentsList = [];
    window.renderNewTreatmentTags();
  }

  // ✅ CRITICAL FIX: Reset the Treatment UI to "New" state
  const linkedContainer = document.getElementById('linked-treatments-container');
  const plannedContainer = document.getElementById('planned-treatments-list'); // Updated ID
  const noLinkedMsg = document.getElementById('no-linked-msg');
  const linkedTitle = document.getElementById('linked-treatments-title');
  const addPlanSection = document.getElementById('section-add-plan');
  const quickAddSection = document.getElementById('section-quick-add');

  // Reset Containers
  if (linkedContainer) linkedContainer.innerHTML = '';
  if (noLinkedMsg) noLinkedMsg.style.display = 'block'; // Show default "No treatments" message

  // Reset Titles and Visibility
  if (linkedTitle) {
    linkedTitle.innerHTML = 'Linked to this Appointment (Review):';
    linkedTitle.style.color = '#64748b'; // Grey
  }
  if (addPlanSection) addPlanSection.style.display = 'block'; // Show "Add from Plan"
  if (quickAddSection) quickAddSection.style.display = 'block'; // Show "Quick Add"

  // Reset Planned List
  if (plannedContainer) {
    plannedContainer.innerHTML = '<div class="text-muted small" style="color: #94a3b8; font-size: 12px; text-align: center; padding: 10px; margin: 0;">Select a patient to load plan...</div>';
  }

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

      const originalData = {
        date: formatDateForInput(startTime),
        time: formatTimeForInput(startTime),
        duration: duration,
        patient_id: data.patient_id,
        existing_treatments: data.treatment_ids ? [...data.treatment_ids].sort() : [],
        new_treatments: []
      };

      // Populate patient info
      patientIdInput.value = data.patient_id;
      patientFullName.textContent = `${data.patient_first_name} ${data.patient_last_name}`;
      patientPhone.textContent = data.patient_phone || 'Not provided';
      patientInfo.style.display = 'block';
      patientInfo.style.marginTop = '0';

      // Populate date/time fields
      document.getElementById('appointmentDate').value = originalData.date;
      document.getElementById('startTime').value = originalData.time;
      document.getElementById('duration').value = originalData.duration;

      // Store identifiers
      form.dataset.appointmentId = data.id;
      form.dataset.originalValues = JSON.stringify(originalData);
      form.dataset.patientId = data.patient_id;

      // Update UI
      submitBtn.textContent = 'Update Appointment';
      modalTitle.innerHTML = `${icon} Edit Appointment`;

      // ✅ SMART TREATMENT LOADING (Cleaned up)
      if (linkedContainer) linkedContainer.innerHTML = '';
      if (plannedContainer) plannedContainer.innerHTML = '<div class="text-muted small" style="color: #94a3b8; font-size: 12px; text-align: center; padding: 10px; margin: 0;">Loading treatment plan...</div>';
      if (noLinkedMsg) noLinkedMsg.style.display = 'none';

      // 🚨 LOGIC CHECK: Is this appointment already completed?
      if (data.status === 'completed') {
        if (addPlanSection) addPlanSection.style.display = 'none';
        if (quickAddSection) quickAddSection.style.display = 'none';
        if (linkedTitle) {
          linkedTitle.innerHTML = '✓ Completed Treatments (Read-Only)';
          linkedTitle.style.color = '#10b981'; // Green title
        }
      } else {
        if (addPlanSection) addPlanSection.style.display = 'block';
        if (quickAddSection) quickAddSection.style.display = 'block';
        if (linkedTitle) {
          linkedTitle.innerHTML = 'Linked to this Appointment (Review):';
          linkedTitle.style.color = '#64748b'; // Normal grey title
        }
      }

      // 1. Render Linked Treatments
      // 1. Render Linked Treatments (Review Section)
      if (data.treatments && data.treatments.length > 0) {
        data.treatments.forEach(t => {
          const div = document.createElement('div');
          div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #ffffff; border-left: 4px solid #3b82f6; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';

          // ✅ DYNAMIC BADGE LOGIC
          let badgeBg = '#e2e8f0'; // Grey default
          let badgeColor = '#475569';
          let badgeText = t.status.toUpperCase();
          let icon = '';

          if (t.status === 'completed') {
            badgeBg = '#d1fae5'; badgeColor = '#065f46'; badgeText = 'COMPLETED'; icon = '✓ ';
          } else if (t.status === 'scheduled') {
            badgeBg = '#dbeafe'; badgeColor = '#1e40af'; badgeText = 'SCHEDULED'; icon = '📅 '; // Blue for Scheduled
          } else if (t.status === 'in_progress') {
            badgeBg = '#fef3c7'; badgeColor = '#92400e'; badgeText = 'IN PROGRESS'; icon = '⏳ ';
          }

          div.innerHTML = `
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px;">
                ${t.name}
                ${t.tooth ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">Tooth ${t.tooth}</span>` : ''}
              </div>
              <div style="font-size: 12px; color: #64748b;">
                ${t.cost.toFixed(2)} DT
              </div>
            </div>
            <div style="text-align: right;">
              <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                ${icon}${badgeText}
              </span>
            </div>
          `;
          linkedContainer.appendChild(div);
        });
      } else {
        if (noLinkedMsg) noLinkedMsg.style.display = 'block';
      }

      // 2. Render Planned Treatments
      if (typeof window.loadPatientTreatments === 'function') {
        window.loadPatientTreatments(data.patient_id).then(() => {
          setTimeout(() => {
            const checkboxes = document.querySelectorAll('#planned-treatments-list input[type="checkbox"]');
            const linkedIds = data.treatments ? data.treatments.map(t => t.id) : (data.treatment_ids || []);

            checkboxes.forEach(cb => {
              const cbValue = Number(cb.value);
              if (linkedIds.includes(cbValue)) {
                cb.checked = true;
              }
            });
          }, 150);
        });
      }
      break; // <-- ONLY ONE BREAK HERE!

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

  // Use flex so CSS centering works
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

    // ✅ FIX: Add /api to the URL to match your backend route
    const response = await fetch(`/api/appointments/${appointmentId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const detailedData = await response.json();
    console.log("✅ Fetched detailed data:", detailedData);

    await initAppointmentForm('edit', detailedData);

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