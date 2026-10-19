import { getCSRFToken } from "./state.js";
// ======================
// API FUNCTIONS
// ======================
export async function fetchAppointments(startDate, endDate) {
  try {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const response = await fetch(`/api/appointments?start=${start}&end=${end}`, {
      headers: {
        'X-CSRF-Token': getCSRFToken()
      }
    });
    const data = await response.json();

    return data.reduce((acc, appt) => {
      acc[appt.id] = appt;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return {};
  }
}

export async function createAppointment(appointmentData) {
  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      body: JSON.stringify(appointmentData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create appointment');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating appointment:', error);
    throw error;
  }
}

export async function updateAppointment(appointmentId, appointmentData) {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      body: JSON.stringify(appointmentData)
    });

    if (!response.ok) throw new Error('Failed to update appointment');
    return await response.json();
  } catch (error) {
    console.error('Error updating appointment:', error);
    throw error;
  }
}

export async function cancelAppointment(appointmentId) {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCSRFToken()
      }
    });

    if (!response.ok) throw new Error('Failed to cancel appointment');
    return await response.json();
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
}

export async function completeAppointment(appointmentId) {
  if (confirm('Mark this appointment as completed?')) {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        }
      });

      if (!response.ok) throw new Error('Failed to complete appointment');
      return await response.json();
    } catch (error) {
      console.error('Error completing appointment:', error);
      throw error;
    }
  }
  return null;
}