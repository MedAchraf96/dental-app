import { formatDateForInput, formatTimeForInput } from "./helper.js";
import { cancelAppointment, createAppointment, updateAppointment } from "./API.js";

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
      const timeInputsNew = document.getElementById('appt-time-inputs');
      const timeReadonlyNew = document.getElementById('appt-time-readonly');
      if (timeInputsNew) timeInputsNew.style.display = 'flex';
      if (timeReadonlyNew) timeReadonlyNew.style.display = 'none';
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

      // ✅ 1. MOVED TO TOP: Define Date objects first so they can be used anywhere below
      const startTime = new Date(data.start_time);
      const endTime = new Date(data.end_time);
      const duration = Math.round((endTime - startTime) / 60000);

      // 2. Button visibility logic
      if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = async () => {
          const appointmentId = form.dataset.appointmentId;
          if (await handleCancelAppointment(appointmentId)) {
            modal.style.display = 'none';
          }
        };
      }

      if (completeBtn) {
        if (data.status !== 'completed') {
          completeBtn.style.display = 'inline-block';
          completeBtn.onclick = async (e) => {
            e.preventDefault(); // Prevent default form behavior
            const appointmentId = form.dataset.appointmentId;
            if (appointmentId) {
              // Open the new granular modal instead of completing instantly
              await openGranularModal(appointmentId);
            }
          };
        } else {
          completeBtn.style.display = 'none';
        }
      }

      // ✅ 3. Swap between Form Inputs and Read-Only Text
      const timeInputsContainer = document.getElementById('appt-time-inputs');
      const timeReadonlyContainer = document.getElementById('appt-time-readonly');
      const completedTimeText = document.getElementById('completed-time-text');

      if (data.status === 'completed') {
        if (timeInputsContainer) timeInputsContainer.style.display = 'none';
        if (timeReadonlyContainer) timeReadonlyContainer.style.display = 'block';

        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };

        // Now these work perfectly because startTime/endTime are defined at the top!
        const formattedDate = startTime.toLocaleDateString('en-US', dateOptions);
        const formattedStart = startTime.toLocaleTimeString('en-US', timeOptions);
        const formattedEnd = endTime.toLocaleTimeString('en-US', timeOptions);

        if (completedTimeText) {
          completedTimeText.innerHTML = `
            <i class="bi bi-calendar-check-fill" style="color: #10b981; margin-right: 8px; font-size: 18px;"></i>
            ${formattedDate} &bull; ${formattedStart} - ${formattedEnd}
          `;
        }
      } else {
        if (timeInputsContainer) timeInputsContainer.style.display = 'flex';
        if (timeReadonlyContainer) timeReadonlyContainer.style.display = 'none';
      }

      // 4. Hide patient search for editing
      patientSearchLabel.style.display = 'none';
      patientSearchContainer.style.display = 'none';

      // 5. Populate original data and form fields
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

      // 6. Setup treatment containers
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

      // 7. Render linked treatments (WITH CHECKBOXES FOR SCHEDULED)
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

          // ✅ NEW: Add checkbox ONLY for scheduled treatments so they can be unchecked/removed
          const checkboxHtml = t.status === 'scheduled' ? `
            <input type="checkbox" class="linked-treatment-cb" value="${t.id}" checked
                   style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer; accent-color: #ef4444;">
          ` : '';

          div.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
              ${checkboxHtml}
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px;">
                  ${t.name}
                  ${t.tooth ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">Tooth ${t.tooth}</span>` : ''}
                </div>
                <div style="font-size: 12px; color: #64748b;">
                  ${t.cost.toFixed(2)} DT
                </div>
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

      // 8. Load planned treatments and check linked boxes
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
      const timeInputsTs = document.getElementById('appt-time-inputs');
      const timeReadonlyTs = document.getElementById('appt-time-readonly');
      if (timeInputsTs) timeInputsTs.style.display = 'flex';
      if (timeReadonlyTs) timeReadonlyTs.style.display = 'none';


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

async function openGranularModal(appointmentId) {
  const modal = document.getElementById('granularCompleteModal');
  const listContainer = document.getElementById('gp-treatments-list');

  if (!modal || !listContainer) return;

  modal.style.display = 'flex';
  listContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="bi bi-hourglass-split"></i> Loading...</div>';
  document.getElementById('gp-payment-date').value = new Date().toISOString().split('T')[0];

  try {
    const response = await fetch(`/api/appointments/${appointmentId}?include_patient=true&include_payments=true`);
    const appt = await response.json();

    // ✅ 1. Fetch patient details to get the actual balance
    let patientBalance = 0;
    if (appt.patient_id) {
      try {
        const patientRes = await fetch(`/patients/${appt.patient_id}/financial-summary`);
        if (patientRes.ok) {
          const patientData = await patientRes.json();
          patientBalance = patientData.total_balance || 0;

          // ✅ Populate Future Plan in header
          const futureEl = document.getElementById('gp-card-future');
          if (futureEl) {
            const futureSum = patientData.future_plan_sum || 0;
            futureEl.textContent = `${futureSum.toFixed(2)} DT`;
            futureEl.style.color = futureSum > 0 ? '#fbbf24' : 'white';
          }
        }
      } catch (e) {
        console.error('Could not fetch patient balance:', e);
      }
    }

    let allOutstandingTreatments = [];
    try {
      const outRes = await fetch(`/patients/${appt.patient_id}/outstanding-treatments?exclude_appointment_id=${appointmentId}`); if (outRes.ok) {
        allOutstandingTreatments = await outRes.json();
      }
    } catch (e) {
      console.error('Could not fetch outstanding treatments', e);
    }

    // Store it on the window so updateAllocationPreview can see it
    window.currentOutstandingTreatments = allOutstandingTreatments;
    window.currentApptTreatments = appt.treatments; // Keep track of c
    // ✅ 2. Robust Age Calculation
    let ageDisplay = '-';
    if (appt.patient_dob) {
      try {
        const dobDate = new Date(appt.patient_dob);
        if (!isNaN(dobDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - dobDate.getFullYear();
          const m = today.getMonth() - dobDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            age--;
          }
          ageDisplay = age;
        }
      } catch (e) {
        console.warn('Age calculation failed', e);
      }
    }

    // ✅ 3. Calculate Visit Balance
    let visitBalance = 0;
    if (appt.treatments && appt.treatments.length > 0) {
      for (const t of appt.treatments) {
        const paid = t.payments ? t.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const balance = Math.round((Math.max(0, (t.cost - (t.insurance_amount || 0)) - paid)) * 100) / 100;
        visitBalance += balance;
      }
    }

    // ✅ 4. Simple Data Binding (Update static HTML elements)
    document.getElementById('gp-card-name').querySelector('span').textContent =
      `${appt.patient_first_name || ''} ${appt.patient_last_name || ''}`.trim() || 'Unknown Patient';

    document.getElementById('gp-card-dob').querySelector('span').textContent =
      `${appt.patient_dob ? new Date(appt.patient_dob).toLocaleDateString('en-GB') : 'N/A'} (${ageDisplay} yrs)`;

    const balanceEl = document.getElementById('gp-card-balance');
    if (patientBalance > 0) {
      balanceEl.textContent = `+${patientBalance.toFixed(2)} DT (Crédit)`;
      balanceEl.style.color = '#86efac';
    } else if (patientBalance < 0) {
      balanceEl.textContent = `${patientBalance.toFixed(2)} DT`;
      balanceEl.style.color = '#fca5a5';
    } else {
      balanceEl.textContent = '0.00 DT';
      balanceEl.style.color = 'white';
    }

    document.getElementById('gp-card-visit').textContent = `${visitBalance.toFixed(2)} DT`;

    // ✅ 5. Render Treatments
    listContainer.innerHTML = '';
    if (appt.treatments && appt.treatments.length > 0) {
      for (const t of appt.treatments) {
        const paid = t.payments ? t.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const balance = Math.round((Math.max(0, (t.cost - (t.insurance_amount || 0)) - paid)) * 100) / 100;

        const row = document.createElement('div');
        row.className = 'gp-treatment-row';
        row.dataset.treatmentId = t.id;
        row.dataset.balance = balance;

        // ✅ NEW: Store details for the preview
        row.dataset.name = t.name;
        row.dataset.tooth = t.tooth || '-';
        // Use the appointment date for the treatment date
        row.dataset.date = appt.start_time ? new Date(appt.start_time).toLocaleDateString('en-GB') : '-';
        row.style.cssText = 'background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;';
        row.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${t.name}
                ${t.tooth ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">Tooth ${t.tooth}</span>` : ''}
                <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 400;">Current: ${t.status.toUpperCase()}</span>
              </div>
            </div>
            <div style="text-align: right; min-width: 100px;">
              <div style="font-size: 0.7rem; color: #64748b;">Balance:</div>
              <div style="font-size: 1rem; font-weight: 700; color: #ef4444;">${balance.toFixed(2)} DT</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.8rem;">
                <input type="radio" name="status-${t.id}" value="in_progress" 
                       ${t.status === 'in_progress' || t.status === 'scheduled' ? 'checked' : ''} 
                       onchange="window.updateAllocationPreview()">
                <span>In Progress</span>
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.8rem;">
                <input type="radio" name="status-${t.id}" value="completed" 
                       ${t.status === 'completed' ? 'checked' : ''}
                       onchange="window.updateAllocationPreview()">
                <span>✅ Completed</span>
              </label>
            </div>
            
            <div style="flex: 1; min-width: 150px; position: relative;">
              <input type="number" class="gp-treatment-payment" data-treatment-id="${t.id}" 
                     data-balance="${balance}" step="0.01" min="0" max="${balance}"
                     placeholder="Manual payment (auto-split if blank)" 
                     style="width: 100%; padding: 6px 40px 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;"
                     oninput="window.updateAllocationPreview()">
              <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem; font-weight: 600;">DT</span>
            </div>
          </div>
        `;
        listContainer.appendChild(row);
      }
    } else {
      listContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748b;">No treatments linked to this appointment.</div>';
    }

    // ✅ 6. Set initial payment value and attach listeners safely
    const totalPaymentInput = document.getElementById('gp-total-payment');
    if (totalPaymentInput) {
      totalPaymentInput.value = visitBalance > 0 ? visitBalance.toFixed(2) : '0';

      // Remove old listeners to prevent duplicates
      totalPaymentInput.removeEventListener('input', window.updateAllocationPreview);
      totalPaymentInput.addEventListener('input', window.updateAllocationPreview);
    }

    document.querySelectorAll('input[name="allocation-mode"]').forEach(radio => {
      radio.removeEventListener('change', window.updateAllocationPreview);
      radio.addEventListener('change', window.updateAllocationPreview);
    });

    // Trigger initial preview
    window.updateAllocationPreview();

  } catch (error) {
    console.error("Error in openGranularModal:", error);
    listContainer.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 20px;">Error loading appointment data</div>';
  }
}

window.updateAllocationPreview = function () {
  const totalPayment = parseFloat(document.getElementById('gp-total-payment')?.value) || 0;
  const mode = document.querySelector('input[name="allocation-mode"]:checked')?.value || 'waterfall';
  const summaryDiv = document.getElementById('gp-allocation-summary');
  const summaryItems = document.getElementById('gp-summary-items');

  if (!summaryDiv || !summaryItems) return;

  const treatmentRows = document.querySelectorAll('.gp-treatment-row');
  let remaining = totalPayment;
  let displayList = [];

  // Helper to parse date
  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(0);
  };

  // 1. Build a unified list of all items (Current + History)
  let allItems = [];

  // Add Current Visit Items
  treatmentRows.forEach(row => {
    const treatmentId = parseInt(row.dataset.treatmentId);
    const balance = parseFloat(row.dataset.balance);
    const paymentInput = row.querySelector('.gp-treatment-payment');
    const userAmount = paymentInput ? parseFloat(paymentInput.value) || 0 : 0;

    allItems.push({
      id: treatmentId,
      name: row.dataset.name,
      tooth: row.dataset.tooth,
      date: row.dataset.date,
      balance: balance,
      manualPay: userAmount,
      source: 'current'
    });
  });

  // Add History Items
  if (window.currentOutstandingTreatments) {
    window.currentOutstandingTreatments.forEach(t => {
      allItems.push({
        id: t.id,
        name: t.name,
        tooth: t.tooth || '-',
        date: t.date,
        balance: t.balance,
        manualPay: 0,
        source: 'history'
      });
    });
  }

  // 2. Sort the list based on Mode
  if (mode === 'fifo') {
    // FIFO: Oldest debts first (History + Current mixed by date)
    allItems.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  } else {
    // Waterfall: Current Visit first, then History (Oldest first)
    let currentItems = allItems.filter(i => i.source === 'current');
    let historyItems = allItems.filter(i => i.source === 'history').sort((a, b) => parseDate(a.date) - parseDate(b.date));
    allItems = [...currentItems, ...historyItems];
  }

  // 3. Allocate Money (Do NOT stop when remaining is 0)
  for (const item of allItems) {
    let payAmount = 0;

    if (item.manualPay > 0) {
      // Respect manual input
      payAmount = Math.min(item.manualPay, item.balance);
      remaining -= payAmount;
    } else {
      // Auto-allocate from remaining pool
      if (remaining > 0) {
        payAmount = Math.min(remaining, item.balance);
        remaining -= payAmount;
      }
    }

    displayList.push({
      ...item,
      paidNow: payAmount
    });
  }

  // 4. Render the List
  if (displayList.length > 0) {
    summaryDiv.style.display = 'block';

    const listHtml = displayList.map(a => {
      // Determine style based on whether it's being paid
      const isPaid = a.paidNow > 0;
      const amountColor = isPaid ? '#10b981' : '#94a3b8'; // Green if paid, Gray if unpaid
      const amountText = isPaid ? `${a.paidNow.toFixed(2)} DT` : `Unpaid (${a.balance.toFixed(2)} DT)`;

      // Add a subtle background for unpaid items to make them distinct
      const rowBg = isPaid ? 'transparent' : '#f8fafc';

      return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; background: ${rowBg}; border-radius: 4px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: ${isPaid ? '#1e293b' : '#64748b'}; font-size: 0.85rem;">
            ${a.name} ${!isPaid ? '<span style="font-size:0.7em; color:#ef4444; margin-left:5px;">(OUTSTANDING)</span>' : ''}
          </div>
          <div style="font-size: 0.75rem; color: #64748b;">
            <i class="bi bi-calendar3"></i> ${a.date} &nbsp;|&nbsp; <i class="bi bi-droplet-fill"></i> Tooth ${a.tooth}
          </div>
        </div>
        <div style="font-weight: 700; font-size: 0.95rem; color: ${amountColor}; text-align: right;">
          ${amountText}
        </div>
      </div>
    `}).join('');

    // Credit Overflow Message
    const creditHtml = remaining > 0.01
      ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 2px dashed #e2e8f0; color: #10b981; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
           <i class="bi bi-check-circle-fill"></i> +${remaining.toFixed(2)} DT to Patient Credit
         </div>`
      : '';

    summaryItems.innerHTML = listHtml + creditHtml;
  } else {
    summaryDiv.style.display = 'none';
  }
};

window.closeGranularModal = function () {
  const modal = document.getElementById('granularCompleteModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

async function handleCompleteAppointment(appointmentId) {
  const treatmentStatuses = [];
  const treatmentPayments = [];

  document.querySelectorAll('.gp-treatment-row').forEach(row => {
    const treatmentId = parseInt(row.dataset.treatmentId);
    const statusRadio = row.querySelector(`input[name="status-${treatmentId}"]:checked`);
    const status = statusRadio ? statusRadio.value : 'in_progress';
    const paymentInput = row.querySelector('.gp-treatment-payment');
    const paymentAmount = paymentInput ? parseFloat(paymentInput.value) || 0 : 0;

    treatmentStatuses.push({ id: treatmentId, status });

    // Only add to treatment_payments if user manually entered an amount
    if (paymentAmount > 0) {
      treatmentPayments.push({ treatment_id: treatmentId, amount: paymentAmount });
    }
  });

  const totalPayment = parseFloat(document.getElementById('gp-total-payment').value) || 0;
  const paymentMethod = document.getElementById('gp-payment-method').value;
  const paymentDate = document.getElementById('gp-payment-date').value;
  const allocationMode = document.querySelector('input[name="allocation-mode"]:checked').value;

  const submitBtn = document.getElementById('submitGranularBtn');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
  submitBtn.disabled = true;

  try {
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';

    const response = await fetch(`/api/appointments/${appointmentId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({
        treatment_statuses: treatmentStatuses,
        treatment_payments: treatmentPayments,
        total_payment: totalPayment,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        allocation_mode: allocationMode
      })
    });

    const result = await response.json();

    if (result.success) {
      window.closeGranularModal();
      document.getElementById('appointmentModal').style.display = 'none';
      if (typeof window.initCalendar === 'function') await window.initCalendar();
      return true;
    } else {
      alert('Error: ' + result.error);
      return false;
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to complete appointment');
    return false;
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

function handleTimeSlotClick(e) {
  if (!e.currentTarget.classList.contains('available') || e.currentTarget.classList.contains('disabled')) return;
  const slotDate = new Date(e.currentTarget.dataset.date);
  initAppointmentForm('timeslot', slotDate);
}

async function handleCancelAppointment(appointmentId) {
  if (!appointmentId) return false;
  if (!confirm('Are you sure you want to cancel this appointment?')) return false;

  try {
    const result = await cancelAppointment(appointmentId);
    if (result) {
      if (typeof window.initCalendar === 'function') {
        await window.initCalendar();
      }
      return true;
    }
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    alert('Failed to cancel appointment. Please try again.');
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

// ✅ 3. INTERCEPT FORM SUBMISSION TO SEND DYNAMIC ROWS (MERGED & FIXED)
document.addEventListener('DOMContentLoaded', () => {
  const appointmentForm = document.getElementById('appointmentForm');
  if (!appointmentForm) return;

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

    const currentApptId = appointmentForm.dataset.appointmentId;

    // ✅ 1. Gather treatment data
    const checkedPlannedBoxes = document.querySelectorAll('#planned-treatments-list input[type="checkbox"]:checked');
    const existingIds = Array.from(checkedPlannedBoxes).map(cb => parseInt(cb.value));
    const newTreatments = window.newTreatmentsList || [];

    // ✅ NEW: Count already-linked treatments that are STILL checked
    const checkedLinkedBoxes = document.querySelectorAll('.linked-treatment-cb:checked');
    const remainingLinkedIds = Array.from(checkedLinkedBoxes).map(cb => parseInt(cb.value));
    let continuedTreatmentId = null;
    if (appointmentForm.dataset.continue_treatment_id) {
      continuedTreatmentId = parseInt(appointmentForm.dataset.continue_treatment_id);
    }

    // ✅ 2. Validate: Must have patient AND at least one treatment total
    const totalTreatments = remainingLinkedIds.length + existingIds.length + newTreatments.length + (continuedTreatmentId ? 1 : 0);

    if (totalTreatments === 0) {
      alert('Please choose at least one treatment or add a new procedure.');
      return;
    }

    // ✅ 3. Find treatments to unlink (those that were originally linked but are now unchecked)
    const allLinkedCheckboxes = document.querySelectorAll('.linked-treatment-cb');
    const treatmentsToUnlink = Array.from(allLinkedCheckboxes)
      .filter(cb => !cb.checked)
      .map(cb => parseInt(cb.value));

    // ✅ 4. Prevent saving if nothing changed (Updated to include unlinked treatments)
    if (currentApptId && appointmentForm.dataset.originalValues) {
      const currentValues = JSON.stringify({
        date: document.getElementById('appointmentDate').value,
        time: document.getElementById('startTime').value,
        duration: document.getElementById('duration').value,
        patient_id: patientId,
        existing_treatments: [...existingIds].sort(),
        new_treatments: [...newTreatments].sort(),
        unlinked_treatments: [...treatmentsToUnlink].sort() // ✅ Added so unchecking counts as a change!
      });

      if (currentValues === appointmentForm.dataset.originalValues) {
        alert('No changes detected. Appointment not updated.');
        document.getElementById('appointmentModal').style.display = 'none';
        return;
      }
    }
    // ✅ 4. Build payload
    const date = document.getElementById('appointmentDate').value;
    const startTime = document.getElementById('startTime').value;
    const duration = parseInt(document.getElementById('duration').value, 10);

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    // ✅ NEW: Include the continued treatment ID if it exists
    let finalTreatmentIds = [...existingIds];
    if (continuedTreatmentId) {
      finalTreatmentIds.push(continuedTreatmentId);
    }

    const appointmentData = {
      patient_id: parseInt(patientId, 10),
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      treatment_ids: finalTreatmentIds,
      new_treatments: newTreatments,
      treatments_to_unlink: treatmentsToUnlink
    };

    // ✅ 5. UI Feedback: Disable button
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    submitBtn.disabled = true;

    try {
      // ✅ 6. Send to backend (NO 'result' variable needed!)
      if (currentApptId) {
        console.log("🔄 CALLING UPDATE (PUT) for ID:", currentApptId);
        await updateAppointment(currentApptId, appointmentData);
      } else {
        console.log("⚠️ CALLING CREATE (POST)");
        await createAppointment(appointmentData);
      }

      // ✅ 7. SUCCESS! (This runs unconditionally if no error is thrown)
      const modal = document.getElementById('appointmentModal');
      if (modal) modal.style.display = 'none';

      appointmentForm.reset();
      window.newTreatmentsList = [];
      if (typeof window.renderNewTreatmentRows === 'function') {
        window.renderNewTreatmentRows();
      }

      // ✅ 8. FORCE CALENDAR REFRESH
      if (typeof window.initCalendar === 'function') {
        console.log("🔄 Refreshing calendar...");
        await window.initCalendar();
      }

    } catch (error) {
      console.error('Failed to save appointment:', error);
      alert('Error saving appointment: ' + error.message);
    } finally {
      // ✅ 9. Always re-enable the button, even if it failed
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  });
});

function initGranularModalListeners() {
  // 1. Connect the "Finalize & Save" button
  const submitGranularBtn = document.getElementById('submitGranularBtn');
  if (submitGranularBtn) {
    // Remove old listeners to prevent duplicates if called multiple times
    submitGranularBtn.replaceWith(submitGranularBtn.cloneNode(true));
    const newBtn = document.getElementById('submitGranularBtn');

    newBtn.addEventListener('click', async function () {
      const form = document.getElementById('appointmentForm');
      const appointmentId = form ? form.dataset.appointmentId : null;
      if (appointmentId) {
        await handleCompleteAppointment(appointmentId);
      }
    });
  }

  // 2. Close granular modal on outside click
  // We attach this to the modal itself, not the whole window, for better performance
  const granularModal = document.getElementById('granularCompleteModal');
  if (granularModal) {
    granularModal.addEventListener('click', function (e) {
      if (e.target === granularModal) {
        granularModal.style.display = 'none';
      }
    });
  }
}

export {
  handleTimeSlotClick,
  handleCompleteAppointment,
  handleCancelAppointment,
  handleEditAppointment,
  initAppointmentForm,
  openGranularModal,
  initGranularModalListeners
}