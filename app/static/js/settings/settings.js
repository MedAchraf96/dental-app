document.addEventListener('DOMContentLoaded', function () {
    const deleteForms = document.querySelectorAll('.delete-user-form');

    deleteForms.forEach(form => {
        form.addEventListener('submit', function (e) {
            // Read the username from the data attribute we passed in the HTML
            const username = this.dataset.username;

            // Native browser confirmation dialog
            if (!confirm(`Are you sure you want to permanently delete the user "${username}"?`)) {
                e.preventDefault(); // Stop the form from submitting
            }
        });
    });
});