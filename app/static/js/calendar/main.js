import {
  getStartOfWeek,
  formatForServer,
  formatDateForInput,
  validateAppointmentTime,
  updateWeekDisplay,
  checkRunway,
  getTimeSlots,
} from "./helper.js";
import {
  fetchAppointments,
  createAppointment,
  updateAppointment
} from "./API.js";
import { renderCalendar, renderDayColumn, renderDayLabels } from "./CalRender.js";
import {
  handleCompleteAppointment,
  handleDeleteAppointment,
  initAppointmentForm
} from "./eventHandlers.js";
import { PIXELS_PER_MINUTE } from "./state.js";
import {
  setupInteractionHandlers
} from "./interaction.js";

// ======================
// CALENDAR DATA AND STATE
// ======================
let appointments = {};
let currentDate = new Date();

function setupModal() {
  const modal = document.getElementById('appointmentModal');
  const form = document.getElementById('appointmentForm');
  const addButton = document.getElementById('add-appointment-header');

  if (!modal || !form || !addButton) {
    console.error('Modal elements not found');
    return;
  }

  // Initialize patient search functionality
  const patientSearch = document.getElementById('patientSearch');
  const patientDropdown = document.getElementById('patientDropdown');
  const patientIdInput = document.getElementById('patientId');
  const patientInfo = document.getElementById('selectedPatientInfo');
  const patientFullName = document.getElementById('patientFullName');
  const patientPhone = document.getElementById('patientPhone');

  // Debounced search function
  let searchTimeout;
  patientSearch.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (this.value.length > 1) {
        searchPatients(this.value);
      } else {
        patientDropdown.style.display = 'none';
      }
    }, 300);
  });

  async function searchPatients(query) {
    try {
      const response = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
      const patients = await response.json();

      patientDropdown.innerHTML = '';

      if (patients.length === 0) {
        patientDropdown.innerHTML = '<div>No patients found</div>';
        patientDropdown.style.display = 'block';
        return;
      }

      patients.forEach(patient => {
        const div = document.createElement('div');
        div.innerHTML = `
          <strong>${patient.first_name} ${patient.last_name}</strong>
          <br>
          <small>${patient.phone || 'No phone'} • ${patient.email || 'No email'}</small>
        `;
        div.onclick = () => {
          patientSearch.value = `${patient.first_name} ${patient.last_name}`;
          patientIdInput.value = patient.id;
          patientFullName.textContent = `${patient.first_name} ${patient.last_name}`;
          patientPhone.textContent = patient.phone || 'Not provided';
          patientInfo.style.display = 'block';
          patientDropdown.style.display = 'none';
        };
        patientDropdown.appendChild(div);
      });

      patientDropdown.style.display = 'block';
    } catch (error) {
      console.error('Search failed:', error);
    }
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!patientSearch.contains(e.target) && !patientDropdown.contains(e.target)) {
      patientDropdown.style.display = 'none';
    }
  });

  // Rest of your existing modal setup
  addButton.addEventListener('click', () => {
    initAppointmentForm('new');
  });

  document.querySelectorAll('.close, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  });

  window.addEventListener('click', e => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Connect Complete and Delete buttons
  const deleteBtn = document.getElementById('deleteAppointmentBtn');
  const completeBtn = document.getElementById('completeAppointmentBtn');

  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const appointmentId = form.dataset.appointmentId;
      if (await handleDeleteAppointment(appointmentId, appointments, initCalendar)) {
        modal.style.display = 'none';
      }
    };
  }

  if (completeBtn) {
    completeBtn.onclick = async () => {
      const appointmentId = form.dataset.appointmentId;
      if (await handleCompleteAppointment(appointmentId, initCalendar)) {
        modal.style.display = 'none';
      }
    };
  }

  // Date validation remains the same
  // Mutual Validation Logic
  function updateDurationOptions() {
    const startTime = document.getElementById('startTime').value;
    const date = document.getElementById('appointmentDate').value;
    const durationSelect = document.getElementById('duration');
    const runwayHint = document.getElementById('runwayHint');
    const apptId = form.dataset.appointmentId;

    if (!startTime || !date) return;

    const runway = checkRunway(startTime, date, appointments, apptId);

    // Update the hint text
    if (runwayHint) {
      runwayHint.textContent = `Maximum available slot: ${runway} minutes`;
      runwayHint.style.color = runway < parseInt(durationSelect.value) ? '#dc3545' : '#6c757d'; // Red if conflict
    }

    // Add visual 'Fits' status to dropdown options
    Array.from(durationSelect.options).forEach(option => {
      const durValue = parseInt(option.value);
      const originalText = option.getAttribute('data-original-text') || option.textContent;

      if (!option.getAttribute('data-original-text')) {
        option.setAttribute('data-original-text', originalText);
      }

      if (durValue <= runway) {
        option.textContent = `${originalText} ✓`;
        option.style.color = '#198754'; // Success green
      } else {
        option.textContent = `${originalText}`;
        option.style.color = '#dc3545'; // Danger red
      }
    });

    // If current duration choice is too long, we need to refresh time options
    // which will find a new valid slot (reset behavior requested previous step)
    updateTimeOptions();
  }

  function updateTimeOptions() {
    const date = document.getElementById('appointmentDate').value;
    const durationCount = parseInt(document.getElementById('duration').value);
    const startTimeSelect = document.getElementById('startTime');
    const apptId = form.dataset.appointmentId;
    const currentVal = startTimeSelect.value;

    if (!date || !durationCount) return;

    // Get original time if editing to ensure it's always visible ONLY on its original day
    let originalTime = null;
    if (form.dataset.originalValues) {
      try {
        const originals = JSON.parse(form.dataset.originalValues);
        if (originals.date === date) {
          originalTime = originals.time;
        }
      } catch (e) {
        console.error("Error parsing original values", e);
      }
    }

    const allSlots = getTimeSlots(date);
    let html = '';

    allSlots.forEach(slot => {
      const runway = checkRunway(slot, date, appointments, apptId);
      // Visible if runway is long enough OR if it's the original time of the appt being edited ON its day
      const isVisible = runway >= durationCount || slot === originalTime;

      if (isVisible) {
        const label = formatTimeLabel(slot);
        html += `<option value="${slot}" ${slot === currentVal ? 'selected' : ''}>${label}</option>`;
      }
    });

    startTimeSelect.innerHTML = html;

    // If current selection disappeared and there are valid options, pick first
    if (!startTimeSelect.value && startTimeSelect.options.length > 0) {
      startTimeSelect.selectedIndex = 0;
    }
  }

  function formatTimeLabel(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${suffix}`;
  }

  document.getElementById('startTime').addEventListener('change', updateDurationOptions);
  document.getElementById('duration').addEventListener('change', updateTimeOptions);
  document.getElementById('appointmentDate').addEventListener('change', function () {
    const selectedDate = new Date(this.value);
    if (selectedDate.getDay() === 0) {
      alert("Please select a weekday (Monday-Saturday).");
      this.value = formatDateForInput(new Date());
    }
    updateTimeOptions();
    updateDurationOptions();
  });

  // Re-expose these for initAppointmentForm to trigger
  window.triggerMutualValidation = () => {
    updateTimeOptions();
    updateDurationOptions();
  };

  // Remove old Saturday check as it's now handled by runway

  // Updated form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      // Check if editing and no changes were made
      if (form.dataset.appointmentId && form.dataset.originalValues) {
        const currentValues = JSON.stringify({
          date: e.target.appointmentDate.value,
          time: e.target.startTime.value,
          duration: e.target.duration.value,
          patient_id: patientIdInput.value,
          treatment: e.target.treatmentType.value
        });

        if (currentValues === form.dataset.originalValues) {
          alert('No changes detected. Appointment not updated.');
          modal.style.display = 'none';
          return;
        }
      }

      const date = e.target.appointmentDate.value;
      const time = e.target.startTime.value;
      const duration = parseInt(e.target.duration.value);
      const treatmentType = e.target.treatmentType.value.trim();

      // Validate required fields
      if (!patientIdInput.value || !treatmentType) {
        alert('Please select a patient and enter treatment type');
        return;
      }

      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + duration * 60000);

      const validationError = validateAppointmentTime(start, end, appointments, form.dataset.appointmentId);
      if (validationError) {
        alert(validationError);
        return;
      }

      const payload = {
        patient_id: patientIdInput.value,
        start_time: formatForServer(start),
        end_time: formatForServer(end),
        treatment_type: treatmentType
      };

      if (!payload.patient_id) {
        alert('Please select a patient from the search results');
        return;
      }

      if (form.dataset.appointmentId) {
        await updateAppointment(form.dataset.appointmentId, payload);
      } else {
        await createAppointment(payload);
      }

      modal.style.display = 'none';
      await initCalendar();
    } catch (error) {
      console.error('Appointment operation failed:', error);
      alert(`Error: ${error.message}`);
    }
  });
}


function updateAppointmentWidths() {
  const timeGrid = document.querySelector('.time-grid');
  if (!timeGrid) return;

  const timeLabelWidth = 100;
  const dayColumnWidth = (timeGrid.offsetWidth - timeLabelWidth) / 6;

  document.querySelectorAll('.appointment').forEach(el => {
    el.style.width = `${dayColumnWidth}px`;
  });
}




function highlightAppointment(appointmentId) {
  // Remove any existing highlights
  document.querySelectorAll('.appointment').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Add highlight to target appointment
  const appointmentEl = document.querySelector(`.appointment[data-appointment-id="${appointmentId}"]`);
  if (appointmentEl) {
    appointmentEl.classList.add('highlighted');

    // Remove highlight after animation completes (2s * 3 iterations = 6s)
    setTimeout(() => {
      appointmentEl.classList.remove('highlighted');
    }, 6000);
  }
}

function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
// ======================
// INITIALIZATION
// ======================


function waitForElementsWithRAF(ids, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();

    function check() {
      const allExist = ids.every(id => document.getElementById(id));
      if (allExist) return resolve();

      if (performance.now() - start >= timeout) {
        return reject(new Error(`Missing DOM elements: ${ids.join(', ')}`));
      }

      requestAnimationFrame(check);
    }

    check();
  });
}

async function initCalendar(forceFullRender = false, forceDays = []) {
  const calendarEl = document.getElementById('calendar');
  if (calendarEl) {
    // Lock min-height to prevent scroll-jumping
    calendarEl.style.minHeight = `${calendarEl.offsetHeight}px`;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const targetApptId = urlParams.get('appt');

    // Fetch single appointment if linked (only on first load)
    if (targetApptId && !forceFullRender && Object.keys(appointments).length === 0) {
      try {
        const response = await fetch(`/api/appointments/${targetApptId}`);
        if (response.ok) {
          const appt = await response.json();
          currentDate = new Date(appt.start_time);
        }
      } catch (e) {
        console.error('Error fetching target appointment:', e);
      }
    }

    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const oldAppointments = appointments;
    appointments = await fetchAppointments(startOfWeek, endOfWeek);

    const isInitialLoad = !calendarEl || calendarEl.children.length <= 1;

    if (forceFullRender || isInitialLoad) {
      await renderCalendar(currentDate, appointments, PIXELS_PER_MINUTE);
      finalizeView(targetApptId);
    } else {
      // Atomic updates: Identify changed days
      const daysToUpdate = new Set(forceDays);
      const allIds = new Set([...Object.keys(oldAppointments), ...Object.keys(appointments)]);

      allIds.forEach(id => {
        const oldAppt = oldAppointments[id];
        const newAppt = appointments[id];

        if (!oldAppt && newAppt) {
          daysToUpdate.add(new Date(newAppt.start_time).getDay() - 1);
        } else if (oldAppt && !newAppt) {
          daysToUpdate.add(new Date(oldAppt.start_time).getDay() - 1);
        } else if (oldAppt && newAppt &&
          (oldAppt.start_time !== newAppt.start_time ||
            oldAppt.end_time !== newAppt.end_time ||
            oldAppt.status !== newAppt.status)) {
          daysToUpdate.add(new Date(oldAppt.start_time).getDay() - 1);
          daysToUpdate.add(new Date(newAppt.start_time).getDay() - 1);
        }
      });

      const updatePromises = [];
      daysToUpdate.forEach(day => {
        if (day >= 0 && day < 6) { // 0=Mon, 5=Sat
          updatePromises.push(renderDayColumn(day, currentDate, appointments, PIXELS_PER_MINUTE));
        }
      });

      await Promise.all(updatePromises);
      finalizeView(targetApptId);
    }

  } catch (error) {
    console.error('Error initializing calendar:', error);
    alert('Failed to load calendar data. Please try again.');
  } finally {
    if (calendarEl) {
      // Release min-height after slight delay to ensure render is complete
      setTimeout(() => {
        calendarEl.style.minHeight = '';
      }, 100);
    }
  }
}

function finalizeView(targetApptId) {
  renderDayLabels(currentDate);
  updateWeekDisplay(currentDate);
  setupInteractionHandlers(() => appointments, initCalendar);
  updateAppointmentWidths();

  if (targetApptId) {
    highlightAppointment(targetApptId);
    history.replaceState(null, '', window.location.pathname);
  }
}

(async () => {
  try {
    await waitForElementsWithRAF(['calendar', 'day-labels', 'prev-week', 'next-week']);

    await initCalendar();

    if (typeof setupModal === 'function') {
      setupModal();
    }

    // Cache navigation buttons
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');

    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', async () => {
        currentDate.setDate(currentDate.getDate() - 7);
        await initCalendar(true); // Force full render on navigation
      });
    }

    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', async () => {
        currentDate.setDate(currentDate.getDate() + 7);
        await initCalendar(true); // Force full render on navigation
      });
    }

    // Optimized resize handler
    const handleResize = debounce(() => {
      updateAppointmentWidths();
      const timeSlotWidth = document.querySelector('.time-slot')?.offsetWidth;
      if (timeSlotWidth) {
        document.querySelectorAll('.appointment').forEach(el => {
          el.style.width = `${timeSlotWidth}px`;
        });
      }
    }, 100);

    window.addEventListener('resize', handleResize);
    handleResize();

    // Calendar Title Icon Date Picker (Jump to week)
    const iconNav = document.getElementById('calendar-icon-nav');
    const jumpDateInput = document.getElementById('calendar-jump-date');

    if (iconNav && jumpDateInput) {
      iconNav.addEventListener('click', () => {
        try {
          jumpDateInput.showPicker();
        } catch (e) {
          jumpDateInput.click();
        }
      });

      jumpDateInput.addEventListener('change', async (e) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate.getTime())) {
          currentDate = selectedDate;
          await initCalendar(true); // Force full render on jump
        }
      });
    }

  } catch (error) {
    console.error('Application initialization failed:', error);
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');

    if (errorContainer && errorMessage) {
      errorContainer.style.display = 'block';
      errorMessage.textContent = error.message;
    } else {
      alert('Initialization error: ' + error.message);
    }
  }
})();