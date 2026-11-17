# 🦷 Dental Practice Management System: State Ledger & Architecture Map

This document serves as the master reference for data flow, state management, and architectural rules of the Dental Practice System.

---

## 1. Database Schema (Source of Truth)

### A. Patient & Clinical Data

| Model                     | Key Fields                                                                                           | Purpose & Relationships                                                                                      |
| :------------------------ | :--------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`Patient`**     | `id`, `first_name`, `last_name`, `dob`, `phone`, `email`, `medical_history`, `notes` | The central hub. All other models link here via`patient_id`.                                               |
| **`ToothRecord`** | `patient_id`, `tooth_number` (11-48), `state`                                                  | Stores the visual state of the Teeth Chart (`healthy`, `decayed`, `filled`, `missing`, `implant`). |
| **`Prosthetic`**  | `patient_id`, `type`, `start_tooth`, `end_tooth`                                             | Handles complex multi-tooth prosthetics (`bridge`, `partial`, `implant_bridge`).                       |

### B. Treatment & Scheduling (The Engine)

| Model                                | Key Fields                                                                                  | Purpose & Relationships                                                                                                              |
| :----------------------------------- | :------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| **`Treatment`**              | `id`, `patient_id`, `procedure_name`, `tooth_number`, `cost`, `status`          | **The Clinical Bridge.** Links work to billing/scheduling. Status: `planned`, `scheduled`, `in_progress`, `completed`, `cancelled`. |
| **`Appointment`**            | `id`, `patient_id`, `dentist_id`, `start_time`, `end_time`, `status`, `notes` | Time slots. Status:`scheduled`, `in_progress`, `completed`, `cancelled`, `deleted`.                                                         |
| **`appointment_treatments`** | `appointment_id`, `treatment_id`                                                        | **Many-to-Many Join Table.** Allows multiple treatments per visit, and multiple visits per treatment.                          |

### C. Patient Financials (The Ledger)

| Model                        | Key Fields                                         | Purpose & Relationships                                                                                   |
| :--------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **`Treatment`**      | `cost`, `status`, `insurance_amount`         | Acts as the invoice. The cost minus insurance amount is the total billed.                                 |
| **`PatientPayment`** | `treatment_id`, `amount`, `date`, `method` | Tracks payments made by the patient against a specific treatment.                                         |
| **`Patient`**        | `credit_balance`                                 | `Numeric(10,2)` balance tracking patient credit/overpayments that may be applied to future treatments. |

### D. Clinic Financials (Admin)

| Model                     | Key Fields                                                        | Purpose & Relationships                                  |
| :------------------------ | :---------------------------------------------------------------- | :------------------------------------------------------- |
| **`Expense`**     | `category`, `total_amount`, `vat_amount`, `is_declarable` | Tracks clinic overheads (rent, supplies, etc.).          |
| **`Payment`**     | `expense_id`, `amount`                                        | Payments made toward a specific clinic `Expense`.      |
| **`DailyIncome`** | `date`, `amount`, `num_patients`                            | Tracks daily total revenue and patient counts.           |
| **`CashBalance`** | `date`, `cash_on_hand`, `bank_account`                      | Tracks the physical cash and bank balance of the clinic. |
| **`OwnerDraw`**   | `month`, `amount`                                             | Tracks money taken out of the business by the owner.     |
| **`LabWork`**     | `record_id`, `lab_cost`, `actual_lab_paid`                  | Tracks external lab costs and billing.                   |

### 2. State Transition Workflows (The "Happy Paths")

### 🔄 Workflow 1: The Clinical Loop (Chart ↔ Treatment)

1. **Dentist views Teeth Chart:** Sees Tooth #14 is Red (`decayed`).
2. **Action:** Clicks `#14` in the Clinical Summary sidebar.
3. **State Change:** Redirects to `/patients/{id}/treatments?tooth=14`.
4. **Result:** "Add Treatment" form auto-fills "14" in the Tooth # box. Dentist adds "Composite Filling" ($150, Status: `planned`).

### 🔄 Workflow 2: The Scheduling Loop (Treatment ↔ Appointment)

1. **Secretary views Calendar:** Clicks "Add Appointment".
2. **Action:** Selects Patient. System fetches all treatments where `status NOT IN ('completed', 'cancelled')`.
3. **State Change:** Secretary checks "Composite Filling" from the Treatment Plan list (or types a new one).
4. **Result:** Appointment is created.
   * **State transition:** When a treatment is linked to an active appointment whose status is `scheduled`, a `planned` treatment becomes `scheduled`. A treatment already `in_progress` remains `in_progress`. This reflects that the treatment has a booked visit; it does not mean clinical work has started or finished. A treatment may be linked to multiple appointments for multi-visit care.

### 🔄 Workflow 3: The Completion Loop (Appointment → Treatment → Finance)

1. **Dentist finishes work:** Clicks "Complete" on the Calendar appointment.
2. **State Change (Appointment):** `status` becomes `completed`.
3. **State Change (Treatment):** The dentist records each linked treatment's actual outcome. Treatments clinically finished become `completed`; multi-visit treatments may remain `in_progress`. Appointment completion alone must not blindly complete every linked treatment.
4. **State Change (Financial):** The completed treatments now appear in the Patient's Financial Ledger with their outstanding balances.
5. **Action:** Front desk collects payment. A `PatientPayment` record is created. The patient's ledger balance is updated automatically.

---

## 3. Frontend State Management Rules

### 📅 Calendar Modal State (`eventHandlers.js` & `main.js`)

* **On Open (`initAppointmentForm`):**
  1. Calls standard `form.reset()`.
  2. Wipes `window.newTreatmentsList = []` (removes blue text tags).
  3. Wipes `#existing-treatments-list` innerHTML (removes old checkboxes).
  4. If `context === 'edit'`: Fetches patient treatments via `window.loadPatientTreatments()`, renders checkboxes, and checks the ones matching `data.treatment_ids`.
* **On Submit:**
  1. Gathers `existingIds` (checked boxes) and `newTreatmentsList` (text tags).
  2. Sends payload: `{ patient_id, start_time, end_time, treatment_ids: [...], new_treatments: [...] }`.

### 🦷 Teeth Chart State (`teeth_chart.html`)

* **`savedStates`:** Object mapping tooth numbers to states (e.g., `{"14": "decayed", "21": "filled"}`).
* **`savedProsthetics`:** Array of objects (e.g., `[{id: 1, type: "bridge", start: "13", end: "23"}]`).
* **Tooth Input Validation Rules:**
  * Empty = Valid (General treatment).
  * Single Tooth = Valid if matches `^[1-4][1-8]$` (e.g., 11, 48).
  * Bridge/Range = Valid if matches `^([1-4][1-8])-([1-4][1-8])$` AND both teeth are on the **same arch** (e.g., 13-23 is valid Upper; 13-33 is invalid).
  * Keywords = Valid if exactly `FULL UPPER`, `FULL LOWER`, or `FULL MOUTH`.

---

## 4. Critical Developer Notes ("Do Not Break" Rules)

1. **Scheduling transition:** When a treatment is linked to an active `scheduled` appointment, change `planned` → `scheduled`. Do not downgrade `in_progress`, `completed`, or `cancelled` treatments.
2. **Unlink/cancel reconciliation:** When a treatment is unlinked from or loses an appointment, keep it `scheduled` if it remains linked to any other active (`scheduled` or `in_progress`) appointment. If no active appointment remains, revert `scheduled` → `planned`. Never automatically revert `in_progress`, `completed`, or `cancelled`.
3. **Completion transition:** Completing an appointment does not blindly complete every linked treatment. The dentist records the actual clinical outcome per treatment: it may become `completed` or remain `in_progress` for multi-visit care. A treatment must not be marked `completed` while a future active visit for that treatment remains, unless an explicit workflow decision supersedes that guard.
4. **Read-only GET:** GET endpoints must not mutate treatment or appointment state. Any reconciliation belongs in the relevant POST/PUT transaction.
5. **Always reset modal state. `initAppointmentForm` must clear both `newTreatmentsList` and the `existing-treatments-list` DOM element to prevent state leakage between "New" and "Edit" modes.
6. **CSRF Protection:** All POST/DELETE forms in HTML must include `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}">`.
7. **Tooth Numbering:** Always use FDI two-digit notation (11-18, 21-28, 31-38, 41-48).

## Role-Based Access Matrix (SEC-002)

| Route class                        | admin | dentist | secretary | assistant |
| :--------------------------------- | :---: | :-----: | :-------: | :-------: |
| Patient CRUD                       |  ✅  |   ✅   |    ✅    |    ❌    |
| Patient delete                     |  ✅  |   ✅   |    ❌    |    ❌    |
| Treatment add/status/notes         |  ✅  |   ✅   |    ❌    |    ✅    |
| Treatment delete / mark-complete   |  ✅  |   ✅   |    ❌    |    ❌    |
| Patient payment                    |  ✅  |   ✅   |    ✅    |    ❌    |
| Teeth chart / prosthetics          |  ✅  |   ✅   |    ❌    |    ✅    |
| Appointment create / edit / cancel |  ✅  |   ✅   |    ✅    |    ❌    |
| Appointment complete               |  ✅  |   ✅   |    ❌    |    ❌    |
| Appointment hard delete            |  ✅  |   ❌   |    ❌    |    ❌    |
| Finance (clinic)                   |  ✅  |   ❌   |    ❌    |    ❌    |
| Settings (user mgmt)               |  ✅  |   ❌   |    ❌    |    ❌    |

---

## 5. System Status Checklist

- [X] **Patient Management:** CRUD, Profile, Double-click list navigation, Edit/Delete on profile.
- [X] **Teeth Chart:** Visual states, Prosthetics, Summary click-to-treat navigation.
- [X] **Treatment Plan:** Add/Edit/Delete, Status management, Tooth input validation.
- [X] **Calendar:** Multi-treatment booking, Hybrid (existing + new) procedures, Modal state reset, Multi-visit support.
- [X] **Patient Financials UI:** Building the Payment Ledger and credit tracking system.
- [X] **Clinic Financials:** Admin dashboard for expenses, lab work, and cash balances.


## 6. Scheduling State Invariants (Reviewed 2026-11-17)

The intended business rule is that an appointment booking changes the linked treatment's workflow state to `scheduled` when the appointment is active and scheduled. This is a persisted workflow state, not merely a visual label.

| Event | Appointment state | Treatment state effect |
|---|---|---|
| Create appointment and link a `planned` treatment | `scheduled` | `planned` → `scheduled` |
| Link a treatment already `in_progress` | `scheduled` | Remains `in_progress` |
| Edit/reschedule an appointment without unlinking treatment | `scheduled` | Remains `scheduled` (or `in_progress`) |
| Unlink a treatment | unchanged | Reconcile against all other active appointments; if none remain, `scheduled` → `planned` |
| Cancel an appointment | `cancelled` | Reconcile against all other active appointments; if none remain, `scheduled` → `planned` |
| Complete an appointment | `completed` | Dentist records actual per-treatment outcome: `completed` or `in_progress` |
| Read appointment details (GET) | unchanged | No state mutation is allowed |

**Active appointment definition:** `scheduled` or `in_progress`. Cancelled, deleted and completed appointments do not keep a treatment in `scheduled` state. The implementation must inspect all links before reverting a treatment, because the association is many-to-many and a treatment may be booked for multiple visits.

**Important distinction:** `scheduled` means a visit is booked. `in_progress` means clinical work has begun but is not finished. `completed` means the treatment itself is clinically complete. Appointment completion and treatment completion are related but are not interchangeable.

**Current implementation gaps to resolve:**
- Appointment create/update already set linked planned treatments to `scheduled` in the inspected source.
- Appointment GET currently performs a database commit to self-heal planned treatments; move this mutation into write transactions and keep GET read-only.
- Unlink and cancellation currently revert linked scheduled treatments to planned without checking whether another active appointment still links the treatment.
- Appointment update currently does not fully reconcile treatments removed from the submitted selection; confirm frontend unlink payload and backend final link set semantics.
- Treatment status transition validation is not centralized; direct status endpoints can set arbitrary enum values without checking appointment linkage or legal transitions.
