document.addEventListener('DOMContentLoaded', function () {
    const appData = window.APP_DATA || {};
    const csrfToken = appData.csrfToken || '';
    const patientId = appData.patientId || '';

    const modal = document.getElementById('paymentModal');
    const paymentForm = document.getElementById('paymentForm');
    let currentTreatmentId = null;

    // ==========================================
    // 1. PAYMENT MODAL LOGIC
    // ==========================================
    document.querySelectorAll('.record-payment-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            currentTreatmentId = this.getAttribute('data-treatment-id');
            const balance = this.getAttribute('data-balance');
            const procedure = this.getAttribute('data-procedure');

            document.getElementById('modalBalance').textContent = balance + ' DT';
            document.getElementById('modalProcedure').value = procedure;
            document.getElementById('paymentAmount').value = balance;
            document.getElementById('paymentAmount').max = balance;
            document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

            // Fetch credit balance to update the dropdown option dynamically
            fetch(`/patients/${patientId}/financial-summary`)
                .then(res => res.json())
                .then(data => {
                    const creditBalance = data.total_balance > 0 ? data.total_balance : 0;
                    const paymentMethodSelect = document.getElementById('paymentMethod');
                    let creditOption = paymentMethodSelect.querySelector('option[value="credit_balance"]');

                    if (creditOption) {
                        if (creditBalance > 0) {
                            creditOption.disabled = false;
                            creditOption.textContent = `💳 Utiliser le Crédit (${creditBalance.toFixed(2)} DT)`;
                            creditOption.style.color = '#10b981';
                            paymentMethodSelect.value = 'credit_balance';
                        } else {
                            creditOption.disabled = true;
                            creditOption.textContent = '💳 Crédit Insuffisant';
                            creditOption.style.color = '#94a3b8';
                            paymentMethodSelect.value = 'Cash';
                        }
                    }
                })
                .catch(err => console.error('Error fetching credit balance:', err));

            if (modal) {
                modal.classList.add('active');
            }
        });
    });

    function closePaymentModal() {
        if (modal) {
            modal.classList.remove('active');
        }
        if (paymentForm) {
            paymentForm.reset();
        }
        currentTreatmentId = null;
    }

    document.querySelectorAll('.close-payment-modal-btn').forEach(btn => {
        btn.addEventListener('click', closePaymentModal);
    });

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closePaymentModal();
        });
    }

    if (paymentForm) {
        paymentForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const amount = document.getElementById('paymentAmount').value;
            const method = document.getElementById('paymentMethod').value;
            const date = document.getElementById('paymentDate').value;

            if (!amount || amount <= 0) {
                alert('Veuillez entrer un montant valide');
                return;
            }

            try {
                const response = await fetch(`/patients/${patientId}/financial/add-payment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': csrfToken
                    },
                    body: `treatment_id=${currentTreatmentId}&amount=${amount}&method=${method}&payment_date=${date}&csrf_token=${csrfToken}`
                });

                if (response.ok) {
                    closePaymentModal();
                    window.location.reload();
                } else {
                    throw new Error('Erreur lors de l\'enregistrement');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Erreur: ' + error.message);
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closePaymentModal();
        }
    });

    // ==========================================
    // 2. PAYMENT HISTORY MODAL LOGIC
    // ==========================================
    const historyModal = document.getElementById('historyModal');
    const historyList = document.getElementById('historyList');
    const historyProcedureName = document.getElementById('historyProcedureName');

    function openPaymentHistory(element) {
        const paymentsJson = element.getAttribute('data-payments');
        const procedure = element.getAttribute('data-procedure');

        if (historyProcedureName) {
            historyProcedureName.textContent = procedure;
        }
        if (historyList) {
            historyList.innerHTML = '';
        }

        try {
            const payments = JSON.parse(paymentsJson);

            if (!payments || payments.length === 0) {
                if (historyList) {
                    historyList.innerHTML = '<div class="empty-history">Aucun paiement enregistré</div>';
                }
            } else {
                payments.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <span class="history-date"><i class="bi bi-calendar3" style="margin-right: 4px;"></i> ${p.date}</span>
                        <span class="history-method">${p.method}</span>
                        <span class="history-amount">${parseFloat(p.amount).toFixed(2)} DT</span>
                    `;
                    if (historyList) {
                        historyList.appendChild(item);
                    }
                });
            }
        } catch (e) {
            if (historyList) {
                historyList.innerHTML = '<div class="empty-history">Erreur de chargement</div>';
            }
        }

        if (historyModal) {
            historyModal.classList.add('active');
        }
    }

    function closeHistoryModal() {
        if (historyModal) {
            historyModal.classList.remove('active');
        }
    }

    document.querySelectorAll('.open-payment-history-btn').forEach(trigger => {
        trigger.addEventListener('click', function () {
            openPaymentHistory(this);
        });
    });

    document.querySelectorAll('.close-history-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeHistoryModal);
    });

    if (historyModal) {
        historyModal.addEventListener('click', function (e) {
            if (e.target === historyModal) closeHistoryModal();
        });
    }

    // ==========================================
    // 3. BALANCE COLORING LOGIC (Decoupled)
    // ==========================================

    // Reste Dû Coloring (Red if > 0, Gray if 0)
    const resteEl = document.getElementById('reste-du');
    if (resteEl) {
        const text = resteEl.textContent.trim().replace(' DT', '');
        const val = parseFloat(text);

        if (val > 0) {
            resteEl.style.color = '#ef4444';
        } else {
            resteEl.style.color = '#64748b';
        }
    }

    // Solde Patient Coloring (Now just raw credit balance)
    const soldeEl = document.getElementById('solde-patient');
    if (soldeEl) {
        const text = soldeEl.textContent.trim().replace(' DT', '').replace('+', '');
        const val = parseFloat(text);

        if (val > 0) {
            soldeEl.style.color = '#10b981';
            soldeEl.textContent = '+' + val.toFixed(2) + ' DT (Crédit)';
        } else {
            soldeEl.style.color = '#64748b';
            soldeEl.textContent = '0.00 DT';
        }
    }
});
