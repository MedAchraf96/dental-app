# Auto-Generated Project Structure

> This file is generated automatically. Do not edit by hand.

## Folder Structure

```text
├── app/
│   ├── config.py
│   ├── database.py
│   ├── enums.py
│   ├── extensions.py
│   ├── models.py
│   ├── __init__.py
│   ├── auth/
│   │   ├── routes.py
│   │   ├── __init__.py
│   ├── routes/
│   │   ├── appointment.py
│   │   ├── calendar.py
│   │   ├── dashboard.py
│   │   ├── finance.py
│   │   ├── patient.py
│   │   ├── settings.py
│   │   ├── __init__.py
│   ├── static/
│   │   ├── css/
│   │   │   ├── style.css
│   │   │   ├── base/
│   │   │   │   ├── _reset.css
│   │   │   │   ├── _variables.css
│   │   │   ├── components/
│   │   │   │   ├── _alerts.css
│   │   │   │   ├── _buttons.css
│   │   │   │   ├── _forms.css
│   │   │   │   ├── _tables.css
│   │   │   ├── layout/
│   │   │   │   ├── _navigation.css
│   │   │   │   ├── _page_header.css
│   │   │   │   ├── _patient_nav.css
│   │   │   │   ├── _responsive.css
│   │   │   │   ├── _structure.css
│   │   │   ├── pages/
│   │   │   │   ├── _appointment_list.css
│   │   │   │   ├── _calendar.css
│   │   │   │   ├── _dashboard.css
│   │   │   │   ├── _patient_clinical_log.css
│   │   │   │   ├── _patient_financial.css
│   │   │   │   ├── _patient_list.css
│   │   │   │   ├── _patient_profile.css
│   │   │   │   ├── _patient_teeth_chart.css
│   │   │   │   ├── _patient_treatments.css
│   │   │   │   ├── _settings.css
│   │   ├── js/
│   │   │   ├── appointment/
│   │   │   │   ├── list.js
│   │   │   ├── calendar/
│   │   │   │   ├── API.js
│   │   │   │   ├── CalRender.js
│   │   │   │   ├── eventHandlers.js
│   │   │   │   ├── helper.js
│   │   │   │   ├── interaction.js
│   │   │   │   ├── main.js
│   │   │   │   ├── state.js
│   │   │   │   ├── __init__.py
│   │   │   ├── finance/
│   │   │   │   ├── dashboard.js
│   │   │   ├── patient/
│   │   │   │   ├── clinical_log.js
│   │   │   │   ├── financial.js
│   │   │   │   ├── teeth_chart.js
│   │   │   │   ├── treatments.js
│   │   │   ├── settings/
│   │   │   │   ├── catalog.js
│   │   │   │   ├── settings.js
│   ├── templates/
│   │   ├── base.html
│   │   ├── appointment/
│   │   │   ├── list.html
│   │   ├── auth/
│   │   │   ├── login.html
│   │   ├── calendar/
│   │   │   ├── dashboard.html
│   │   ├── dashboard/
│   │   │   ├── home.html
│   │   ├── finance/
│   │   │   ├── dashboard.html
│   │   ├── patient/
│   │   │   ├── clinical_log.html
│   │   │   ├── edit.html
│   │   │   ├── financial.html
│   │   │   ├── list.html
│   │   │   ├── patient_base.html
│   │   │   ├── profile.html
│   │   │   ├── teeth_chart.html
│   │   │   ├── treatments.html
│   │   ├── settings/
│   │   │   ├── catalog.html
│   │   │   ├── settings_base.html
│   │   │   ├── users.html
│   ├── utils/
│   │   ├── tooth_helpers.py
│   │   ├── __init__.py
```

## Database Models

### `User`

- `id` (Integer)
- `username` (String)
- `password` (String)
- `role` (String)
- `name` (String)

### `Patient`

- `id` (Integer)
- `first_name` (String)
- `last_name` (String)
- `date_of_birth` (Date)
- `phone` (String)
- `email` (String)
- `gender` (String)
- `insurance_provider` (String)
- `allergies` (Text)
- `medical_history` (Text)
- `notes` (Text)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `created_by` (Integer)
- `credit_balance` (Numeric)

### `Appointment`

- `id` (Integer)
- `patient_id` (Integer)
- `dentist_id` (Integer)
- `start_time` (DateTime)
- `end_time` (DateTime)
- `notes` (Text)
- `status` (String)
- `completed_at` (DateTime)
- `deleted_at` (DateTime)

### `Treatment`

- `id` (Integer)
- `patient_id` (Integer)
- `tooth_number` (String)
- `procedure_name` (String)
- `procedure_code` (String)
- `cotation` (String)
- `cost` (Numeric)
- `status` (String)
- `created_at` (DateTime)
- `clinical_notes` (Text)
- `insurance_amount` (Numeric)
- `completed_date` (Date)
- `admin_completed_at` (DateTime)

### `TreatmentCatalog`

- `id` (Integer)
- `name` (String)
- `category` (String)
- `code` (String)
- `cotation` (String)
- `default_price` (Numeric)
- `target_type` (String)
- `is_active` (Boolean)

### `PatientPayment`

- `id` (Integer)
- `treatment_id` (Integer)
- `amount` (Numeric)
- `date` (Date)
- `method` (String)
- `note` (String)

### `ToothRecord`

- `id` (Integer)
- `patient_id` (Integer)
- `tooth_number` (String)
- `state` (String)
- `updated_at` (DateTime)

### `Prosthetic`

- `id` (Integer)
- `patient_id` (Integer)
- `type` (String)
- `start_tooth` (String)
- `end_tooth` (String)

### `ClinicalNote`

- `id` (Integer)
- `content` (Text)
- `treatment_id` (Integer)
- `appointment_id` (Integer)
- `author_id` (Integer)
- `created_at` (DateTime)

### `DailyIncome`

- `id` (Integer)
- `date` (Date)
- `month` (Integer)
- `day_type` (String)
- `num_patients` (Integer)
- `amount` (Numeric)

### `Expense`

- `id` (Integer)
- `date` (Date)
- `due_date` (Date)
- `category` (String)
- `supplier` (String)
- `bill_number` (String)
- `description` (String)
- `total_amount` (Numeric)
- `is_declarable` (Boolean)
- `vat_amount` (Numeric)

### `Payment`

- `id` (Integer)
- `expense_id` (Integer)
- `date` (Date)
- `amount` (Numeric)
- `note` (String)

### `LabWork`

- `id` (Integer)
- `record_id` (Integer)
- `month` (Integer)
- `patient_name` (String)
- `procedure` (String)
- `quantity` (Integer)
- `lab_cost` (Numeric)
- `total_cost` (Numeric)
- `billed_amount` (Numeric)
- `billed_date` (Date)
- `collected_amount` (Numeric)
- `discount` (Numeric)
- `remaining` (Numeric)
- `actual_lab_paid` (Numeric)
- `bill_reference` (String)

### `CashBalance`

- `id` (Integer)
- `date` (Date)
- `cash_on_hand` (Numeric)
- `bank_account` (Numeric)
- `note` (String)

### `OwnerDraw`

- `id` (Integer)
- `month` (String)
- `amount` (Numeric)

## API & View Routes

### File: `appointment.py`

### File: `calendar.py`

- `/health` [GET] -> `health_check()`

### File: `dashboard.py`

### File: `finance.py`

### File: `patient.py`

### File: `settings.py`
