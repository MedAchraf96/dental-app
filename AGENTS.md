# Project Rules for dental_app

## Stack and Commands

- Language: Python 3, Flask 2.3.2, Jinja, vanilla JS/CSS.
- Database: SQLite via Flask-SQLAlchemy (uses `DATABASE_URL` if set).
- Test Command: Currently, there are no automated tests in the repository (QUAL-001). If you propose adding tests, use `pytest` and run them against a verified disposable database, never the configured production SQLite file.
- Run/Startup: `wsgi.py` constructs the app. Do not run or import the app against the user's configured DB during static work, as startup calls `db.create_all()` and may seed a fixed-password admin (REL-001).

## Core Boundaries & Security (Never Violate)

- **Do not refactor** unless explicitly authorized. Preserve unrelated existing behavior.
- **Never modify files** without explicit user authorization for that specific task.
- **Security:** Do not introduce or expose secrets. Be aware of known default admin fallbacks (SEC-001) and avoid expanding sensitive routes without role enforcement (SEC-002).
- **Data Integrity:** Enforce patient-treatment ownership in payment and calendar ID handling (DATA-001/DATA-002). Do not use float amounts for financial calculations (DATA-003).
- **XSS:** Do not interpolate user-controlled JSON values directly into `innerHTML` (SEC-003).
- **CSRF:** Global CSRF is enabled; ensure any new browser-facing endpoints handling unsafe requests have tokens.

## Workflow Expectations

- **Explain first:** Before suggesting code, explain the intended change and identify affected files.
- **Inspect first:** Inspect relevant existing code before proposing modifications. Never assume database structure or application behavior without evidence.
- **Smallest change:** Prefer the smallest appropriate change. Do not rewrite entire files unnecessarily.
- **Beginner-friendly:** Explain code changes in beginner-friendly language.
- **Patches:** When asked for a patch, return a minimal unified diff for the smallest possible set of files.

## CSS Guidelines

- Prefer external stylesheets located in `app/static/css/` for all static styling.
- Inline `<style>` tags are **not allowed** in HTML templates.
- The `style` attribute is **only permitted** for dynamic styling driven by Jinja variables (e.g., changing a color based on a status).

## JavaScript Guidelines

- Prefer external JavaScript files located in `app/static/js/` for all application logic.
- Inline `<script>` blocks are **only permitted** for passing server-side data from Jinja to JavaScript (e.g., using `window.APP_DATA = {{ data | tojson }};`).
- Inline event handlers (e.g., `onclick="..."`) are **not allowed**. Use `addEventListener()` in your external JS files instead.

## Frontend Data Passing (Flask to JavaScript)

- **Never use inline `<script>` tags to pass Jinja variables to JavaScript.** (e.g., do not use `window.APP_DATA = { ... }`).
- **Always use HTML `data-*` attributes** on a hidden element to pass server-side data.
- **In JavaScript, read these values using the `dataset` property.**

### Correct Pattern Example:

**In the HTML template:**

<div id="page-data" 
     data-patient-id="{{ patient.id }}" 
     data-csrf-token="{{ csrf_token() }}" 
     style="display: none;"></div>

**In the external JavaScript file:**
const dataDiv = document.getElementById('page-data');
const patientId = dataDiv ? dataDiv.dataset.patientId : '';
const csrfToken = dataDiv ? dataDiv.dataset.csrfToken : '';
