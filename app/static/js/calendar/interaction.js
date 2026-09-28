import {
    formatForServer,
    formatTime,
    validateAppointmentTime
} from "./helper.js";
import { updateAppointment } from "./API.js";
import { PIXELS_PER_MINUTE } from "./state.js";
import { handleEditAppointment } from "./eventHandlers.js";

// ======================
// INTERACTION STATE
// ======================
let isResizing = false;
let resizeStartY, originalHeight, originalStartTime;
let pendingResizeUpdate = null;

// Indicator for drag-and-drop feedback
let dropIndicator = null;
let draggedApptDuration = 0;

function getIndicator() {
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        document.body.appendChild(dropIndicator);
    }
    return dropIndicator;
}

function hideIndicator() {
    if (dropIndicator) {
        dropIndicator.style.display = 'none';
        dropIndicator.classList.remove('valid', 'invalid');
    }
}

// ======================
// DRAG AND DROP HANDLERS
// ======================

export function handleDragStart(el, e, appointments) {
    const appointmentId = Number(el.dataset.appointmentId);
    const appt = appointments[appointmentId];

    if (
        el.parentElement.classList.contains('disabled') ||
        !appt ||
        appt.status !== 'scheduled'
    ) {
        e.preventDefault();
        return;
    }

    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', String(appointmentId));

    // Calculate duration for the indicator
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    draggedApptDuration = (end - start) / 60000;
}

export function handleDragEnd(el) {
    el.classList.remove('dragging');
    hideIndicator();
}

export function handleDragOver(slot, e, appointments) {
    e.preventDefault();
    slot.classList.add('drop-target');

    const indicator = getIndicator();
    const slotRect = slot.getBoundingClientRect();
    const dropPos = e.clientY - slotRect.top;
    const minutesOffset = dropPos / PIXELS_PER_MINUTE;
    const roundedMinutes = Math.round(minutesOffset / 15) * 15;

    const height = draggedApptDuration * PIXELS_PER_MINUTE;
    const topOffset = roundedMinutes * PIXELS_PER_MINUTE;

    const slotDate = new Date(slot.dataset.date);
    const proposedStart = new Date(slotDate);
    proposedStart.setMinutes(roundedMinutes, 0, 0);
    const proposedEnd = new Date(proposedStart.getTime() + draggedApptDuration * 60000);

    const draggingEl = document.querySelector('.appointment.dragging');
    const appointmentId = draggingEl ? Number(draggingEl.dataset.appointmentId) : null;

    const validationError = validateAppointmentTime(proposedStart, proposedEnd, appointments, appointmentId);

    // Batch indicator updates
    requestAnimationFrame(() => {
        indicator.style.display = 'flex';
        indicator.style.height = `${height}px`;
        indicator.style.top = `${slotRect.top + window.scrollY + topOffset}px`;
        indicator.style.left = `${slotRect.left + window.scrollX + 5}px`;
        indicator.style.width = `${slotRect.width - 10}px`;

        if (validationError) {
            indicator.classList.remove('valid');
            indicator.classList.add('invalid');
            indicator.setAttribute('data-time', 'Conflict');
        } else {
            indicator.classList.remove('invalid');
            indicator.classList.add('valid');
            indicator.setAttribute('data-time', `${formatTime(proposedStart)}`);
        }
    });
}

export function handleDragLeave(slot) {
    slot.classList.remove('drop-target');
}

export async function handleDrop(slot, e, appointments, initCalendar) {
    e.preventDefault();
    slot.classList.remove('drop-target');
    hideIndicator();

    const appointmentId = Number(e.dataTransfer.getData('text/plain'));
    if (!appointmentId) return;

    const slotRect = slot.getBoundingClientRect();
    const dropPos = e.clientY - slotRect.top;
    const minutesOffset = dropPos / PIXELS_PER_MINUTE;
    const roundedMinutes = Math.round(minutesOffset / 15) * 15;

    const slotDate = new Date(slot.dataset.date);
    const newStart = new Date(slotDate);
    newStart.setMinutes(roundedMinutes, 0, 0);

    const appt = appointments[appointmentId];
    if (!appt) return;

    const durationMs = new Date(appt.end_time) - new Date(appt.start_time);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const validationError = validateAppointmentTime(newStart, newEnd, appointments, appointmentId);
    if (validationError) {
        alert(validationError);
        const draggingEl = document.querySelector('.appointment.dragging');
        if (draggingEl) draggingEl.classList.remove('dragging');

        const originalDay = new Date(appt.start_time).getDay() - 1;
        const targetDay = slotDate.getDay() - 1;
        await initCalendar(false, [originalDay, targetDay]);
        return;
    }

    try {
        await updateAppointment(appointmentId, {
            start_time: formatForServer(newStart),
            end_time: formatForServer(newEnd),
            treatment_type: appt.treatment_type,
        });
        await initCalendar();
    } catch (error) {
        console.error('Error moving appointment:', error);
        alert('Failed to move appointment. Please try again.');
        await initCalendar();
    }
}

// ======================
// CONSOLIDATED INITIALIZATION (WITH DELEGATION)
// ======================

let interactionInitialized = false;

export function setupInteractionHandlers(getAppointments, initCalendar) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || interactionInitialized) return;

    interactionInitialized = true;

    // --- Drag and Drop (Delegation) ---
    calendarEl.addEventListener('dragstart', (e) => {
        const apptEl = e.target.closest('.appointment');
        if (apptEl) {
            handleDragStart(apptEl, e, getAppointments());
        }
    });

    calendarEl.addEventListener('dragend', (e) => {
        const apptEl = e.target.closest('.appointment');
        if (apptEl) handleDragEnd(apptEl);
    });

    // Slots handlers
    calendarEl.addEventListener('dragover', (e) => {
        const slot = e.target.closest('.time-slot');
        if (slot) {
            handleDragOver(slot, e, getAppointments());
        }
    });

    calendarEl.addEventListener('dragleave', (e) => {
        const slot = e.target.closest('.time-slot');
        if (slot) {
            handleDragLeave(slot);
        }
    });

    calendarEl.addEventListener('drop', (e) => {
        const slot = e.target.closest('.time-slot');
        if (slot) {
            handleDrop(slot, e, getAppointments(), initCalendar);
        }
    });

    // --- Resize Handles (Delegation) ---
    calendarEl.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.resize-handle');
        if (handle) {
            e.stopPropagation();
            e.preventDefault();

            const apptEl = handle.closest('.appointment');
            const apptId = apptEl.dataset.appointmentId;
            const appt = getAppointments()[apptId];

            if (appt) {
                initiateResize(e, apptEl, appt, getAppointments, initCalendar);
            }
        }
    });

    // --- Edit (Double Click) ---
    calendarEl.addEventListener('dblclick', (e) => {
        const apptEl = e.target.closest('.appointment');
        if (apptEl) {
            e.stopPropagation();
            const appointmentId = Number(apptEl.dataset.appointmentId);
            handleEditAppointment(appointmentId, getAppointments());
        }
    });
}

/**
 * Separate resize initiation logic to keep mousedown handler clean.
 */
function initiateResize(e, el, appt, getAppointments, initCalendar) {
    if (appt.status !== 'scheduled') return;

    isResizing = true;
    el.draggable = false;
    resizeStartY = e.clientY;
    originalHeight = el.offsetHeight;
    originalStartTime = new Date(appt.start_time);

    const onMouseMove = e => {
        if (!isResizing) return;

        let newHeightPx = originalHeight + (e.clientY - resizeStartY);
        const snapPx = 15 * PIXELS_PER_MINUTE;
        newHeightPx = Math.round(newHeightPx / snapPx) * snapPx;
        newHeightPx = Math.max(snapPx, newHeightPx);

        const newEnd = new Date(originalStartTime.getTime() + (newHeightPx / PIXELS_PER_MINUTE) * 60000);

        const validationError = validateAppointmentTime(originalStartTime, newEnd, getAppointments(), appt.id);
        const timeEl = el.querySelector('.time');
        if (validationError) {
            el.style.border = '2px solid red';
            if (timeEl) timeEl.textContent = `${formatTime(originalStartTime)}-${formatTime(newEnd)} (Conflict!)`;
        } else {
            el.style.border = '';
        }

        const WORKING_END_HOUR = 17;
        const workingEnd = new Date(originalStartTime);
        workingEnd.setHours(WORKING_END_HOUR, 0, 0, 0);
        if (newEnd > workingEnd) {
            newEnd.setTime(workingEnd.getTime());
            newHeightPx = (workingEnd - originalStartTime) / 60000 * PIXELS_PER_MINUTE;
        }

        if (originalStartTime.getDay() === 6 && newEnd.getHours() >= 16) {
            const saturdayCutoff = new Date(originalStartTime);
            saturdayCutoff.setHours(16, 0, 0, 0);
            newEnd.setTime(saturdayCutoff.getTime());
            newHeightPx = (saturdayCutoff - originalStartTime) / 60000 * PIXELS_PER_MINUTE;
        }

        const lunchStart = new Date(originalStartTime);
        lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(lunchStart);
        lunchEnd.setHours(13, 0, 0, 0);
        if (originalStartTime < lunchEnd && newEnd > lunchStart) {
            newEnd.setTime(lunchStart.getTime());
            newHeightPx = (lunchStart - originalStartTime) / 60000 * PIXELS_PER_MINUTE;
        }

        el.style.height = `${newHeightPx}px`;
        if (timeEl) timeEl.textContent = `${formatTime(originalStartTime)}-${formatTime(newEnd)}`;

        const currentDuration = Math.round((newEnd - originalStartTime) / 60000);
        const sidebarSpan = el.querySelector('.appt-sidebar span');
        if (sidebarSpan) {
            sidebarSpan.textContent = currentDuration;
        }

        pendingResizeUpdate = {
            id: appt.id,
            start_time: formatForServer(originalStartTime),
            end_time: formatForServer(newEnd),
            treatment_type: appt.treatment_type
        };
    };

    const onMouseUp = async () => {
        isResizing = false;
        el.draggable = true;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (pendingResizeUpdate) {
            const newStart = new Date(pendingResizeUpdate.start_time);
            const newEnd = new Date(pendingResizeUpdate.end_time);
            const dayIndex = newStart.getDay() - 1;

            const validationError = validateAppointmentTime(newStart, newEnd, getAppointments(), appt.id);
            if (validationError) {
                alert(validationError);
                pendingResizeUpdate = null;
                await initCalendar(false, [dayIndex]);
                return;
            }

            try {
                await updateAppointment(appt.id, pendingResizeUpdate);
                pendingResizeUpdate = null;
                await initCalendar();
            } catch (error) {
                console.error('Error resizing appointment:', error);
                alert('Failed to save resized appointment');
                pendingResizeUpdate = null;
                await initCalendar(false, [dayIndex]);
            }
        } else {
            el.style.border = '';
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Remove old setupResizeHandlers export as it's now internal to the delegation
