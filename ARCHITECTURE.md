# Dental App Architecture Map

## 1. Core Features (What the app does)

* **Authentication & Roles:** Login, session management, and user roles (Admin, Dentist, Secretary).
* **Patient Management:** CRUD operations for patient demographics, medical history, and credit balances.
* **Clinical Records:**
  * *Clinical Log:* A chronological timeline of appointments, treatments, and clinical notes.
  * *Dental Chart:* Interactive SVG tooth chart (state management, bridges, partials).
* **Treatment Planning:** Adding treatments from a catalog, tracking status (Planned -> In Progress -> Completed).
* **Appointments & Calendar:** Scheduling, bulk cancellations, and dragging/dropping on a calendar interface.
* **Patient Financials:** Tracking billed amounts, recording payments, handling patient credit, and viewing the ledger.
* **Clinic Financials (Admin):** High-level tracking of daily income, expenses, VAT, lab work, cash balances, and owner draws.

## 2. Components (How the code is organized)

* **Models (`app/models.py`):** 15 database tables covering patients, treatments, scheduling, and clinic finance.
* **Routes (`app/routes/`):**
  * `auth.py`: Login/logout.
  * `patient.py`: The largest route file; handles patient profiles, treatments, financials, teeth charts, and clinical logs.
  * `calendar.py`: Complex API for scheduling, dragging appointments, and completing visits.
  * `finance.py`: Clinic-level financial dashboards and API endpoints.
  * `dashboard.py`: The main home page.
* **Frontend Assets (`app/static/`):**
  * Highly modular CSS (`base/`, `components/`, `layout/`, `pages/`).
  * Modular JS (`calendar/`, `patient/`, `finance/`).
* **Database Migrations (`migrations/`):** 11 migration files tracking database changes over time.

## 3. Liaisons (Data Flow & Relationships)

* **Patient-Centric Flow:** `Patient` -> has many `Appointments` -> which are linked to many `Treatments` (via `appointment_treatments`) -> which have many `PatientPayments`.
* **Clinical Flow:** `Treatments` link to `ToothRecords` (via `tooth_helpers.py`) and `Prosthetics`.
* **Finance Flow:** `Treatment.cost` + `Patient.credit_balance` - `PatientPayment.amount` = Outstanding Balance.
* **JS to Python Flow:** The frontend uses `data-*` attributes (extracted via Jinja) to send secure JSON payloads back to the Flask routes (e.g., `teeth_chart.js` hitting `/api/teeth-chart`).
