import { formatDate, formatTime, createElement, isSlotAvailable, getStartOfWeek } from "./helper.js";
import { handleTimeSlotClick } from "./eventHandlers.js";

function renderCalendar(
  currentDate,
  appointments,
  PIXELS_PER_MINUTE) {

  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // Always render day labels
  renderDayLabels(currentDate);

  // Re-build calendar structure
  calendarEl.innerHTML = '';
  renderTimeLabels(calendarEl);
  renderLunchBreak(calendarEl);

  // Create day column containers
  const colPromises = [];
  for (let day = 0; day < 6; day++) {
    const col = createElement('div', 'day-column', '');
    col.dataset.dayIndex = day;
    calendarEl.appendChild(col);
    colPromises.push(renderDayColumn(day, currentDate, appointments, PIXELS_PER_MINUTE));
  }
  return Promise.all(colPromises);
}

function renderTimeLabels(container) {
  for (let hour = 9; hour <= 17; hour++) {
    if (hour === 12) continue;
    const label = createElement('div', 'time-label', `${hour}:00`);
    label.style.gridRow = getRowForHour(hour);
    label.style.gridColumn = '1';
    container.appendChild(label);
  }
}

function renderLunchBreak(container) {
  const lunch = createElement('div', 'lunch-break', 'LUNCH BREAK');
  lunch.style.gridRow = '4';
  lunch.style.gridColumn = '1 / -1';
  container.appendChild(lunch);
}

function getRowForHour(hour) {
  if (hour < 12) return hour - 8;
  if (hour > 12) return hour - 8;
  return 4;
}

function renderDayColumn(dayIndex, currentDate, appointments, PIXELS_PER_MINUTE) {
  const col = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
  if (!col) return Promise.resolve();

  const startOfWeek = getStartOfWeek(currentDate);
  const frag = document.createDocumentFragment();

  for (let hour = 9; hour <= 17; hour++) {
    if (hour === 12) continue;

    const slotDate = new Date(startOfWeek);
    slotDate.setDate(startOfWeek.getDate() + dayIndex);
    slotDate.setHours(hour, 0, 0, 0);

    const slotEl = createElement('div', 'time-slot', '');
    slotEl.dataset.date = slotDate.toISOString();
    slotEl.style.gridRow = getRowForHour(hour);
    slotEl.style.gridColumn = dayIndex + 2;

    const isSaturdayAfternoon = slotDate.getDay() === 6 && hour >= 16;
    if (isSaturdayAfternoon) {
      slotEl.classList.add('disabled', 'restricted');
      slotEl.innerHTML = '<div class="restricted-slot">Not Available</div>';
    } else {
      const slotAppointments = Object.values(appointments)
        .filter(appt => appt.status !== 'cancelled')
        .filter(appt => {
          const apptStart = new Date(appt.start_time);
          return (
            apptStart.getFullYear() === slotDate.getFullYear() &&
            apptStart.getMonth() === slotDate.getMonth() &&
            apptStart.getDate() === slotDate.getDate() &&
            apptStart.getHours() === slotDate.getHours()
          );
        });

      if (slotAppointments.length === 0 && isSlotAvailable(slotDate, 60, appointments)) {
        slotEl.appendChild(createElement('div', 'empty-slot', '+'));
        slotEl.classList.add('available');
        slotEl.addEventListener('click', handleTimeSlotClick);
      } else {
        slotAppointments.forEach(appt => {
          slotEl.appendChild(createAppointmentElement(appt, slotDate, PIXELS_PER_MINUTE));
        });
      }
    }
    frag.appendChild(slotEl);
  }

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      col.innerHTML = '';
      col.appendChild(frag);
      resolve();
    });
  });
}

function createAppointmentElement(appt, slotDate, PIXELS_PER_MINUTE) {
  const startTime = new Date(appt.start_time);
  const endTime = new Date(appt.end_time);
  const durationMinutes = (endTime - startTime) / 60000;

  const heightPx = durationMinutes * PIXELS_PER_MINUTE;
  const minutesOffset = (startTime - new Date(slotDate)) / 60000;
  const topPx = minutesOffset * PIXELS_PER_MINUTE;

  const urlParams = new URLSearchParams(window.location.search);
  const isHighlighted = urlParams.get('appt') === appt.id;

  const el = createElement('div', `appointment status-${appt.status} ${isHighlighted ? 'highlighted-appointment' : ''}`, `
    <div class="appt-sidebar">
      <span>${durationMinutes}</span>
    </div>
    <div class="appointment-content">
      <strong>${appt.patient_first_name} ${appt.patient_last_name}</strong>
      <span class="treatment-sep">•</span>
      <div class="treatment">${appt.treatment_type}</div>
      <div class="time">${formatTime(startTime)}-${formatTime(endTime)}</div>
    </div>
    ${appt.status === 'scheduled' ? '<div class="resize-handle"></div>' : ''}
  `);

  el.dataset.appointmentId = appt.id;
  el.draggable = appt.status === 'scheduled';
  el.style.position = 'absolute';
  el.style.top = `${topPx}px`;
  el.style.height = `${heightPx}px`;
  el.style.left = '0';
  el.style.width = '100%';
  el.style.margin = '0';

  return el;
}

function renderDayLabels(currentDate) {
  const container = document.getElementById('day-labels');
  if (!container) return;

  container.innerHTML = '';
  container.appendChild(createElement('div', 'day-label', ''));

  const startOfWeek = getStartOfWeek(currentDate);
  for (let i = 0; i < 6; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    container.appendChild(
      createElement('div', 'day-label', formatDate(date))
    );
  }
}

export {
  renderCalendar,
  renderDayColumn,
  renderDayLabels
}