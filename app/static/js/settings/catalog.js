// app/static/js/settings/catalog.js

document.addEventListener('DOMContentLoaded', function () {

    // 1. Handle Edit Button Clicks
    const editButtons = document.querySelectorAll('.edit-catalog-btn');

    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const data = this.dataset;

            // Change UI
            document.getElementById('form-title').textContent = 'Edit Procedure';
            document.getElementById('submit-btn').textContent = 'Save Changes';
            document.getElementById('cancel-edit-btn').style.display = 'inline-block';

            // Populate fields using dataset
            document.getElementById('catalog-id').value = data.id;
            document.getElementById('name').value = data.name;
            document.getElementById('category').value = data.category;
            document.getElementById('code').value = data.code;
            document.getElementById('cotation').value = data.cotation;
            document.getElementById('default_price').value = data.price;
            document.getElementById('target_type').value = data.target;

            // Scroll to form
            document.getElementById('catalog-form').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // 2. Handle Cancel Edit Button Click
    const cancelBtn = document.getElementById('cancel-edit-btn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            const form = document.getElementById('catalog-form');

            // Reset form fields
            form.reset();
            document.getElementById('catalog-id').value = '';

            // Reset UI
            document.getElementById('form-title').textContent = 'Add New Procedure';
            document.getElementById('submit-btn').textContent = 'Add Procedure';
            this.style.display = 'none'; // Hide cancel button
        });
    }
});