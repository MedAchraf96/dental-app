function formatDate(date, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(date).toLocaleDateString('en-US', options);
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}
function formatForServer(date) {
  const pad = num => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateForInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}
function formatTimeForInput(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateRange(start, end) {
  const sDay = start.getDate();
  const sMonth = start.toLocaleString('en-US', { month: 'short' });
  const sYear = start.getFullYear();

  const eDay = end.getDate();
  const eMonth = end.toLocaleString('en-US', { month: 'short' });
  const eYear = end.getFullYear();

  if (sYear !== eYear) {
    return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${sYear}`;
  } else if (sMonth !== eMonth) {
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`;
  } else {
    return `${sMonth} ${sDay} – ${eDay}, ${sYear}`;
  }
}

function updateWeekDisplay(currentDate) {
  const startOfWeek = getStartOfWeek(currentDate);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 5);

  document.getElementById('week-range').textContent = formatDateRange(startOfWeek, endOfWeek);
}

function isSlotAvailable(slotDate, durationMinutes, appointments) {
  const slotStart = new Date(slotDate);
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

  if (slotStart.getDay() === 0) {
    return false;
  }

  const lunchStart = new Date(slotStart);
  lunchStart.setHours(12, 0, 0, 0);
  const lunchEnd = new Date(lunchStart);
  lunchEnd.setHours(13, 0, 0, 0);

  if (slotStart < lunchEnd && slotEnd > lunchStart) {
    return false;
  }

  if (slotStart.getDay() === 6 && slotStart.getHours() >= 16) {
    return false;
  }

  // Only consider non-cancelled appointments when checking for overlaps
  return !Object.values(appointments).some(appt => {
    if (appt.status === 'cancelled') return false;
    const apptStart = new Date(appt.start_time);
    const apptEnd = new Date(appt.end_time);
    return slotStart < apptEnd && slotEnd > apptStart;
  });
}

function validateAppointmentTime(start, end, appointments, excludeAppointmentId = null) {
  // Convert to array if needed
  const appointmentsArray = Array.isArray(appointments)
    ? appointments
    : Object.values(appointments);

  // Convert to Date objects
  const startTime = new Date(start);
  const endTime = new Date(end);

  // Business rules validation
  if (startTime.getDay() === 0) return "Appointments are not allowed on Sundays.";

  const lunchStart = new Date(startTime).setHours(12, 0, 0, 0);
  const lunchEnd = new Date(lunchStart).setHours(13, 0, 0, 0);
  if (startTime < lunchEnd && endTime > lunchStart) {
    return "Appointments are not allowed during lunch (12:00 PM - 1:00 PM).";
  }

  if (startTime.getDay() === 6) {
    const cutoff = new Date(startTime);
    cutoff.setHours(16, 0, 0, 0);
    if (startTime >= cutoff || endTime > cutoff) {
      return "Appointments are not allowed on Saturday afternoons (after 4:00 PM).";
    }
  }

  if (startTime.getHours() < 9 || endTime.getHours() > 17 ||
    (endTime.getHours() === 17 && endTime.getMinutes() > 0)) {
    return "Appointments must be within working hours (9:00 AM - 5:00 PM).";
  }

  // Conflict detection
  const hasConflict = appointmentsArray.some(appt => {
    // Ignore the appointment we're editing and any cancelled ones
    if (excludeAppointmentId !== null && appt.id == excludeAppointmentId) return false;
    if (appt.status === 'cancelled') return false;
    const apptStart = new Date(appt.start_time || appt.start);
    const apptEnd = new Date(appt.end_time || appt.end);
    return startTime < apptEnd && endTime > apptStart;
  });

  if (hasConflict) {
    const conflict = appointmentsArray.find(appt => {
      if (excludeAppointmentId !== null && appt.id == excludeAppointmentId) return false;
      const apptStart = new Date(appt.start_time || appt.start);
      const apptEnd = new Date(appt.end_time || appt.end);
      return startTime < apptEnd && endTime > apptStart;
    });

    const conflictTime = new Date(conflict.start_time || conflict.start)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const patientName = conflict.patient_name || conflict.patient || 'a patient';

    return `This time conflicts with ${patientName}'s appointment at ${conflictTime}.`;
  }

  return null;
}

function checkRunway(startTime, selectedDate, appointments, excludeApptId = null) {
  const start = new Date(`${selectedDate}T${startTime}`);
  const appointmentsArray = Array.isArray(appointments) ? appointments : Object.values(appointments);

  // 0. Check if the start time itself falls inside any non-excluded appointment
  const isOccupied = appointmentsArray.some(appt => {
    if (appt.status === 'cancelled' || (excludeApptId && appt.id == excludeApptId)) return false;
    const apptStart = new Date(appt.start_time);
    const apptEnd = new Date(appt.end_time);
    return start >= apptStart && start < apptEnd;
  });
  if (isOccupied) return 0;

  // 1. Calculate End of Day Blocker
  let eod = new Date(start);
  if (start.getDay() === 6) { // Saturday
    eod.setHours(16, 0, 0, 0);
  } else {
    eod.setHours(17, 0, 0, 0);
  }

  // 2. Calculate Lunch Blocker
  let lunchStart = new Date(start);
  lunchStart.setHours(12, 0, 0, 0);
  let lunchEnd = new Date(lunchStart);
  lunchEnd.setHours(13, 0, 0, 0);

  // 3. Find Next Appointment Blocker
  let nextApptStart = eod;

  appointmentsArray.forEach(appt => {
    if (appt.status === 'cancelled' || (excludeApptId && appt.id == excludeApptId)) return;

    const apptStart = new Date(appt.start_time);
    // Same day and starts after our start
    if (apptStart.toDateString() === start.toDateString() && apptStart > start) {
      if (apptStart < nextApptStart) {
        nextApptStart = apptStart;
      }
    }
  });

  // Calculate available runway
  let runway = (nextApptStart - start) / 60000;

  // Intersect with lunch break if we haven't reached it yet
  if (start < lunchStart && nextApptStart > lunchStart) {
    runway = (lunchStart - start) / 60000;
  } else if (start >= lunchStart && start < lunchEnd) {
    // Currently in lunch? Runway is 0.
    runway = 0;
  }

  return Math.max(0, Math.floor(runway));
}

function getTimeSlots(date) {
  const isSaturday = new Date(date).getDay() === 6;
  const slots = [];

  // Morning: 9:00 - 11:45
  for (let hour = 9; hour < 12; hour++) {
    for (let min = 0; min < 60; min += 15) {
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
  }

  // Afternoon: 13:00 - 16:45 (or 15:45 on Saturday)
  const endHour = isSaturday ? 16 : 17;
  for (let hour = 13; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 15) {
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
  }

  return slots;
}

function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

export {
  getStartOfWeek,
  formatDate,
  formatForServer,
  formatDateForInput,
  formatTime,
  formatTimeForInput,
  isSlotAvailable,
  validateAppointmentTime,
  checkRunway,
  getTimeSlots,
  createElement,
  updateWeekDisplay,
}