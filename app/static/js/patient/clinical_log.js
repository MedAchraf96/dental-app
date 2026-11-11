document.addEventListener('DOMContentLoaded', function () {
    const dataDiv = document.getElementById('page-data');
    const csrfToken = dataDiv ? dataDiv.dataset.csrfToken : '';

    document.querySelectorAll('.notes-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });

    // ==========================================
    // 1. ROW CLICK NAVIGATION (Headers & Planned Rows)
    // ==========================================
    // Handle Appointment Header Clicks
    document.querySelectorAll('.clickable-header').forEach(row => {
        row.style.cursor = 'pointer'; // Ensure it looks clickable
        row.addEventListener('click', function (e) {
            // Prevent navigation if they clicked a link inside the header
            if (e.target.tagName === 'A' || e.target.closest('a')) return;

            const url = this.getAttribute('data-url');
            if (url) window.location.href = url;
        });
    });

    // Handle Planned Treatment Row Clicks
    document.querySelectorAll('.clickable-treatment-row').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function (e) {
            // Prevent navigation if they clicked inside the notes area or a button
            if (e.target.closest('.notes-wrapper') || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }

            const url = this.getAttribute('data-url');
            if (url) window.location.href = url;
        });
    });

    // ==========================================
    // 2. SAVE NOTE LOGIC
    // ==========================================
    const saveButtons = document.querySelectorAll('.mini-save-btn');
    saveButtons.forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation(); // Prevent row click when saving note

            const treatmentId = this.getAttribute('data-treatment-id');
            const appointmentId = this.getAttribute('data-appointment-id');
            const input = document.getElementById(`input-${treatmentId}`);
            const content = input.value.trim();

            if (!content) return;

            const originalIcon = this.innerHTML;
            this.innerHTML = '<i class="bi bi-hourglass-split"></i>';
            this.disabled = true;

            try {
                const response = await fetch(`/patients/treatments/${treatmentId}/update-notes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        content: content,
                        appointment_id: appointmentId ? parseInt(appointmentId) : null
                    })
                });

                const result = await response.json();

                if (result.success) {
                    const stack = document.getElementById(`notes-stack-${treatmentId}`);

                    // Inject the COMPACT HTML structure
                    const newNoteHTML = `
                            <div class="mini-sticky-note">
                                <div class="mini-note-header">
                                    <span class="mini-date">${result.created_at}</span>
                                    <a href="/api/calendar?appt=${appointmentId}" class="mini-note-appt-link" title="View Appointment">
                                        <i class="bi bi-calendar-event"></i>
                                    </a>
                                </div>
                                <div class="mini-note-body">${content.replace(/\n/g, '<br>')}</div>
                            </div>
                        `;

                    stack.insertAdjacentHTML('afterbegin', newNoteHTML);
                    input.value = ''; // Clear input

                    this.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
                    this.style.background = '#10b981';
                    this.style.color = 'white';
                } else {
                    throw new Error(result.error || 'Save failed');
                }
            } catch (error) {
                console.error('Error saving note:', error);
                this.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
                this.style.background = '#ef4444';
                this.style.color = 'white';
            }

            // Reset button after 2 seconds
            setTimeout(() => {
                this.innerHTML = originalIcon;
                this.style.background = '';
                this.style.color = '';
                this.disabled = false;
            }, 2000);
        });
    });

    // ==========================================
    // 3. MARK TREATMENT COMPLETE LOGIC
    // ==========================================
    const completeBtns = document.querySelectorAll('.mini-action-btn.complete');
    completeBtns.forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation(); // Prevent row click when clicking complete

            if (!confirm('Are you sure you want to mark this treatment as fully completed?')) return;

            const treatmentId = this.getAttribute('data-treatment-id');
            const originalIcon = this.innerHTML;
            this.innerHTML = '<i class="bi bi-hourglass-split"></i>';
            this.disabled = true;

            try {
                const response = await fetch(`/patients/treatments/${treatmentId}/mark-complete`, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrfToken }
                });
                const result = await response.json();

                if (result.success) {
                    window.location.reload();
                } else {
                    throw new Error(result.error || 'Failed to complete treatment');
                }
            } catch (error) {
                console.error('Error completing treatment:', error);
                this.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
                this.style.color = '#ef4444';

                setTimeout(() => {
                    this.innerHTML = originalIcon;
                    this.style.color = '';
                    this.disabled = false;
                }, 2000);
            }
        });
    });
});