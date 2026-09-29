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
    // 2. DASHBOARD LOGIC (Executive Layout)
    // ==========================================
    let globalMonthlyData = [];
    let currentChartTimeframe = 'this_year';

    function loadDashboardData() {
        const container = document.getElementById('dashboard-kpi-container');
        if (!container) return;
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; grid-column: 1/-1;">Loading financial data...</p>';

        fetch('/api/finance/dashboard')
            .then(res => res.json())
            .then(data => {
                globalMonthlyData = data.monthly_data || [];
                const fmt = (amt) => new Intl.NumberFormat('en-TN', { style: 'currency', currency: 'TND' }).format(amt);

                container.innerHTML = `
                <!-- ROW 1: Liquidity & Net Profit (Side-by-Side) -->
                <div style="grid-column: 1 / -1; display: flex; gap: 20px; flex-wrap: wrap;">

                    <!-- Left: Unified Liquidity Card -->
                    <div style="flex: 1; min-width: 300px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #10b981;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <!-- Total Liquidity (Hero) -->
                            <div style="text-align: center; flex: 1; border-right: 1px solid #e5e7eb; padding-right: 20px;">
                                <div style="color: #666; font-size: 13px; font-weight: bold; text-transform: uppercase;">Total Liquidity</div>
                                <div style="font-size: clamp(24px, 4vw, 36px); font-weight: bold; color: #10b981; margin: 5px 0;">${fmt(data.total_liquidity)}</div>
                            </div>

                            <!-- Cash & Bank (Compact Entries) -->
                            <div style="flex: 1.2; min-width: 200px; padding-left: 20px; display: flex; flex-direction: column; gap: 15px;">
                                <!-- Cash Entry -->
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="color: #666; font-size: 11px; font-weight: bold; text-transform: uppercase;">Cash on Hand</div>
                                        <div id="cash-display" style="font-size: clamp(14px, 2vw, 18px); font-weight: bold; color: #059669; white-space: nowrap;">${fmt(data.cash_on_hand)}</div>
                                    </div>
                                    <button id="edit-cash-btn" style="background: none; border: none; color: #999; cursor: pointer; font-size: 14px;">✏️</button>
                                    <form id="cash-form" style="display: none; gap: 5px;">
                                        <input type="number" id="input-cash" name="cash_on_hand" step="0.01" value="${data.cash_on_hand}" aria-label="Cash on Hand" style="width: 90px; padding: 5px; text-align: center; border: 1px solid #ccc; border-radius: 4px;" required>
                                        <button type="submit" style="padding: 5px 10px; font-size: 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                                    </form>
                                </div>

                                <!-- Bank Entry -->
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="color: #666; font-size: 11px; font-weight: bold; text-transform: uppercase;">Bank Account</div>
                                        <div id="bank-display" style="font-size: clamp(14px, 2vw, 18px); font-weight: bold; color: #059669; white-space: nowrap;">${fmt(data.bank_account)}</div>
                                    </div>
                                    <button id="edit-bank-btn" style="background: none; border: none; color: #999; cursor: pointer; font-size: 14px;">✏️</button>
                                    <form id="bank-form" style="display: none; gap: 5px;">
                                        <input type="number" id="input-bank" name="bank_account" step="0.01" value="${data.bank_account}" aria-label="Bank Account" style="width: 90px; padding: 5px; text-align: center; border: 1px solid #ccc; border-radius: 4px;" required>
                                        <button type="submit" style="padding: 5px 10px; font-size: 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Net Profit Card (Matching Style) -->
                    <div style="flex: 1; min-width: 300px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #3b82f6;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <!-- Net Profit (Hero) -->
                            <div style="text-align: center; flex: 1; border-right: 1px solid #e5e7eb; padding-right: 20px;">
                                <div style="color: #666; font-size: 13px; font-weight: bold; text-transform: uppercase;">Current Year Net Profit</div>
                                <div style="font-size: clamp(24px, 4vw, 36px); font-weight: bold; color: ${data.current_year_net_profit >= 0 ? '#10b981' : '#ef4444'}; margin: 5px 0;">${fmt(data.current_year_net_profit)}</div>
                            </div>

                            <!-- Income & Expenses (Compact Entries) -->
                            <div style="flex: 1.2; min-width: 200px; padding-left: 20px; display: flex; flex-direction: column; gap: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="color: #666; font-size: 11px; font-weight: bold; text-transform: uppercase;">Total Income</div>
                                        <div style="font-size: clamp(14px, 2vw, 18px); font-weight: bold; color: #1e3a8a; white-space: nowrap;">${fmt(data.current_year_revenue)}</div>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="color: #666; font-size: 11px; font-weight: bold; text-transform: uppercase;">Total Expenses</div>
                                        <div style="font-size: clamp(14px, 2vw, 18px); font-weight: bold; color: #ef4444; white-space: nowrap;">${fmt(data.current_year_expenses)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROW 2: Chart Controls -->
                <div style="grid-column: 1 / -1; display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
                    <button id="btn-this-year" style="padding: 6px 16px; border-radius: 20px; border: 1px solid #ddd; background: #3b82f6; color: white; font-weight: bold; cursor: pointer; font-size: 13px;">This Year</button>
                    <button id="btn-last-12" style="padding: 6px 16px; border-radius: 20px; border: 1px solid #ddd; background: white; color: #666; cursor: pointer; font-size: 13px;">Last 12 Months</button>
                </div>

                <!-- ROW 3: Analytics (Side by Side) -->
                <div style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px;">
                    <!-- Chart 1: CSS Bar Chart -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #1e3a8a;">
                        <div style="color: #666; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">Monthly Income vs Expenses</div>
                        <div id="bar-chart-container" style="width: 100%;"></div>
                        <div style="display: flex; justify-content: center; gap: 15px; margin-top: 10px; font-size: 11px; color: #666;">
                            <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#1e3a8a; border-radius:2px;"></span> Income</span>
                            <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#ef4444; border-radius:2px;"></span> Expenses</span>
                        </div>
                    </div>
                    <!-- Chart 2: SVG Line Chart -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #8b5cf6;">
                        <div style="color: #666; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">Monthly Net Tendencies</div>
                        <div id="line-chart-container" style="width: 100%;"></div>
                    </div>
                </div>
            `;

                // Attach listeners
                document.getElementById('btn-this-year')?.addEventListener('click', () => setChartTimeframe('this_year'));
                document.getElementById('btn-last-12')?.addEventListener('click', () => setChartTimeframe('last_12'));
                setupCashBankEditListeners();
                updateCharts();
            })
            .catch(err => {
                if (container) container.innerHTML = '<p style="color: red; grid-column: 1/-1;">Error loading dashboard data.</p>';
            });
    }

    function setupCashBankEditListeners() {
        const setupField = (type) => {
            const editBtn = document.getElementById(`edit-${type}-btn`);
            const form = document.getElementById(`${type}-form`);
            const display = document.getElementById(`${type}-display`);
            const input = document.getElementById(`input-${type}`);

            if (editBtn && form && display && input) {
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    display.style.display = 'none';
                    editBtn.style.display = 'none';
                    form.style.display = 'flex';
                    input.focus();
                });

                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const payload = {
                        cash_on_hand: parseFloat(document.getElementById('input-cash').value),
                        bank_account: parseFloat(document.getElementById('input-bank').value)
                    };

                    fetch('/api/finance/cash-balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
                        body: JSON.stringify(payload)
                    }).then(res => {
                        if (res.ok) loadDashboardData();
                    });
                });
            }
        };
        setupField('cash');
        setupField('bank');
    }

    function setChartTimeframe(timeframe) {
        currentChartTimeframe = timeframe;
        const btnThis = document.getElementById('btn-this-year');
        const btnLast = document.getElementById('btn-last-12');

        if (btnThis && btnLast) {
            btnThis.style.background = timeframe === 'this_year' ? '#3b82f6' : 'white';
            btnThis.style.color = timeframe === 'this_year' ? 'white' : '#666';
            btnLast.style.background = timeframe === 'last_12' ? '#3b82f6' : 'white';
            btnLast.style.color = timeframe === 'last_12' ? 'white' : '#666';
        }
        updateCharts();
    }

    function updateCharts() {
        const currentYear = new Date().getFullYear().toString();
        const filteredData = currentChartTimeframe === 'this_year'
            ? globalMonthlyData.filter(d => d.month.startsWith(currentYear))
            : globalMonthlyData.slice(-12);

        renderBarChart(filteredData);
        renderLineChart(filteredData);
    }

    function renderBarChart(data) {
        const container = document.getElementById('bar-chart-container');
        if (!container || !data || data.length === 0) {
            if (container) container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">No data available</p>';
            return;
        }

        const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)), 100) * 1.1;
        const chartHeight = 140;

        container.innerHTML = `<div style="display: flex; align-items: flex-end; justify-content: space-around; height: ${chartHeight}px; width: 100%; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">` +
            data.map(d => {
                const revH = d.revenue > 0 ? Math.max((d.revenue / maxVal) * chartHeight, 4) : 0;
                const expH = d.expenses > 0 ? Math.max((d.expenses / maxVal) * chartHeight, 4) : 0;

                return `
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 4px;">
                    <div style="display: flex; align-items: flex-end; gap: 3px; height: ${chartHeight}px; width: 100%; justify-content: center;">
                        <div style="width: 14px; background: #1e3a8a; border-radius: 2px 2px 0 0; height: ${revH}px;" title="Income: ${d.revenue.toFixed(0)} TND"></div>
                        <div style="width: 14px; background: #ef4444; border-radius: 2px 2px 0 0; height: ${expH}px;" title="Expenses: ${d.expenses.toFixed(0)} TND"></div>
                    </div>
                    <div style="font-size: 10px; color: #666; font-weight: 500;">${d.label.split(' ')[0]}</div>
                </div>`;
            }).join('') + `</div>`;
    }

    function renderLineChart(data) {
        const container = document.getElementById('line-chart-container');
        if (!container || !data || data.length === 0) {
            if (container) container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">No data available</p>';
            return;
        }

        const width = container.clientWidth || 400;
        const height = 160;
        const padding = 30;

        const nets = data.map(d => d.net);
        const maxNet = Math.max(...nets, 0);
        const minNet = Math.min(...nets, 0);

        const rawRange = maxNet - minNet;
        const range = rawRange === 0 ? Math.max(maxNet, 100) : rawRange;

        const yPadding = range * 0.2;
        const yMax = maxNet + yPadding;
        const yMin = Math.min(0, minNet - yPadding);
        const yRange = yMax - yMin;

        const getX = (i) => padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
        const getY = (val) => height - padding - ((val - yMin) / yRange) * (height - 2 * padding);

        let pathD = `M ${getX(0)} ${getY(nets[0])}`;
        let pointsHtml = `<circle cx="${getX(0)}" cy="${getY(nets[0])}" r="4" fill="#8b5cf6" />`;

        for (let i = 1; i < data.length; i++) {
            pathD += ` L ${getX(i)} ${getY(nets[i])}`;
            pointsHtml += `<circle cx="${getX(i)}" cy="${getY(nets[i])}" r="4" fill="#8b5cf6" />`;
        }

        const yZero = getY(0);
        const zeroLine = `<line x1="${padding}" y1="${yZero}" x2="${width - padding}" y2="${yZero}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4" />`;

        const yLabelMax = `<text x="${padding - 5}" y="${getY(yMax) + 4}" text-anchor="end" font-size="9" fill="#999">${yMax.toFixed(0)}</text>`;
        const yLabelMin = `<text x="${padding - 5}" y="${getY(yMin) + 4}" text-anchor="end" font-size="9" fill="#999">${yMin.toFixed(0)}</text>`;

        const step = Math.ceil(data.length / 6);
        let labelsHtml = '';
        for (let i = 0; i < data.length; i += step) {
            labelsHtml += `<text x="${getX(i)}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#666">${data[i].label}</text>`;
        }

        container.innerHTML = `
            <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
                ${zeroLine}
                ${yLabelMax}
                ${yLabelMin}
                <path d="${pathD}" fill="none" stroke="#8b5cf6" stroke-width="2.5" />
                ${pointsHtml}
                ${labelsHtml}
            </svg>
        `;
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
            .then(data => { allIncomeRecords = data; renderIncomeTable(); })
            .catch(err => { if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Error loading income data.</td></tr>'; });
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
                if (th.dataset.col === incomeSort.col) icon.textContent = incomeSort.dir === 'asc' ? '▲' : '▼';
                else icon.textContent = '↕';
            }
        });
    }

    document.querySelectorAll('.sortable-income').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (incomeSort.col === col) incomeSort.dir = incomeSort.dir === 'asc' ? 'desc' : 'asc';
            else { incomeSort.col = col; incomeSort.dir = 'asc'; }
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
            }).then(res => {
                if (res.ok) { resetIncomeForm(); loadIncomeData(); }
                else alert('Error saving record.');
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
        fetch(`/api/finance/income/${id}`, { method: 'DELETE', headers: { 'X-CSRFToken': getCsrfToken() } })
            .then(res => { if (res.ok) loadIncomeData(); });
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
        fetch('/api/finance/expenses').then(res => res.json()).then(data => {
            allExpenseRecords = data; renderExpenseTable();
        }).catch(err => { if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 20px; text-align: center; color: red;">Error loading expenses.</td></tr>'; });
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

    const declarableCheckbox = document.getElementById('exp-declarable');
    const vatContainer = document.getElementById('vat-input-container');
    if (declarableCheckbox && vatContainer) {
        declarableCheckbox.addEventListener('change', () => {
            vatContainer.style.display = declarableCheckbox.checked ? 'flex' : 'none';
            if (!declarableCheckbox.checked) document.getElementById('exp-vat').value = 0;
        });
    }

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
            fetch('/api/finance/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() }, body: JSON.stringify(payload) })
                .then(res => { if (res.ok) { resetExpenseForm(); loadExpenseData(); loadDashboardData(); } else alert('Error saving expense.'); });
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
    // 5. INITIALIZE DATA
    // ==========================================
    loadDashboardData();
    loadIncomeData();
    loadExpenseData();
});