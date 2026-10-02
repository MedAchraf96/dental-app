# 📒 Comprehensive Application State Ledger

This document serves as the single source of truth for the current architectural state, database schema, API routes, and client-side memory of the Dental Practice Management & Finance Hub.

---

## 1. Database Schema (Persistent State)

The application uses a SQLite database managed via SQLAlchemy.

### Core Clinic Models

* **`user`**: Authentication and role management.
  * *Fields:* `id`, `username`, `password` (hashed), `role` (e.g., 'admin', 'dentist'), `name`.
* **`patient`**: Core CRM for the dental clinic.
  * *Fields:* `id`, `first_name`, `last_name`, `date_of_birth`, `phone`, `email`, `gender`, `insurance_provider`, `allergies`, `medical_history`, `notes`, `created_at`, `updated_at`, `created_by`.
* **`appointments`**: Scheduling and calendar management.
  * *Fields:* `id`, `patient_id` (FK), `dentist_id` (FK), `start_time`, `end_time`, `treatment_type`, `notes`, `status` ('scheduled', 'completed', 'cancelled'), `completed_at`, `deleted_at`.

### Financial Models (Cash-Basis Architecture)

* **`daily_income`**: Tracks daily clinic revenue.
  * *Fields:* `id`, `date`, `month`, `day_type`, `num_patients`, `amount`.
* **`expense`**: Tracks business outflows (Bills created).
  * *Fields:* `id`, `date`, `due_date`, `category`, `supplier`, `bill_number`, `description`, `total_amount`, `is_declarable`, `vat_amount`.
  * *Dynamic Properties:* `paid_amount`, `balance`, and `status` are **not** database columns. They are `@property` methods in `models.py` that dynamically calculate based on linked `Payment` records.
* **`payment`**: Tracks partial or full payments made against expenses.
  * *Fields:* `id`, `expense_id` (FK), `date`, `amount`, `note`.
* **`cash_balance`**: Tracks real-time physical cash and bank funds.
  * *Fields:* `id`, `date`, `cash_on_hand`, `bank_account`, `note`.
* **`owner_draw`**: Tracks manual monthly owner withdrawals.
  * *Fields:* `id`, `month` (YYYY-MM, unique), `amount`.
* **`lab_work`**: Tracks outsourced dental lab cases.
  * *Fields:* `id`, `record_id`, `month`, `patient_name`, `procedure`, `quantity`, `lab_cost`, `total_cost`, `billed_amount`, `billed_date`, `collected_amount`, `discount`, `remaining`, `actual_lab_paid`, `bill_reference`.

---

## 2. API Routes (State Mutators & Fetchers)

All routes are prefixed under the `finance_bp` blueprint and require `@login_required`.

### Dashboard & Liquidity

* **`GET /api/finance/dashboard`**: Returns current cash/bank balances, Year-to-Date totals, and 24 months of aggregated data for charts.
* **`POST /api/finance/cash-balance`**: Updates the `cash_balance` table.

### Income Management

* **`GET /api/finance/income`**: Returns all `daily_income` records.
* **`POST /api/finance/income`**: Creates or updates a daily income record.
* **`DELETE /api/finance/income/<id>`**: Removes an income record.

### Expense Management

* **`GET /api/finance/expenses`**: Returns all `expense` records (including nested `payments`).
* **`POST /api/finance/expenses`**: Creates or updates an expense.
* **`DELETE /api/finance/expenses/<id>`**: Removes an expense and its associated payments.
* **`POST /api/finance/expenses/<id>/payment`**: Adds a payment to an expense.
* **`DELETE /api/finance/expenses/<exp_id>/payment/<pay_id>`**: Removes a specific payment.

### Monthly Summary & Cash Flow

* **`GET /api/finance/monthly-summary`**: Returns True Cash Flow data for a specific month. Tracks actual cash moved (Payments made) rather than accrual (Bills created). Separates "Operating Expenses" from "Tax/VAT" to prevent double-counting.
* **`POST /api/finance/save-draw`**: Creates or updates the `OwnerDraw` record for the selected month.

---

## 3. Frontend State (Client-Side Memory)

Managed entirely in Vanilla JavaScript (`app/static/js/finance/dashboard.js`) without external state libraries.

### Global Variables

* `allIncomeRecords` / `allExpenseRecords`: Arrays holding full datasets for client-side sorting and filtering.
* `expenseFilter`: Object `{ search: '', category: 'All', status: 'All', month: 'All' }` tracking current table filters.
* `expenseSort`: Object `{ col: 'date', dir: 'desc' }` tracking current table sort state.
* `currentExpenseId`: Integer tracking which expense is currently open in the Payment Modal.

### UI State Management

* **Tab Auto-Refresh:** Clicking any tab button triggers a fresh `fetch()` to the backend, ensuring data is always up-to-date without page reloads.
* **Modals:** "Add/Edit Expense" and "Payment History" are handled via custom overlay Modals to keep the main UI clutter-free.
* **Dynamic Filters:** Category and Month dropdowns are dynamically populated based on the unique values present in the fetched data.

---

## 4. Current Business Logic & Accounting Rules

### Cash-Basis vs Accrual

* **Rule:** The Monthly Summary tracks **Cash Flow**, not Accrual.
* *Example:* If a bill was created in January but paid in April, the cash outflow is recorded in **April's** statement.

### VAT Handling

* **Actual Cash Out:** Tracked manually by creating an Expense with the category "Tax/VAT" and logging a payment against it. This is subtracted from the final liquidity.
* **Theoretical Calculation:** The app calculates `(Income * 0.07) - Prorated Deductible VAT` in the background. This is displayed behind an `ℹ️` info icon for reference, but does not affect the cash flow math.

### Operating Expenses vs Taxes

* **Rule:** To prevent double-counting, the "Operating Expenses" breakdown explicitly excludes the "Tax/VAT" and "Owner's Draw" categories. These are moved to their own dedicated section at the bottom of the statement.

---

*Last Updated: October 02, 2026*
