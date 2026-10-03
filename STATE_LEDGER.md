
# 📒 Comprehensive Application State Ledger

This document serves as the single source of truth for the current architectural state, database schema, API routes, and client-side memory of the Dental Practice Management & Finance Hub.

---

## 1. Database Schema (Persistent State)

The application uses a SQLite database managed via SQLAlchemy.

### Core Clinic Models

* **`user`**: Authentication and role management.
  * *Fields:* `id`, `username`, `password` (hashed), `role`, `name`.
* **`patient`**: Core CRM for the dental clinic.
  * *Fields:* `id`, `first_name`, `last_name`, `date_of_birth`, `phone`, `email`, `gender`, `insurance_provider`, `allergies`, `medical_history`, `notes`, `created_at`, `updated_at`, `created_by`.
* **`appointments`**: Scheduling and calendar management.
  * *Fields:* `id`, `patient_id` (FK), `dentist_id` (FK), `start_time`, `end_time`, `treatment_type`, `notes`, `status`, `completed_at`, `deleted_at`.

### Financial Models (Cash-Basis Architecture)

* **`daily_income`**: Tracks daily clinic revenue.
* **`expense`**: Tracks business outflows (Bills created).
  * *Dynamic Properties:* `paid_amount`, `balance`, and `status` are calculated via `@property` methods based on linked `Payment` records.
* **`payment`**: Tracks partial or full payments made against expenses.
* **`cash_balance`**: Tracks real-time physical cash and bank funds.
* **`owner_draw`**: Tracks manual monthly owner withdrawals.
* **`lab_work`**: Tracks outsourced dental lab cases.

### Clinical Models (New)

* **`tooth_record`**: Tracks the state of individual teeth for each patient.
  * *Fields:* `id`, `patient_id` (FK), `tooth_number` (FDI notation, e.g., '11', '48'), `state` ('healthy', 'decayed', 'filled', 'missing'), `updated_at`.
  * *Constraint:* Unique constraint on `(patient_id, tooth_number)` to ensure only one state per tooth.

---

## 2. API Routes (State Mutators & Fetchers)

### Patient & Clinical Routes

* **`GET /patients/<id>/teeth-chart`**: Renders the interactive Teeth Chart UI.
* **`GET /patients/<id>/api/teeth-chart`**: Returns a JSON dictionary of saved tooth states (e.g., `{"11": "filled", "48": "missing"}`).
* **`POST /patients/<id>/api/teeth-chart`**: Saves or updates the state of a single tooth. Payload: `{ tooth_number: string, state: string }`.
* **`DELETE /patients/<id>/api/teeth-chart`**: Resets all teeth for a patient back to 'healthy'.

### Finance Routes (Cash-Flow Architecture)

* **`GET /api/finance/dashboard`**: Returns current cash/bank balances and chart data.
* **`GET /api/finance/expenses`**: Returns all expenses with nested payments.
* **`POST /api/finance/expenses`**: Creates/updates an expense.
* **`POST /api/finance/expenses/<id>/payment`**: Adds a payment to an expense.
* **`GET /api/finance/monthly-summary`**: Returns True Cash Flow data (Operating Expenses separated from Taxes/Draw).

---

## 3. Frontend State (Client-Side Memory)

### Teeth Chart State (`teeth_chart.html`)

* **Layout:** 50/50 split. Left side holds the interactive SVG chart; right side holds the Toolbar, Status Bar, and Clinical Summary.
* **Global Variables:**
  * `savedStates`: Object holding the current state of all 32 teeth.
  * `brushMode`: Boolean toggling between single-click cycling and drag-painting.
  * `brushState`: String holding the currently selected paint state (e.g., 'decayed').
  * `isPainting`: Boolean tracking mouse-down state for drag-painting.
* **Interactions:**
  * **Brush OFF:** Clicking a tooth cycles its state (Healthy → Decayed → Filled → Missing).
  * **Brush ON:** Clicking and dragging across teeth paints them with the selected `brushState`.
  * **Clinical Summary:** Live-updates
