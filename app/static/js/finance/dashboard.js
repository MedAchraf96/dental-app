// ==========================================
// 1. TAB SWITCHING LOGIC
// ==========================================
window.switchTab = function (tabName) {
    const tabButtons = document.querySelectorAll('.finance-tab-btn');
    const tabContents = document.querySelectorAll('.finance-tab-content');

    tabButtons.forEach(btn => {
        btn.style.borderBottom = '3px solid transparent';
        btn.style.color = '#6b7280';
        btn.style.fontWeight = 'normal';
    });

    const activeBtn = document.querySelector(`.finance-tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.style.borderBottom = '3px solid #1e3a8a';
        activeBtn.style.color = '#1e3a8a';
        activeBtn.style.fontWeight = 'bold';
    }

    tabContents.forEach(content => content.style.display = 'none');
    const targetContent = document.getElementById('tab-' + tabName);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';

    };
    document.querySelectorAll('.finance-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.switchTab(btn.getAttribute('data-tab'));
        });
    });

    // ==========================================
    // 2. DASHBOARD LOGIC (Restored all 9 cards)
    // ==========================================
    function loadDashboardData() {
        const container = document.getElementById('dashboard-kpi-container');
        if (!container) return;

        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; grid-column: 1/-1;">Loading financial data...</p>';

        fetch('/api/finance/dashboard')
            .then(res => res.json())
            .then(data => {
                const formatCurrency = (amount) => new Intl.NumberFormat('en-TN', { style: 'currency', currency: 'TND' }).format(amount);
                const profitMargin = data.total_revenue > 0 ? ((data.net_profit / data.total_revenue) * 100).toFixed(1) : 0;
                const profitColor = data.net_profit >= 0 ? '#10b981' : '#ef4444';

                // VAT Calculation: Collected (7% of revenue) minus Deductible (sum from declarable expenses)
                const vatCollected = data.total_revenue * 0.07;
                const vatDeductible = data.total_vat_deductible || 0;
                const netVatDue = vatCollected - vatDeductible;
                const vatColor = netVatDue >= 0 ? '#d97706' : '#10b981';

                container.innerHTML = `
                <!-- ROW 1: Core Metrics -->
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #1e3a8a; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Total Revenue</div>
                    <div style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 10px 0;">${formatCurrency(data.total_revenue)}</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #ef4444; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Business Expenses</div>
                    <div style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 10px 0;">${formatCurrency(data.business_expenses)}</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #10b981; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Net Profit</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${profitColor}; margin: 10px 0;">${formatCurrency(data.net_profit)}</div>
                    <div style="color: #999; font-size: 12px;">Margin: ${profitMargin}%</div>
                </div>
                
                <!-- ROW 2: CASH & BANK (Interactive) -->
                 <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #059669; text-align: center;">
                     <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Cash on Hand</div>
                     <div id="cash-display" style="font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0;">${formatCurrency(data.cash_on_hand)}</div>
                     <button id="edit-cash-btn" style="background: none; border: none; color: #999; cursor: pointer; font-size: 14px;">✏️ Edit</button>
                     <form id="cash-form" style="display: none; margin-top: 10px; justify-content: center; gap: 5px;">
                         <input type="number" name="cash_on_hand" step="0.01" value="${data.cash_on_hand}" style="width: 100px; padding: 5px; text-align: center; border: 1px solid #ccc; border-radius: 4px;" required>
                         <input type="hidden" name="bank_account" value="${data.bank_account}"> 
                         <button type="submit" style="padding: 5px 10px; font-size: 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                     </form>
                 </div>

                 <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #059669; text-align: center;">
                     <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Bank Account</div>
                     <div id="bank-display" style="font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0;">${formatCurrency(data.bank_account)}</div>
                     <button id="edit-bank-btn" style="background: none; border: none; color: #999; cursor: pointer; font-size: 14px;">✏️ Edit</button>
                     <form id="bank-form" style="display: none; margin-top: 10px; justify-content: center; gap: 5px;">
                         <input type="hidden" name="cash_on_hand" value="${data.cash_on_hand}">
                         <input type="number" name="bank_account" step="0.01" value="${data.bank_account}" style="width: 100px; padding: 5px; text-align: center; border: 1px solid #ccc; border-radius: 4px;" required>
                         <button type="submit" style="padding: 5px 10px; font-size: 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                     </form>
                 </div>

                 
                 
                 <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #10b981; text-align: center;">
                     <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Total Liquidity</div>
                     <div style="font-size: 24px; font-weight: bold; color: #10b981; margin: 10px 0;">${formatCurrency(data.total_liquidity)}</div>
                 </div>

                <!-- ROW 3: Outflows -->
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #f59e0b; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Owner's Draw</div>
                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b; margin: 10px 0;">${formatCurrency(data.owners_draw)}</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #8b5cf6; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Tax / VAT Payments</div>
                    <div style="font-size: 24px; font-weight: bold; color: #8b5cf6; margin: 10px 0;">${formatCurrency(data.tax_payments)}</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #6b7280; text-align: center;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Total Expenses</div>
                    <div style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 10px 0;">${formatCurrency(data.total_expenses)}</div>
                </div>

                <!-- ROW 4: VAT Summary (NEW) -->
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #d97706; text-align: center; grid-column: 1 / -1;">
                    <div style="color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase;">Net VAT Due to State</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${vatColor}; margin: 10px 0;">${formatCurrency(netVatDue)}</div>
                    <div style="color: #999; font-size: 12px;">Collected: ${formatCurrency(vatCollected)} | Deductible: ${formatCurrency(vatDeductible)}</div>
                </div>
            `;

                // Re-attach edit listeners for Cash/Bank if they exist in your JS
                if (typeof setupCashBankEditListeners === 'function') {
                    setupCashBankEditListeners();
                }
            })
            .catch(err => {
                if (container) container.innerHTML = '<p style="color: red;">Error loading dashboard data.</p>';
            });
    }

    function setupCashBankEditListeners() {
        // Helper to get CSRF token
        const getCsrfToken = () => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : '';
        };

        // --- Cash Edit Logic ---
        const editCashBtn = document.getElementById('edit-cash-btn');
        const cashForm = document.getElementById('cash-form');
        const cashDisplay = document.getElementById('cash-display');

        if (editCashBtn && cashForm && cashDisplay) {
            editCashBtn.addEventListener('click', () => {
                cashDisplay.style.display = 'none';
                editCashBtn.style.display = 'none';
                cashForm.style.display = 'flex';
            });

            cashForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(cashForm);
                const payload = {
                    cash_on_hand: parseFloat(formData.get('cash_on_hand')),
                    bank_account: parseFloat(formData.get('bank_account'))
                };

                fetch('/api/finance/update-balance', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify(payload)
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.message) {
                            // Reload dashboard to show new values
                            loadDashboardData();
                        }
                    })
                    .catch(error => console.error('Error updating balance:', error));
            });
        }

        // --- Bank Edit Logic ---
        const editBankBtn = document.getElementById('edit-bank-btn');
        const bankForm = document.getElementById('bank-form');
        const bankDisplay = document.getElementById('bank-display');

        if (editBankBtn && bankForm && bankDisplay) {
            editBankBtn.addEventListener('click', () => {
                bankDisplay.style.display = 'none';
                editBankBtn.style.display = 'none';
                bankForm.style.display = 'flex';
            });

            bankForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(bankForm);
                const payload = {
                    cash_on_hand: parseFloat(formData.get('cash_on_hand')),
                    bank_account: parseFloat(formData.get('bank_account'))
                };

                fetch('/api/finance/update-balance', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify(payload)
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.message) {
                            loadDashboardData();
                        }
                    })
                    .catch(error => console.error('Error updating balance:', error));
            });
        }
    }

    // ==========================================
    // 3. DAILY INCOME LOGIC
    // ==========================================
    let allIncomeRecords = [];
    let incomeSort = { col: 'date', dir: 'desc' };

    function loadIncomeData() {
        const tbody = document.getElementById('income-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #666;">Loading records...</td></tr>';

        fetch('/api/finance/income')
            .then(res => res.json())
            .then(data => {
                allIncomeRecords = data;
                renderIncomeTable();
            })
            .catch(err => {
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Error loading income data. Check console.</td></tr>';
            });
    }

    function renderIncomeTable() {
        const tbody = document.getElementById('income-table-body');
        if (!tbody) return;

        const sorted = [...allIncomeRecords].sort((a, b) => {
            let valA = a[incomeSort.col];
            let valB = b[incomeSort.col];
            if (incomeSort.col === 'num_patients' || incomeSort.col === 'amount') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return incomeSort.dir === 'asc' ? valA - valB : valB - valA;
            }
            return incomeSort.dir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No income records yet.</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(record => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${record.date_display}</td>
                <td style="padding: 12px;">${record.day_type}</td>
                <td style="padding: 12px;">${record.num_patients}</td>
                <td style="padding: 12px; color: #10b981; font-weight: bold;">${parseFloat(record.amount).toFixed(2)}</td>
                <td style="padding: 12px;">
                    <button onclick="editIncome(${record.id})" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Edit</button>
                    <button onclick="deleteIncome(${record.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.sortable-income').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                if (th.dataset.col === incomeSort.col) {
                    icon.textContent = incomeSort.dir === 'asc' ? '▲' : '▼';
                } else {
                    icon.textContent = '↕';
                }
            }
        });
    }

    document.querySelectorAll('.sortable-income').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (incomeSort.col === col) {
                incomeSort.dir = incomeSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                incomeSort.col = col;
                incomeSort.dir = 'asc';
            }
            renderIncomeTable();
        });
    });

    const incomeForm = document.getElementById('income-form');
    if (incomeForm) {
        incomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                id: document.getElementById('income-id').value || null,
                date: document.getElementById('income-date').value,
                day_type: document.getElementById('income-day-type').value,
                num_patients: document.getElementById('income-patients').value,
                amount: document.getElementById('income-amount').value
            };
            fetch('/api/finance/income', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
                body: JSON.stringify(payload)
            })
                .then(res => {
                    if (res.ok) {
                        resetIncomeForm();
                        loadIncomeData(); // Refresh table after saving
                    } else {
                        alert('Error saving record.');
                    }
                });
        });
    }

    window.editIncome = function (id) {
        const record = allIncomeRecords.find(r => r.id === id);
        if (!record) return;
        document.getElementById('income-id').value = record.id;
        document.getElementById('income-date').value = record.date;
        document.getElementById('income-day-type').value = record.day_type;
        document.getElementById('income-patients').value = record.num_patients;
        document.getElementById('income-amount').value = record.amount;
        document.getElementById('income-form-title').textContent = 'Edit Income Record';
        document.getElementById('income-submit-btn').textContent = 'Update Income';
        document.getElementById('cancel-income-edit').style.display = 'block';
        incomeForm.scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteIncome = function (id) {
        if (!confirm('Are you sure you want to delete this record?')) return;
        fetch(`/api/finance/income/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() }
        }).then(res => { if (res.ok) loadIncomeData(); });
    };

    window.resetIncomeForm = function () {
        if (incomeForm) incomeForm.reset();
        document.getElementById('income-id').value = '';
        document.getElementById('income-form-title').textContent = 'Add Daily Income';
        document.getElementById('income-submit-btn').textContent = 'Save Income';
        document.getElementById('cancel-income-edit').style.display = 'none';
    };

    const cancelBtn = document.getElementById('cancel-income-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', window.resetIncomeForm);

    // ==========================================
    // 4. EXPENSES LOGIC
    // ==========================================
    let allExpenseRecords = [];
    let currentExpenseId = null;

    function loadExpenseData() {
        const tbody = document.getElementById('expense-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9" style="padding: 20px; text-align: center; color: #666;">Loading expenses...</td></tr>';
        fetch('/api/finance/expenses').then(res => res.json()).then(data => { allExpenseRecords = data; renderExpenseTable(); }).catch(err => { if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 20px; text-align: center; color: red;">Error loading expenses.</td></tr>'; });
    }

    function renderExpenseTable() {
        const tbody = document.getElementById('expense-table-body');
        if (!tbody) return;
        if (allExpenseRecords.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="padding: 20px; text-align: center; color: #999;">No expenses yet.</td></tr>'; return; }
        tbody.innerHTML = allExpenseRecords.map(r => {
            let statusColor = r.status === 'Paid' ? '#10b981' : (r.status === 'Partial' ? '#f59e0b' : '#ef4444');
            return `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${r.date_display}</td><td style="padding: 12px;">${r.category}</td><td style="padding: 12px;">${r.supplier || '-'}</td>
                <td style="padding: 12px;">${parseFloat(r.total_amount).toFixed(2)}</td><td style="padding: 12px;">${parseFloat(r.paid_amount).toFixed(2)}</td>
                <td style="padding: 12px; color: #ef4444; font-weight: bold;">${parseFloat(r.balance).toFixed(2)}</td><td style="padding: 12px;">${r.due_date_display}</td>
                <td style="padding: 12px;"><span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">${r.status}</span></td>
                <td style="padding: 12px;">
                    <button onclick="openPaymentModal(${r.id})" style="background: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px;">💰</button>
                    <button onclick="editExpense(${r.id})" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Edit</button>
                    <button onclick="deleteExpense(${r.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            </tr>`;
        }).join('');
    }

    // TVA Toggle
    const declarableCheckbox = document.getElementById('exp-declarable');
    const vatContainer = document.getElementById('vat-input-container');
    if (declarableCheckbox && vatContainer) {
        declarableCheckbox.addEventListener('change', () => {
            vatContainer.style.display = declarableCheckbox.checked ? 'flex' : 'none';
            if (!declarableCheckbox.checked) document.getElementById('exp-vat').value = 0;
        });
    }

    // Expense Form Submit
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                id: document.getElementById('expense-id').value || null,
                date: document.getElementById('exp-date').value,
                due_date: document.getElementById('exp-due-date').value,
                category: document.getElementById('exp-category').value,
                supplier: document.getElementById('exp-supplier').value,
                bill_number: document.getElementById('exp-bill').value,
                total_amount: document.getElementById('exp-total').value,
                description: document.getElementById('exp-desc').value,
                is_declarable: document.getElementById('exp-declarable').checked,
                vat_amount: document.getElementById('exp-vat').value
            };
            fetch('/api/finance/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() }, body: JSON.stringify(payload) }).then(res => { if (res.ok) { resetExpenseForm(); loadExpenseData(); loadDashboardData(); } else alert('Error saving expense.'); });
        });
    }

    window.editExpense = function (id) {
        const r = allExpenseRecords.find(rec => rec.id === id); if (!r) return;
        document.getElementById('expense-id').value = r.id; document.getElementById('exp-date').value = r.date; document.getElementById('exp-due-date').value = r.due_date; document.getElementById('exp-category').value = r.category; document.getElementById('exp-supplier').value = r.supplier || ''; document.getElementById('exp-bill').value = r.bill_number || ''; document.getElementById('exp-total').value = r.total_amount; document.getElementById('exp-desc').value = r.description || ''; document.getElementById('exp-declarable').checked = r.is_declarable; document.getElementById('exp-vat').value = r.vat_amount;
        if (declarableCheckbox) declarableCheckbox.dispatchEvent(new Event('change'));
        document.getElementById('expense-form-title').textContent = 'Edit Expense'; document.getElementById('expense-submit-btn').textContent = 'Update Expense'; document.getElementById('cancel-expense-edit').style.display = 'block'; expenseForm.scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteExpense = function (id) { if (!confirm('Delete this expense?')) return; fetch(`/api/finance/expenses/${id}`, { method: 'DELETE', headers: { 'X-CSRFToken': getCsrfToken() } }).then(res => { if (res.ok) { loadExpenseData(); loadDashboardData(); } }); };

    window.resetExpenseForm = function () { if (expenseForm) expenseForm.reset(); document.getElementById('expense-id').value = ''; document.getElementById('expense-form-title').textContent = 'Add Expense'; document.getElementById('expense-submit-btn').textContent = 'Save Expense'; document.getElementById('cancel-expense-edit').style.display = 'none'; if (declarableCheckbox) { declarableCheckbox.checked = true; declarableCheckbox.dispatchEvent(new Event('change')); } };
    const cancelExpBtn = document.getElementById('cancel-expense-edit'); if (cancelExpBtn) cancelExpBtn.addEventListener('click', window.resetExpenseForm);

    // Payment Modal
    window.openPaymentModal = function (id) {
        currentExpenseId = id;
        const r = allExpenseRecords.find(rec => rec.id === id); if (!r) return;
        document.getElementById('payment-modal-title').textContent = `Payments for ${r.category} (${r.supplier || ''})`;
        const tbody = document.getElementById('payment-history-body');
        if (r.payments.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #999;">No payments yet</td></tr>'; }
        else { tbody.innerHTML = r.payments.map(p => `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${p.date}</td><td style="padding: 8px;">${parseFloat(p.amount).toFixed(2)}</td><td style="padding: 8px;">${p.note || '-'}</td><td style="padding: 8px;"><button onclick="deletePayment(${r.id}, ${p.id})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">✕</button></td></tr>`).join(''); }
        document.getElementById('payment-modal').style.display = 'flex';
    };

    document.getElementById('close-payment-modal').addEventListener('click', () => { document.getElementById('payment-modal').style.display = 'none'; currentExpenseId = null; });

    document.getElementById('add-payment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = { date: document.getElementById('pay-date').value, amount: document.getElementById('pay-amount').value, note: document.getElementById('pay-note').value };
        fetch(`/api/finance/expenses/${currentExpenseId}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() }, body: JSON.stringify(payload) }).then(res => { if (res.ok) { document.getElementById('add-payment-form').reset(); loadExpenseData(); openPaymentModal(currentExpenseId); loadDashboardData(); } });
    });

    window.deletePayment = function (expId, payId) { if (!confirm('Delete this payment?')) return; fetch(`/api/finance/expenses/${expId}/payment/${payId}`, { method: 'DELETE', headers: { 'X-CSRFToken': getCsrfToken() } }).then(res => { if (res.ok) { loadExpenseData(); openPaymentModal(expId); loadDashboardData(); } }); };

    // ==========================================
    // 4. INITIALIZE DATA (THE MISSING KEY!)
    // ==========================================
    loadDashboardData();
    loadIncomeData(); // <--- THIS WAS MISSING! This turns on the table.
    loadExpenseData();

});