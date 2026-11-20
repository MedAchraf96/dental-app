# AGENTS.md — Dental App Project Rules

**Last reviewed:** 2026-11-17
**Audit basis:** Static inspection of the supplied `dental_app_audit.zip`. These rules describe intended engineering behavior; audit findings in `AUDIT_REPORT.md` remain open until fixed and regression-tested.

## 1. Stack and project entry points

- Python 3; Flask application factory in `app/__init__.py` (`create_app`).
- Jinja templates under `app/templates/`; vanilla JavaScript under `app/static/js/`; CSS under `app/static/css/`.
- Persistence: Flask-SQLAlchemy with SQLite by default; `DATABASE_URL` can override the URI.
- Schema migrations: Flask-Migrate/Alembic under `migrations/`.
- WSGI entry point: `wsgi.py`.
- Main models: `app/models.py`; enums: `app/enums.py`; extensions: `app/extensions.py`.
- Application map: `APP_MAP.md`. Structural inventory: `STRUCTURE.md`. Clinical and workflow invariants: `STATE_LEDGER.md`. Known findings: `AUDIT_REPORT.md`. Priorities: `ROADMAP.md`.

## 2. Safety and change-control boundaries

- Do not refactor unless explicitly authorized. Preserve unrelated behavior.
- Never modify project files or the database without explicit authorization for that specific task.
- Explain the intended change and affected files before proposing code changes.
- Inspect the relevant route, model, template, JavaScript and tests before changing behavior.
- Prefer the smallest appropriate patch. Do not rewrite whole files unnecessarily.
- Do not claim a vulnerability is fixed until a regression test or reproducible verification passes.
- Treat patient, clinical, appointment and financial information as sensitive. Never include real patient data, credentials, tokens, `.env` contents, database files or raw logs in audit archives or Git commits.

## 3. Startup and database safeguards

- **Do not run or import the app against the user's configured database during static work.** App startup configures the instance folder and logging; the CLI `init-db` command calls `db.create_all()` and may create an administrator from configured credentials.
- Use a verified disposable SQLite database for tests and migration experiments. Never point tests at the clinic database.
- Before any database operation, identify the exact database path and verify it is a disposable copy or obtain explicit authorization.
- Back up before approved schema/data changes; verify backup and rollback behavior.
- The configured default database path is under `app/instance/`, unless `DATABASE_URL` overrides it.

## 4. Security requirements

### Authentication and authorization

- Require authentication for protected application routes.
- Apply `@role_required(*roles)` after `@login_required` on every mutating route, following the role matrix below. The decorator order matters.
- Do not assume RBAC is fully correct: route-level authorization and object-level ownership must both be reviewed. See open findings in `AUDIT_REPORT.md`.
- Enforce object ownership in every lookup that uses IDs supplied by a URL, form, JSON payload or browser. A patient-scoped endpoint must verify that every treatment, prosthetic, appointment, payment or clinical note belongs to the patient in that route.
- Do not trust client-supplied patient IDs, treatment IDs, appointment IDs, dentist IDs or payment allocations without server-side relationship validation.
- Validate login `next` redirects as safe local URLs.
- Logout must use POST with CSRF protection, not a state-changing GET.

### Current intended role matrix

| Capability                       | admin | dentist | secretary |                                  assistant |
| -------------------------------- | ----: | ------: | --------: | -----------------------------------------: |
| Patient CRUD                     |   Yes |     Yes |       Yes |                                         No |
| Patient hard delete              |   Yes |     Yes |        No |                                         No |
| Treatment add/status/notes       |   Yes |     Yes |        No |      Yes (within authorized patient scope) |
| Treatment delete/mark-complete   |   Yes |     Yes |        No |                                         No |
| Patient payment                  |   Yes |     Yes |       Yes |                                         No |
| Teeth chart/prosthetics          |   Yes |     Yes |        No | Yes (no delete unless explicitly approved) |
| Appointment create/edit/cancel   |   Yes |     Yes |       Yes |                                         No |
| Appointment complete             |   Yes |     Yes |        No |                                         No |
| Appointment hard delete          |   Yes |      No |        No |                                         No |
| Clinic finance                   |   Yes |      No |        No |                                         No |
| Settings/user management/catalog |   Yes |      No |        No |                                         No |

This is the intended policy, not proof that every current route enforces it. Reconcile route decorators and object-level checks against this table during security work.

### Request and browser security

- Global CSRF protection is enabled. All unsafe browser requests (POST/PUT/PATCH/DELETE) must carry valid CSRF tokens.
- Never interpolate user-controlled values into `innerHTML`, `insertAdjacentHTML`, template strings used as HTML, or other HTML sinks. Build DOM nodes and assign untrusted text with `textContent`.
- Do not add inline event handlers. Use `addEventListener()` in external JS.
- Do not add inline `<style>` blocks. Keep styling in external CSS. A `style` attribute is only acceptable for genuinely dynamic Jinja-driven values; prefer classes.
- Do not expose stack traces, SQL, secrets or patient payloads in user-facing errors or logs.
- Configure CORS narrowly; disable it if not needed.

## 5. Data integrity and domain rules

### Patient ownership

- Every treatment belongs to exactly one patient (`Treatment.patient_id`).
- Every patient-scoped operation must validate ownership server-side, including nested links such as appointments ↔ treatments and clinical notes ↔ treatment/appointment.
- Do not assume that a foreign key existing is sufficient: verify cross-entity relationships before mutation.

### Treatment and appointment statuses

Treatment statuses are `planned`, `scheduled`, `in_progress`, `completed`, `cancelled`. Appointment statuses are `scheduled`, `in_progress`, `completed`, `cancelled`, `deleted`.

**Approved scheduling rule:** when a treatment in `planned` state is linked to an active appointment whose status is `scheduled`, change the treatment to `scheduled`. This is intentional. Do not preserve the old contradictory rule that appointment linking must never change treatment status.

- Linking a treatment already `in_progress` must not downgrade it to `scheduled`.
- `scheduled` means a visit is booked; it does not mean clinical work has begun or that treatment is complete.
- `in_progress` means clinical work has started but is not finished.
- `completed` means the treatment itself is clinically complete. Completing an appointment must not blindly complete all linked treatments; record each treatment's actual clinical outcome. Multi-visit treatments may remain `in_progress`.
- A treatment may be linked to multiple appointments for multi-visit care.
- When a treatment is unlinked from or loses an appointment, inspect all its other appointment links. Keep it `scheduled` if any other active (`scheduled` or `in_progress`) appointment still links it. Only revert `scheduled` → `planned` when no active appointment remains.
- Never automatically downgrade `in_progress`, `completed` or `cancelled` to `planned`.
- Appointment editing must reconcile the complete final association set atomically, including removed treatment links.
- Appointment cancellation paths must use the same reconciliation rule.
- GET endpoints are read-only. Never repair or persist workflow state during GET; reconcile only in an authorized write transaction.
- Centralize legal state transitions where practical and reject arbitrary client-selected state values.
- See `STATE_LEDGER.md` for the complete lifecycle/invariant table.

### Clinical and financial data

- Use FDI two-digit tooth numbering (11–18, 21–28, 31–38, 41–48).
- Validate tooth numbers, ranges, arch constraints and prosthetic endpoints on the server, not only in JavaScript.
- Use `Decimal` for all monetary parsing, arithmetic and persistence. Do not use `float` for money.
- Validate finite amounts, precision, sign, bounds, patient ownership, treatment eligibility, remaining balance and transaction rollback.
- Define one authoritative patient ledger/credit invariant before changing credit calculations. Avoid double counting stored credit and derived balances.
- Do not hard-delete clinical history without an approved retention/archive policy.

## 6. Frontend architecture and data passing

- Keep application logic in external JS under `app/static/js/` and styles in `app/static/css/`.
- Do not pass Jinja values through inline JS variables. Put server values in appropriate HTML `data-*` attributes and read them via `element.dataset`.
- Avoid global mutable state where possible; when existing calendar state globals are involved, preserve modal reset behavior and inspect all consumers before changing them.
- Treat all browser payloads as untrusted. Validate on the server even when the UI validates first.
- Preserve keyboard access, focus behavior, responsive layouts and useful empty/error states.

## 7. Testing and verification

- The supplied repository snapshot has no automated test suite. Add pytest coverage before or alongside remediation; track this as `QUAL-001` in `ROADMAP.md`.
- Tests must use a verified disposable database and must never load `.env` settings that point at the clinic DB.
- Minimum regression coverage for sensitive changes: authorization/role matrix, CSRF, cross-patient IDOR, XSS-safe rendering, appointment/treatment state transitions, Decimal/payment invariants, transaction rollback and migration behavior.
- Run Python syntax checks, JavaScript syntax checks and `git diff --check` as baseline checks, but do not treat these as substitutes for functional tests.
- Record exact commands and results. Distinguish static inspection, syntax checks, automated tests, manual runtime checks and penetration testing.

## 8. Git and documentation hygiene

- Keep `AGENTS.md`, `APP_MAP.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `STATE_LEDGER.md`, `AUDIT_REPORT.md` and `ROADMAP.md` versioned and synchronized.
- Inspect `.gitignore` before changing it; do not accidentally commit secrets, `.env`, instance databases, logs, virtual environments, caches or user uploads.
- Review `git status` and staged diffs before every commit. Stage explicit paths rather than `git add .` for sensitive projects.
- Do not commit `patients.db`, database backups, `.env`, logs, `.venv`, `__pycache__` or patient exports.

## 9. Current audit status

- The source archive was statically inspected on 2026-11-17.
- Findings and remediation priorities are tracked in `AUDIT_REPORT.md` and `ROADMAP.md`.
- No application code or live database was modified as part of the documentation audit.
- High-priority findings remain open until fixed and verified. Do not describe the application as production-ready until all High findings and required recovery/security checks are complete.
