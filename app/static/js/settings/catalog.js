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
            const categorySelect = document.getElementById('category');
            const hasCategoryOption = Array.from(categorySelect.options)
                .some(option => option.value === data.category);
            // Legacy categories remain visible in the table but must be reclassified on edit.
            categorySelect.value = hasCategoryOption ? data.category : '';
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
    // 3. Handle Global Search Filtering
    const searchInput = document.getElementById('catalog-search');
    const tableRows = document.querySelectorAll('.catalog-row');
    const noResultsRow = document.getElementById('no-results-row');

    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            let visibleCount = 0;

            tableRows.forEach(row => {
                // Grabs all text in the row (Name, Code, Category, Price, etc.)
                const rowText = row.textContent.toLowerCase();

                if (rowText.includes(searchTerm)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            // Show "No results" message if nothing matches
            if (noResultsRow) {
                noResultsRow.style.display = (visibleCount === 0 && searchTerm !== '') ? '' : 'none';
            }
        });
    }
});