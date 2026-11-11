# Roadmap

## Phase 1: Security & Stability (CRITICAL)

* **SEC-001:** Remove hardcoded default admin credentials and fallback secrets from `config.py`. Move to `.env` variables.
* **SEC-003:** Fix XSS vulnerability in `calendar.js` where user input is injected via `innerHTML`. Use `textContent` or a sanitization library.
* **SEC-002:** Enforce role-based access control (RBAC). Ensure `@role_required('admin')` works correctly on sensitive routes (especially in `finance.py`).
* **Testing:** Add the first `pytest` tests for the most critical logic (e.g., Patient Payment math, Treatment ownership).

## Phase 2: The Finance Module Completion

* **DATA-003:** Refactor financial calculations to use `Decimal` instead of `Float` to prevent rounding errors in currency.
* **Lab Work Integration:** The `LabWork` model exists but seems isolated. Build a UI to manage lab costs and link them to patient treatments.
* **Admin Finance UI:** Refactor `templates/finance/dashboard.html` to fully utilize the `Expense`, `DailyIncome`, and `CashBalance` models.

## Phase 3: UI/UX Polish

* **Template Refactoring:** Refactor `calendar/dashboard.html` and `dashboard/home.html` to extract inline CSS/JS (using the manual method).
* **Mobile Responsiveness:** Ensure the calendar and dental chart are usable on tablets.
* **Notifications:** Add flash message styling consistency across the app.

## Phase 4: Deployment

* **Production Database:** Migrate from SQLite to PostgreSQL for production.
* **Environment Variables:** Ensure all secrets are securely loaded via `.env`.
* **WSGI Server:** Deploy using Gunicorn (or Waitress on Windows).
