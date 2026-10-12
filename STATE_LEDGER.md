

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
| **`Treatment`**              | `id`, `patient_id`, `procedure_name`, `tooth_number`, `cost`, `status`          | **The Clinical Bridge.** Links work to billing/scheduling. Status: `planned`, `in_progress`, `completed`, `cancelled`. |
| **`Appointment`**            | `id`, `patient_id`, `dentist_id`, `start_time`, `end_time`, `status`, `notes` | Time slots. Status:`scheduled`, `completed`, `cancelled`, `deleted`.                                                         |
| **`appointment_treatments`** | `appointment_id`, `treatment_id`                                                        | **Many-to-Many Join Table.** Allows multiple treatments per visit, and multiple visits per treatment.                          |

### C. Financials (The Ledger)

| Model                 | Key Fields                                                                              | Purpose & Relationships                                                                       |
| :-------------------- | :-------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **`Invoice`** | `id`, `patient_id`, `treatment_id`, `total_amount`, `paid_amount`, `status` | Generated when a Treatment is marked`completed`. Status: `unpaid`, `partial`, `paid`. |
| **`Payment`** | `id`, `invoice_id`, `amount`, `payment_method`, `date_paid`                   | Tracks partial or full payments against a specific invoice.                                   |

---

## 2. State Transition Workflows (The "Happy Paths")

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
   * ⚠️ **CRITICAL RULE:** The Treatment status remains `planned` or `in_progress`. It does **NOT** change to `scheduled`. This allows the same treatment to be booked across multiple visits (e.g., Root Canal Visit 1, Visit 2).

### 🔄 Workflow 3: The Completion Loop (Appointment → Treatment → Finance)

1. **Dentist finishes work:** Clicks "Complete" on the Calendar appointment.
2. **State Change (Appointment):** `status` becomes `completed`.
3. **State Change (Treatment):** All linked treatments automatically update to `completed`.
4. **State Change (Financial):** System generates an `Invoice` (Status: `unpaid`).
5. **Action:** Front desk collects payment. `Payment` record created. Invoice updates to `paid` or `partial`.

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

1. **Never auto-change Treatment status to 'scheduled'.** The calendar only links the appointment to the treatment. The treatment status only changes to `completed` when the appointment is explicitly marked complete.
2. **Always reset modal state.** `initAppointmentForm` must clear both `newTreatmentsList` and the `existing-treatments-list` DOM element to prevent state leakage between "New" and "Edit" modes.
3. **CSRF Protection:** All POST/DELETE forms in HTML must include `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}">`.
4. **Tooth Numbering:** Always use FDI two-digit notation (11-18, 21-28, 31-38, 41-48).

---

## 5. System Status Checklist

- [X] **Patient Management:** CRUD, Profile, Double-click list navigation, Edit/Delete on profile.
- [X] **Teeth Chart:** Visual states, Prosthetics, Summary click-to-treat navigation.
- [X] **Treatment Plan:** Add/Edit/Delete, Status management, Tooth input validation.
- [X] **Calendar:** Multi-treatment booking, Hybrid (existing + new) procedures, Modal state reset, Multi-visit support.
- [ ] **Financials UI:** Building the Invoice/Payment interface to match the schema.
- [ ] **Automated Billing:** Triggering Invoice creation when an Appointment is marked "Complete".
