/* =========================================================
   TREATMENTS PAGE
   app/static/js/patient/treatments.js
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------
    // DOM Elements
    // -----------------------------------------------------

    const select = document.getElementById('procedure-select');
    const costInput = document.querySelector('input[name="cost"]');
    const toothGroup = document.getElementById('tooth-group');
    const toothInput = document.getElementById('tooth_input');
    const errorDiv = document.getElementById('tooth_error');

    // Stop if this page does not contain the treatment form.
    if (!select || !costInput || !toothGroup || !toothInput) {
        return;
    }

    // -----------------------------------------------------
    // Tooth Validation
    // -----------------------------------------------------

    function validateToothInput(input) {

        const val = input.value.trim().toUpperCase();

        if (val === '') {
            input.style.borderColor = '#ced4da';

            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            return;
        }

        const validKeywords = [
            'FULL UPPER',
            'FULL LOWER',
            'FULL MOUTH'
        ];

        if (validKeywords.includes(val)) {
            input.style.borderColor = '#10b981';

            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            return;
        }

        // Individual tooth validation
        const singleToothRegex = /^[1-4][1-8]$/;

        if (singleToothRegex.test(val)) {
            input.style.borderColor = '#10b981';

            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            return;
        }

        // Tooth range validation
        const rangeRegex = /^([1-4][1-8])-([1-4][1-8])$/;
        const match = val.match(rangeRegex);

        if (match) {

            const startTooth = match[1];
            const endTooth = match[2];

            const startQ = parseInt(startTooth[0], 10);
            const endQ = parseInt(endTooth[0], 10);

            const isUpper =
                (startQ === 1 || startQ === 2) &&
                (endQ === 1 || endQ === 2);

            const isLower =
                (startQ === 3 || startQ === 4) &&
                (endQ === 3 || endQ === 4);

            if (
                (isUpper || isLower) &&
                startTooth !== endTooth
            ) {
                input.style.borderColor = '#10b981';

                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }

                return;
            }
        }

        // Invalid input
        input.style.borderColor = '#ef4444';

        if (errorDiv) {
            errorDiv.style.display = 'block';

            errorDiv.textContent =
                'Invalid. Use 11-48, same-arch range (e.g., 13-23), or FULL UPPER/LOWER/MOUTH.';
        }
    }

    // -----------------------------------------------------
    // Procedure Filtering
    // -----------------------------------------------------

    function filterProceduresForTooth() {

        const options = select.querySelectorAll('option');

        let hasVisibleOptions = false;

        options.forEach(option => {

            // Keep the placeholder visible.
            if (option.disabled && option.value === '') {
                return;
            }

            const targetType = option.dataset.target;

            if (targetType === 'single_tooth') {

                option.style.display = 'block';
                hasVisibleOptions = true;

            } else {

                option.style.display = 'none';
            }
        });

        // Automatically select the first tooth-specific procedure.
        if (hasVisibleOptions && !select.value) {

            const firstToothProc = Array.from(options).find(
                option =>
                    option.style.display !== 'none' &&
                    option.value
            );

            if (firstToothProc) {
                select.value = firstToothProc.value;

                // Trigger cost calculation and required-field logic.
                select.dispatchEvent(
                    new Event('change', { bubbles: true })
                );
            }
        }
    }

    // -----------------------------------------------------
    // Show All Procedures
    // -----------------------------------------------------

    function showAllProcedures() {

        const options = select.querySelectorAll('option');

        options.forEach(option => {
            option.style.display = 'block';
        });
    }

    // -----------------------------------------------------
    // Procedure Selection
    // -----------------------------------------------------

    select.addEventListener('change', function () {

        const selectedOption = this.options[this.selectedIndex];

        if (selectedOption && selectedOption.value) {

            // Automatically fill the estimated cost.
            costInput.value = selectedOption.dataset.price || '0.00';

            // Check whether the procedure requires a tooth number.
            const targetType = selectedOption.dataset.target;

            if (targetType === 'single_tooth') {

                toothGroup.style.display = 'block';
                toothInput.setAttribute('required', 'required');

            } else {

                toothGroup.style.display = 'none';

                toothInput.removeAttribute('required');
                toothInput.value = '';
                toothInput.style.borderColor = '#ced4da';

                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            }

        } else {

            costInput.value = '0.00';
        }
    });

    // -----------------------------------------------------
    // Tooth Input
    // -----------------------------------------------------

    toothInput.addEventListener('input', function () {

        if (this.value.trim() === '') {

            // Reset to general procedures.
            showAllProcedures();

            this.style.borderColor = '#ced4da';

            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // Reset procedure selection and cost.
            select.value = '';
            costInput.value = '0.00';

        } else {

            validateToothInput(this);
            filterProceduresForTooth();
        }
    });

    // -----------------------------------------------------
    // Pre-filled Tooth Number from URL
    // -----------------------------------------------------

    const urlParams = new URLSearchParams(window.location.search);
    const toothFromUrl = urlParams.get('tooth');

    if (toothFromUrl) {

        toothInput.value = toothFromUrl;

        toothGroup.style.display = 'block';
        toothInput.style.borderColor = '#10b981';

        filterProceduresForTooth();
    }

    // -----------------------------------------------------
    // Status Dropdowns
    // -----------------------------------------------------

    document.querySelectorAll('.status-select').forEach(statusSelect => {

        statusSelect.addEventListener('change', function () {

            if (this.form) {
                this.form.requestSubmit();
            }
        });
    });

    // -----------------------------------------------------
    // Delete Treatment Confirmation
    // -----------------------------------------------------

    document.querySelectorAll('.treatment-delete-form').forEach(form => {

        form.addEventListener('submit', event => {

            const confirmed = window.confirm(
                'Remove this treatment from the plan?'
            );

            if (!confirmed) {
                event.preventDefault();
            }
        });
    });

});
