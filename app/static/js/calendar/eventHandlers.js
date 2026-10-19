import { formatDateForInput, formatTimeForInput } from "./helper.js";
import { completeAppointment, deleteAppointment, createAppointment, updateAppointment } from "./API.js";

// ==========================================
// SMART QUICK ADD LOGIC (Dynamic Rows + Catalog Search)
// ==========================================
window.newTreatmentsList = [];
let searchTimeout;

// 1. Setup Autocomplete Search
const setupQuickAddSearch = () => {
  const quickAddInput = document.getElementById('new-treatment-input');
  const resultsDropdown = document.getElementById('catalog-search-results');

  if (!quickAddInput || !resultsDropdown) return;

  quickAddInput.addEventListener('input', function () {
    const query = this.value.trim();
    clearTimeout(searchTimeout);

    if (query.length < 2) {
      resultsDropdown.style.display = 'none';
      return;
    }

    // Debounce search (wait 300ms after typing stops)
    searchTimeout = setTimeout(async () => {
      try {
        // ✅ CORRECT URL based on your Blueprint('/api') + Route('/catalog/search')
        const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        renderSearchResults(results, quickAddInput, resultsDropdown);
      } catch (error) {
        console.error('Catalog search failed:', error);
      }
    }, 300);
  });

  // Handle "Enter" key for custom treatments (not in catalog)
  quickAddInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const name = this.value.trim();
      if (name) {
        window.newTreatmentsList.push({ name: name, tooth: '', cost: 0.0 });
        this.value = '';
        resultsDropdown.style.display = 'none';
        window.renderNewTreatmentRows();
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!quickAddInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
      resultsDropdown.style.display = 'none';
    }
  });
};

function renderSearchResults(results, inputElement, dropdownElement) {
  dropdownElement.innerHTML = '';

  if (results.length === 0) {
    dropdownElement.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px;">No procedures found. Press Enter to create custom.</div>';
    dropdownElement.style.display = 'block';
    return;
  }

  results.forEach(item => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;';
    div.innerHTML = `
      <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${item.name}</div>
      <div style="font-size: 12px; color: #64748b;">
        ${item.code ? item.code + ' • ' : ''}${item.default_cost.toFixed(2)} DT 
        ${item.requires_tooth ? '• Requires Tooth' : ''}
      </div>
    `;

    div.addEventListener('mouseenter', () => { div.style.background = '#f8fafc'; });
    div.addEventListener('mouseleave', () => { div.style.background = 'white'; });

    div.addEventListener('click', () => {
      // Add to our data array with catalog defaults
      window.newTreatmentsList.push({
        name: item.name,
        tooth: item.requires_tooth ? '' : null, // Empty string if required, null if general
        cost: item.default_cost
      });

      // Clear input and hide dropdown
      inputElement.value = '';
      dropdownElement.style.display = 'none';

      // Re-render rows
      window.renderNewTreatmentRows();
    });

    dropdownElement.appendChild(div);
  });

  dropdownElement.style.display = 'block';
}

// 2. Render the Dynamic Rows
window.renderNewTreatmentRows = function () {
  const container = document.getElementById('new-treatments-rows');
  if (!container) return;
  container.innerHTML = '';

  window.newTreatmentsList.forEach((t, index) => {
    const row = document.createElement('div');
    row.className = 'quick-add-row';
    row.innerHTML = `
      <div class="row-name">${t.name}</div>
      <input type="text" class="row-tooth" placeholder="Tooth" 
             value="${t.tooth || ''}" oninput="window.updateNewTreatment(${index}, 'tooth', this.value)">
      <input type="number" class="row-cost" placeholder="Cost" 
             value="${t.cost}" step="0.01" oninput="window.updateNewTreatment(${index}, 'cost', this.value)">
      <button type="button" class="row-delete" onclick="window.removeNewTreatmentRow(${index})">&times;</button>
    `;
    container.appendChild(row);
  });
};

window.updateNewTreatment = function (index, field, value) {
  if (window.newTreatmentsList[index]) {
    window.newTreatmentsList[index][field] = field === 'cost' ? (parseFloat(value) || 0) : value;
  }
};

window.removeNewTreatmentRow = function (index) {
  window.newTreatmentsList.splice(index, 1);
  window.renderNewTreatmentRows();
};

// Initialize the search listener when DOM is ready
document.addEventListener('DOMContentLoaded', setupQuickAddSearch);
// ==========================================


function initAppointmentForm(context, data = null) {
  const modal = document.getElementById('appointmentModal');
  const form = document.getElementById('appointmentForm');
  const submitBtn = form.querySelector('button[type="submit"]');
  const modalTitle = document.getElementById('appointmentModalTitle');
  const icon = '<i class="bi bi-calendar-plus"></i>';

  const deleteBtn = document.getElementById('deleteAppointmentBtn');
  const completeBtn = document.getElementById('completeAppointmentBtn');

  if (deleteBtn) deleteBtn.style.display = 'none';
  if (completeBtn) completeBtn.style.display = 'none';

  const patientSearchLabel = document.querySelector('label[for="patientSearch"]');
  const patientSearch = document.getElementById('patientSearch');
  const patientSearchContainer = patientSearch.closest('.patient-select-container');
  const patientIdInput = document.getElementById('patientId');
  const patientInfo = document.getElementById('selectedPatientInfo');
  const patientFullName = document.getElementById('patientFullName');
  const patientPhone = document.getElementById('patientPhone');

  form.reset();
  patientSearch.value = '';
  patientIdInput.value = '';
  patientSearchLabel.style.display = 'block';
  patientSearchContainer.style.display = 'block';
  patientInfo.style.display = 'none';

  delete form.dataset.appointmentId;
  delete form.dataset.originalValues;

  // ✅ RESET QUICK ADD ROWS
  window.newTreatmentsList = [];
  if (typeof window.renderNewTreatmentRows === 'function') {
    window.renderNewTreatmentRows();
  }

  const linkedContainer = document.getElementById('linked-treatments-container');
  const plannedContainer = document.getElementById('planned-treatments-list');
  const noLinkedMsg = document.getElementById('no-linked-msg');
  const linkedTitle = document.getElementById('linked-treatments-title');
  const addPlanSection = document.getElementById('section-add-plan');
  const quickAddSection = document.getElementById('section-quick-add');

  if (linkedContainer) linkedContainer.innerHTML = '';
  if (noLinkedMsg) noLinkedMsg.style.display = 'block';

  if (linkedTitle) {
    linkedTitle.innerHTML = 'Linked to this Appointment (Review):';
    linkedTitle.style.color = '#64748b';
  }
  if (addPlanSection) addPlanSection.style.display = 'block';
  if (quickAddSection) quickAddSection.style.display = 'block';

  if (plannedContainer) {
    plannedContainer.innerHTML = '<div class="text-muted small" style="color: #94a3b8; font-size: 12px; text-align: center; padding: 10px; margin: 0;">Select a patient to load plan...</div>';
  }

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

      if (deleteBtn) deleteBtn.style.display = 'inline-block';
      if (completeBtn && data.status === 'scheduled') {
        completeBtn.style.display = 'inline-block';
      }

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

      patientIdInput.value = data.patient_id;
      patientFullName.textContent = `${data.patient_first_name} ${data.patient_last_name}`;
      patientPhone.textContent = data.patient_phone || 'Not provided';
      patientInfo.style.display = 'block';
      patientInfo.style.marginTop = '0';

      document.getElementById('appointmentDate').value = originalData.date;
      document.getElementById('startTime').value = originalData.time;
      document.getElementById('duration').value = originalData.duration;

      form.dataset.appointmentId = data.id;
      form.dataset.originalValues = JSON.stringify(originalData);
      form.dataset.patientId = data.patient_id;

      submitBtn.textContent = 'Update Appointment';
      modalTitle.innerHTML = `${icon} Edit Appointment`;

      if (linkedContainer) linkedContainer.innerHTML = '';
      if (plannedContainer) plannedContainer.innerHTML = '<div class="text-muted small" style="color: #94a3b8; font-size: 12px; text-align: center; padding: 10px; margin: 0;">Loading treatment plan...</div>';
      if (noLinkedMsg) noLinkedMsg.style.display = 'none';

      if (data.status === 'completed') {
        if (addPlanSection) addPlanSection.style.display = 'none';
        if (quickAddSection) quickAddSection.style.display = 'none';
        if (linkedTitle) {
          linkedTitle.innerHTML = '✓ Completed Treatments (Read-Only)';
          linkedTitle.style.color = '#10b981';
        }
      } else {
        if (addPlanSection) addPlanSection.style.display = 'block';
        if (quickAddSection) quickAddSection.style.display = 'block';
        if (linkedTitle) {
          linkedTitle.innerHTML = 'Linked to this Appointment (Review):';
          linkedTitle.style.color = '#64748b';
        }
      }

      if (data.treatments && data.treatments.length > 0) {
        data.treatments.forEach(t => {
          const div = document.createElement('div');
          div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #ffffff; border-left: 4px solid #3b82f6; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';

          let badgeBg = '#e2e8f0';
          let badgeColor = '#475569';
          let badgeText = t.status.toUpperCase();
          let rowIcon = '';

          if (t.status === 'completed') {
            badgeBg = '#d1fae5'; badgeColor = '#065f46'; badgeText = 'COMPLETED'; rowIcon = '✓ ';
          } else if (t.status === 'scheduled') {
            badgeBg = '#dbeafe'; badgeColor = '#1e40af'; badgeText = 'SCHEDULED'; rowIcon = '📅 ';
          } else if (t.status === 'in_progress') {
            badgeBg = '#fef3c7'; badgeColor = '#92400e'; badgeText = 'IN PROGRESS'; rowIcon = '⏳ ';
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
                ${rowIcon}${badgeText}
              </span>
            </div>
          `;
          linkedContainer.appendChild(div);
        });
      } else {
        if (noLinkedMsg) noLinkedMsg.style.display = 'block';
      }

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

  if (typeof window.triggerMutualValidation === 'function') {
    window.triggerMutualValidation();
  }

  modal.style.display = 'flex';
}

function handleTimeSlotClick(e) {
  if (!e.currentTarget.classList.contains('available') || e.currentTarget.classList.contains('disabled')) return;
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
    const response = await fetch(`/api/appointments/${appointmentId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const detailedData = await response.json();
    await initAppointmentForm('edit', detailedData);
  } catch (error) {
    console.error('Error handling edit appointment:', error);
    alert('Failed to load appointment for editing. Please try again.');
  }
}

async function handleDeleteAppointment(appointmentId, appointments, initCalendar) {
  if (!appointmentId) return;
  if (!confirm('Are you sure you want to delete this appointment?')) return false;

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

// ✅ 3. INTERCEPT FORM SUBMISSION TO SEND DYNAMIC ROWS
document.addEventListener('DOMContentLoaded', () => {
  const appointmentForm = document.getElementById('appointmentForm');
  if (appointmentForm) {
    appointmentForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const patientIdInput = document.getElementById('patientId');
      const patientId = patientIdInput.value;

      if (!patientId) {
        alert('⚠️ Please select a patient first.');
        return;
      }

      const submitBtn = appointmentForm.querySelector('.save-btn');
      const originalBtnText = submitBtn.innerHTML;

      // 🔍 DEBUG: Check what the form thinks its ID is
      const currentApptId = appointmentForm.dataset.appointmentId;
      console.log("🔍 DEBUG - Form Dataset ID:", currentApptId);
      console.log("🔍 DEBUG - Button Text:", submitBtn.textContent);

      submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
      submitBtn.disabled = true;

      try {
        const date = document.getElementById('appointmentDate').value;
        const startTime = document.getElementById('startTime').value;
        const duration = parseInt(document.getElementById('duration').value, 10);

        const startDate = new Date(`${date}T${startTime}:00`);
        const endDate = new Date(startDate.getTime() + duration * 60000);

        const checkedBoxes = document.querySelectorAll('#planned-treatments-list input[type="checkbox"]:checked');
        const treatmentIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

        const appointmentData = {
          patient_id: parseInt(patientId, 10),
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          treatment_ids: treatmentIds,
          new_treatments: window.newTreatmentsList || []
        };

        let result;

        // 🔍 DEBUG: The decision point
        if (currentApptId) {
          console.log("🔄 CALLING UPDATE (PUT) for ID:", currentApptId);
          result = await updateAppointment(currentApptId, appointmentData);
        } else {
          console.log("⚠️ CALLING CREATE (POST) because ID is missing!");
          result = await createAppointment(appointmentData);
        }

        if (result) {
          const modal = document.getElementById('appointmentModal');
          if (modal) {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const bsModal = bootstrap.Modal.getInstance(modal);
              if (bsModal) bsModal.hide();
            } else {
              modal.style.display = 'none';
            }
          }

          appointmentForm.reset();
          window.newTreatmentsList = [];
          window.renderNewTreatmentRows();

          if (typeof window.initCalendar === 'function') {
            await window.initCalendar();
          }
        }
      } catch (error) {
        console.error('Failed to save appointment:', error);
        alert('Error saving appointment: ' + error.message);
      } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }
});

export {
  handleTimeSlotClick,
  handleCompleteAppointment,
  handleDeleteAppointment,
  handleEditAppointment,
  initAppointmentForm
}