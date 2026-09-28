document.addEventListener('DOMContentLoaded', function() {
    setupDateRangeValidation();
    setupSingleActionConfirmations();
    setupBulkActions();
});

function setupDateRangeValidation() {
    const fromDate = document.getElementById('from');
    const toDate = document.getElementById('to');
    
    if (fromDate && toDate) {
        fromDate.addEventListener('change', function() {
            if (this.value && toDate.value && this.value > toDate.value) {
                toDate.value = this.value;
            }
        });
        
        toDate.addEventListener('change', function() {
            if (this.value && fromDate.value && this.value < fromDate.value) {
                fromDate.value = this.value;
            }
        });
    }
}

function setupSingleActionConfirmations() {
    document.querySelectorAll('form[action*="delete"], form[action*="cancel"]').forEach(form => {
        form.addEventListener('submit', function(e) {
            const action = this.action.includes('hard-delete') ? 
                'Permanently delete this appointment?' : 
                'Cancel this appointment?';
            
            if (!confirm(action)) {
                e.preventDefault();
            }
        });
    });
}

function setupBulkActions() {
    const bulkToolbar = document.querySelector('.bulk-actions-toolbar');
    const checkboxes = document.querySelectorAll('.appointment-checkbox');
    const selectAll = document.getElementById('select-all');
    const bulkDeleteForm = document.getElementById('bulk-delete-form');
    const bulkIdsContainer = document.getElementById('bulk-ids-container');

    if (checkboxes.length > 0) {
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkUI);
        });

        if (selectAll) {
            selectAll.addEventListener('change', function() {
                checkboxes.forEach(cb => cb.checked = this.checked);
                updateBulkUI();
            });
        }

        if (bulkDeleteForm) {
            bulkDeleteForm.addEventListener('submit', function(e) {
                updateBulkIds();
                if (!confirmBulkDelete()) {
                    e.preventDefault();
                }
            });
        }
    }

    function updateBulkUI() {
        const selectedCount = document.querySelectorAll('.appointment-checkbox:checked').length;
        const selectedCountEl = document.querySelector('.selected-count');
        
        if (selectedCountEl) selectedCountEl.textContent = selectedCount;
        if (bulkToolbar) bulkToolbar.style.display = selectedCount > 0 ? 'block' : 'none';
        if (selectAll) {
            selectAll.checked = selectedCount === checkboxes.length;
            selectAll.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
        }
    }

    function updateBulkIds() {
        bulkIdsContainer.innerHTML = '';
        document.querySelectorAll('.appointment-checkbox:checked').forEach(checkbox => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'appointment_ids';
            input.value = checkbox.value;
            bulkIdsContainer.appendChild(input);
        });
    }

    function confirmBulkDelete() {
        const selectedCount = document.querySelectorAll('.appointment-checkbox:checked').length;
        if (selectedCount === 0) {
            alert('Please select at least one appointment to delete.');
            return false;
        }
        return confirm(`Permanently delete ${selectedCount} selected appointment(s)?`);
    }
}