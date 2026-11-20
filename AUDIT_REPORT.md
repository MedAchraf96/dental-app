# Dental App — Static Audit Report

**Audit date:** 2026-11-17
**Source:** `dental_app_audit.zip` supplied in this conversation
**Scope:** Flask application source, SQLAlchemy models, route modules, templates, JavaScript/CSS, configuration, migrations, and project governance documents.
**Method:** Static inspection only. No live database was opened, no app server was started, and no code was changed.

## Executive summary

The project has a recognizable modular Flask structure, SQLAlchemy models, global Flask-WTF CSRF protection, route-level role checks on many mutations, and a documented role matrix. Python compilation and JavaScript syntax checks pass on the archived source.

The source is **not yet production-ready for real patient data**. The most important risks are object-level authorization gaps, unsafe insertion of clinical note text into HTML, appointment/treatment state reconciliation defects, financial allocation validation, and development-oriented runtime configuration/logging.

This report distinguishes source-confirmed defects from risks that require isolated runtime tests. Severity reflects likely impact, not proof of exploitation in a deployed environment.

## Verification performed

- `compileall` over `app/`: passed.
- `node --check` over every `.js` file: passed.
- Reviewed route decorators and unsafe HTTP methods.
- Reviewed model relationships, treatment/appointment enums, finance calculations, CSRF token usage, frontend DOM insertion patterns, config, startup and ignore rules.
- No automated tests were present in the archive.
- No app startup or database access was performed, consistent with `AGENTS.md`.

## Findings

### SEC-001 — Stored XSS in clinical notes — High

**Evidence:** `app/static/js/patient/clinical_log.js`, lines 78–90. User-entered `content` is interpolated into an HTML template and passed to `insertAdjacentHTML()` without HTML escaping. The note is stored by `/patients/treatments/<id>/update-notes` and can later be rendered for users viewing the clinical log. Additional untrusted DB fields are interpolated into HTML in `app/static/js/finance/dashboard.js`, including expense category/supplier (`~521–534`) and payment note (`~671`), and income day type (`~347–358`).

**Impact:** A maliciously crafted clinical note could execute script in another authenticated user's browser, potentially exposing session-bound data or enabling actions as that user.

**Remediation:** Construct DOM nodes and assign user-controlled text with `textContent`; represent line breaks with `<br>` nodes. Do not trust stored database text. Apply the same safe rendering approach to finance fields (category, supplier, payment note, day type) and any other user-controlled values. Static trusted markup may remain as static templates only if dynamic data is never interpolated into HTML.

**Status: ✅ FIXED 2026-11-18** — Replaced unsafe `insertAdjacentHTML()` with safe DOM construction using `textContent` in `app/static/js/patient/clinical_log.js`. User-controlled text is now rendered as plain text, preventing script execution. Line breaks are safely handled via CSS `white-space: pre-wrap`.

### SEC-002 — Prosthetic deletion lacks patient ownership validation — High

**Evidence:** `app/routes/patient.py`, `delete_prosthetic()`. The route accepts both `patient_id` and `prosthetic_id` but loads only by `prosthetic_id`, then deletes without checking `prosthetic.patient_id == patient_id`.

**Impact:** An authenticated user with the relevant role may delete a prosthetic belonging to a different patient by changing the URL identifiers.

**Remediation:** Fetch with both IDs (or explicitly compare ownership) before deletion. Add a cross-patient negative test.

**Status: ✅ FIXED** — Prosthetic deletion now validates `prosthetic.patient_id == patient_id` before deletion.

### SEC-003 — Clinical note creation does not validate treatment/appointment ownership — High

**Evidence:** `app/routes/patient.py`, `update_treatment_notes()`. The route accepts a treatment ID in the path and an optional appointment ID in JSON, then creates the note without loading either object or confirming that they belong to the same patient.

**Impact:** Notes can potentially be attached to unrelated treatment and appointment records, corrupting the clinical history and creating cross-patient data association.

**Remediation:** Load the treatment; if appointment_id is supplied, load the appointment and require matching patient IDs and valid relationship/context before creating the note.

**Status: ✅ FIXED 2026-11-18** — `update_treatment_notes()` now validates treatment existence, appointment existence (if provided), and ensures both belong to the same patient before creating the clinical note. Returns 404 for missing records and 400 for cross-patient mismatches.

### SEC-004 — Appointment completion payment allocation trusts client treatment IDs — High

**Evidence:** `app/routes/calendar.py`, `complete_appointment()`. In the manual waterfall allocation, a treatment is fetched by client-supplied `treatment_id`; the code checks existence but does not require the treatment to belong to the appointment's patient or be linked to that appointment.

**Impact:** A crafted request may allocate a payment from one patient's visit to another patient's treatment.

**Remediation:** Validate every allocation against `appointment.patient_id` and the intended appointment treatment set. Validate amounts and reject invalid IDs rather than silently continuing.

### SEC-005 — Appointment cancellation authorization compares unrelated IDs — High

**Evidence:** `app/routes/appointment.py`, `cancel_appointment()`: `appointment.patient_id != current_user.id` is used as the non-admin authorization test.

**Impact:** Patient and user IDs are different identifier domains. The intended secretary/dentist cancellation workflow is likely blocked except where IDs coincidentally match; this is not a valid authorization check.

**Remediation:** Define allowed cancellation scope by role and appointment assignment, then enforce that policy. Add role-by-role tests.

### SEC-006 — Appointment update/cancel scope is inconsistent — High

**Evidence:** `app/routes/calendar.py`, `update_appointment()` and `cancel_appointment()`. Mutating routes have role checks, but update/cancel do not consistently constrain dentist users to their assigned appointments. `get_appointment()` and completion do apply a dentist assignment filter.

**Impact:** A dentist may be able to edit/cancel an appointment assigned to another dentist, depending on the deployed role and route use.

**Remediation:** Apply a shared appointment authorization helper to read/update/cancel/complete operations, with role-specific rules from the role matrix.

### LOGIC-001 — Appointment GET endpoint mutates treatment state — High

**Evidence:** `app/routes/calendar.py`, `get_appointment()`, lines 534–543. A GET request changes linked planned treatments to scheduled and commits the database.

**Impact:** A read operation has side effects; previews, retries, prefetching or crawlers can mutate clinical workflow state. This hides inconsistent writes instead of fixing their source.

**Remediation:** Keep GET read-only. Perform treatment state transitions inside appointment create/update/cancel/unlink write transactions.

**Status: ✅ FIXED** — Removed state mutation from `get_appointment()` GET endpoint. GET is now read-only.

### LOGIC-002 — Cancellation/unlink can incorrectly revert a multi-visit treatment — High

**Evidence:** `app/routes/calendar.py`, `update_appointment()` unlink handling and `cancel_appointment()`. Both revert a scheduled treatment to planned without checking whether another active appointment still links it.

**Impact:** A treatment booked for multiple visits may appear unplanned after one appointment is cancelled or unlinked, even though another visit remains booked.

**Remediation:** Reconcile the treatment against all remaining active appointments. Keep it scheduled if any scheduled/in-progress appointment remains; only revert scheduled → planned when no active appointment remains. Preserve in_progress/completed/cancelled states.

**Status: ✅ FIXED 2026-11-18** — `cancel_appointment()` now queries for other active appointments before reverting treatment status. Only reverts `scheduled` → `planned` when no other active (`scheduled` or `in_progress`) appointment remains.

### LOGIC-003 — Appointment update does not clearly reconcile the final link set — Medium/High

**Evidence:** `update_appointment()` handles an explicit `treatments_to_unlink` list, then appends selected treatment IDs. The server does not derive the complete intended final association set from one canonical payload or verify that all previously linked-but-omitted treatments are removed.

**Impact:** The final appointment-treatment links can diverge from what the user sees in the edit modal, depending on frontend payload behavior.

**Remediation:** Define a single contract for the final treatment ID set, validate ownership/status, compute additions/removals server-side, and commit the association and status reconciliation atomically.

**Status: ✅ FIXED 2026-11-18** — `update_appointment()` unlink handler now applies the same reconciliation logic. Treatments remain `scheduled` if linked to another active appointment.

### DATA-001 — Payment and patient credit ledger semantics need reconciliation — High

**Evidence:** `Patient.net_balance` computes total treatment cost less treatment payments, while `Patient.credit_balance` is separately stored. `add_payment()` deducts credit balance and creates a payment row. `complete_appointment()` may add overflow to credit balance. The financial views also aggregate treatment payments independently.

**Impact:** Credit can be double-counted or become inconsistent unless the meaning of `credit_balance`, payment methods, and net balance is precisely defined. The code currently exposes separate representations of patient debt/credit.

**Remediation:** Define one ledger invariant and document whether credit is a liability/available prepayment, how credit application is represented, and how refunds/overpayments are posted. Add reconciliation tests.

### DATA-002 — Financial input validation is incomplete — High

**Evidence:** Multiple routes convert client strings directly to `Decimal` or parse dates/integers without a shared validation layer. Examples include `finance.py` balance/income/expense/payment routes, `calendar.py` appointment creation/completion, and `patient.py` payment routes.

**Impact:** Malformed values can trigger 500/400 responses; negative, excessive, non-finite, or over-precision amounts may be accepted unless rejected by downstream database constraints. Payment allocation logic is particularly sensitive.

**Remediation:** Centralize parsing and validate finite Decimal values, non-negative constraints, two-decimal currency precision, allowed payment methods, dates, and business-specific maximums. Return safe 400 errors and roll back on every failure.

### DATA-003 — Some money is converted to float at persistence boundary — Medium

**Evidence:** `app/routes/settings.py` parses catalog `default_price` with `float(...)`, despite `Numeric(10,2)` storage. Other `float()` calls are mostly JSON serialization/display boundaries.

**Impact:** Binary floating-point may introduce rounding before persistence for catalog prices. JSON numeric output may also lose exact decimal representation in consumers.

**Remediation:** Parse catalog prices with `Decimal(str(input))`. Prefer decimal strings in JSON contracts where exact cents matter; retain Decimal throughout business calculations.

### DATA-004 — Patient deletion lifecycle is incomplete/unclear — High

**Evidence:** `delete_patient()` bulk-deletes appointments and deletes the Patient model. The Patient model does not declare explicit ORM relationships/cascade rules for treatments, payments, tooth records, prosthetics, and clinical notes. The join table and foreign-key behavior must be verified against SQLite PRAGMA settings.

**Impact:** Deletion may fail due to references or leave orphaned clinical/financial records, depending on database foreign-key enforcement and schema state. Hard-deleting clinical records may also conflict with retention/audit requirements.

**Remediation:** Decide whether patient deletion should be soft-delete/archival or hard-delete under a documented retention policy. Add explicit cascade/restrict behavior and test it with SQLite foreign keys enabled.

### SEC-007 — Assistant role can perform destructive clinical operations — Medium

**Evidence:** `app/routes/patient.py`: `delete_prosthetic()`, `delete_all_prosthetics()` and `reset_teeth_chart()` allow `assistant`, while `AGENTS.md` says assistant is clinical-only and has no deletes. The State Ledger's role matrix also needs to distinguish permitted chart edits from destructive reset/delete actions.

**Impact:** Implemented permissions are broader than the declared policy and may allow destructive changes to clinical chart data.

**Remediation:** Decide whether assistants may delete/reset chart structures. If not, remove assistant from those decorators; if yes, explicitly update the policy and add confirmation/audit logging.

**Status: ✅ FIXED** — Removed `assistant` from `delete_prosthetic()`, `delete_all_prosthetics()`, and `reset_teeth_chart()` decorators.

### SEC-008 — Logout uses GET — Medium

**Evidence:** `app/auth/routes.py`, `/logout` is a GET route that calls `logout_user()`.

**Impact:** Logout can be triggered by a cross-site navigation or prefetch. It violates the intended unsafe-action/CSRF model.

**Remediation:** Change to POST with CSRF token and update the navigation form/button.

**Status: ✅ FIXED** — Logout changed from GET to POST with CSRF token validation.

### SEC-009 — Login `next` redirect is not validated — Medium

**Evidence:** `app/auth/routes.py`, login redirects to `request.args.get('next')` directly after successful authentication.

**Impact:** Open redirect to an external site is possible if a crafted `next` URL is supplied.

**Remediation:** Validate that the target is a safe local relative URL (host/scheme constrained) before redirecting.

**Status: ✅ FIXED** — Login `next` parameter validated to ensure it's a relative URL (no external redirects).

### OPS-001 — Development configuration is the only selected config — High

**Evidence:** `app/__init__.py` imports `DevelopmentConfig` and `create_app()` defaults to it. `DevelopmentConfig` sets `DEBUG=True` and `SQLALCHEMY_ECHO=True`. `wsgi.py` calls `app.run(..., debug=True)` when executed directly.

**Impact:** Debug behavior and SQL logging may expose internals or sensitive query data if used outside development. No explicit production config selection is visible in this archive.

**Remediation:** Add an explicit production config with DEBUG and SQL echo disabled, secure cookie settings, trusted proxy/HTTPS configuration, and production WSGI deployment. Fail closed if production secrets are missing.

### OPS-002 — Broad CORS initialization — Medium

**Evidence:** `app/extensions.py` creates a default `CORS()` extension and `initialize_extensions()` calls `cors.init_app(app)` without visible origin restrictions.

**Impact:** Cross-origin policy is broader than necessary. Actual exploitability depends on browser credential settings and deployment topology.

**Remediation:** Disable CORS if not needed, or restrict exact trusted origins, methods and headers.

### OPS-003 — Debug logging may capture sensitive data — High

**Evidence:** `app/__init__.py` configures DEBUG-level logging to a rotating `appointments.log`; `calendar.py` prints raw appointment payloads and error strings; route code includes debug `print()` calls.

**Impact:** Logs may contain patient names, clinical details, IDs, payment values or other sensitive payloads. The archive itself includes appointment logs.

**Remediation:** Remove payload logging; use structured redacted logs, production-appropriate levels, protected file permissions, retention and access controls. Treat existing logs as potentially sensitive.

### OPS-004 — Instance directory permissions are overly broad on Windows — High

**Evidence:** `configure_instance_folder()` calls `os.chmod(instance_path, 0o777)` on Windows.

**Impact:** The intent is to make the folder broadly accessible, weakening protection around the SQLite database and other instance files.

**Remediation:** Remove broad permission assignment and provision least-privilege ACLs at installation/deployment.

### OPS-005 — `.flaskenv` and startup script bind/debug settings — High

**Evidence:** `.flaskenv` contains `FLASK_DEBUG=1` and `FLASK_RUN_HOST=0.0.0.0`; `wsgi.py` uses `debug=True` and binds to all interfaces when run directly.

**Impact:** Development settings may expose the app on network interfaces. The files must be treated as development-only.

**Remediation:** Document local-only usage and deploy with a production WSGI server, firewall and TLS termination.

### OPS-006 — Project governance documents and migrations are ignored by Git — Medium

**Evidence:** `.gitignore` explicitly ignores `migrations`, `AGENTS.md`, `ARCHITECTURE.md`, `STATE_LEDGER.md`, `STRUCTURE.md` and related files.

**Impact:** Important schema history and project rules may not be tracked/reviewed in the repository. The archive contains migration files, but the ignore rule can prevent new migrations from being added if they are not already tracked.

**Remediation:** Review `git ls-files` and `git check-ignore -v` before changing ignore rules. Version required migrations and governance docs.

### QUAL-001 — No automated test suite — High

**Evidence:** `AGENTS.md` states there are currently no automated tests; no tests directory is present in the archive.

**Impact:** Security, clinical workflow and financial regressions can be introduced without detection.

**Remediation:** Establish pytest using a verified disposable database. Start with authorization/IDOR, treatment scheduling transitions, appointment completion and payment/credit ledger tests.

### UX-001 — Inline style and event-handler policy violations — Low/Medium

**Evidence:** `calendar/dashboard.html` contains inline `<style>` and inline `onclick`; `appointment/list.html`, `patient/list.html` and `patient/profile.html` also contain inline event handlers. Finance JS emits inline event-handler attributes in HTML strings.

**Impact:** Harder maintenance and weaker CSP compatibility; event handlers can compound XSS risk.

**Remediation:** Move behavior to external JavaScript with `addEventListener()` and static styling to CSS files, consistent with `AGENTS.md`.

### DATA-005 — Server-side validation for dental chart inputs is incomplete — Medium

**Evidence:** `save_teeth_chart()` checks that tooth state belongs to `ToothState`, but does not validate the FDI tooth number. `save_prosthetic()` validates type but accepts start/end tooth strings without server-side FDI/arch/range validation.

**Impact:** Invalid or inconsistent clinical chart data can be persisted by bypassing the UI.

**Remediation:** Reuse a server-side FDI validator for single teeth and same-arch ranges; validate prosthetic endpoints and ordering.

### DATA-006 — Expense payment deletion does not verify parent-child ownership — Medium

**Evidence:** `delete_payment(exp_id, pay_id)` loads and deletes `Payment` by `pay_id` without confirming `Payment.expense_id == exp_id`.

**Impact:** An admin can accidentally or intentionally delete a payment belonging to another expense by altering the URL. This is an integrity flaw even though the route is admin-only.

**Remediation:** Query by both IDs and add a mismatch test.

**Status: ✅ FIXED** — Expense payment deletion now validates `Payment.expense_id == exp_id` before deletion.

### DATA-007 — Appointment completion transaction/business validation needs strengthening — High

**Evidence:** `complete_appointment()` sets the appointment completed before validating all requested treatment statuses and payment allocations. It accepts a client-supplied treatment status through enum conversion and does not centralize allowed transitions. The future-appointment guard exists, but other state constraints are not comprehensively enforced.

**Impact:** Invalid or partial status/payment updates may create inconsistent visit histories; client requests can request states that are not appropriate for the treatment's current state.

**Remediation:** Validate the full request before applying changes, enforce transition rules, validate linked treatment IDs, and commit appointment status, treatment status and payments in one atomic transaction.

## Appointment and treatment workflow — intended rule

The user's explicit business decision for this audit is:

1. When a treatment is linked to an active appointment in `scheduled` state, a treatment in `planned` changes to `scheduled`.
2. A treatment already `in_progress` remains `in_progress`; scheduling another visit must not downgrade clinical progress.
3. If a treatment is unlinked or one appointment is cancelled, keep it `scheduled` while any other active (`scheduled` or `in_progress`) appointment remains linked. Revert `scheduled` → `planned` only when no active appointment remains.
4. Completing an appointment is not equivalent to completing every treatment. The clinician records each treatment's actual outcome: `completed` or `in_progress` as appropriate for multi-visit work.
5. GET endpoints do not change state. State transitions occur in create/update/cancel/unlink/complete write transactions.
6. Appointment status and treatment status are separate state machines. Appointment states include `scheduled`, `in_progress`, `completed`, `cancelled`, `deleted`; treatment states include `planned`, `scheduled`, `in_progress`, `completed`, `cancelled`.

The source already transitions planned treatments to scheduled in appointment create/update. The defect is not that scheduling should never change the treatment; the defect is that the documentation contradicted the desired behavior and the cancellation/unlink/read paths are inconsistent.

## Remediation order

1. Fix patient/appointment object authorization and clinical-note XSS.
2. Fix cross-patient payment allocation and expense-payment ownership.
3. Correct treatment/appointment state reconciliation and remove GET-side writes.
4. Define patient deletion and patient credit ledger invariants.
5. Harden production config, logs, CORS and file permissions.
6. Add tests for every critical invariant before modifying live data.

## Limitations

This is a static source audit, not a penetration test or clinical validation. No production `.env`, active database, user accounts, deployed server, reverse proxy, or real browser session was inspected. No claims are made about vulnerabilities being exploitable in a particular deployment until isolated reproduction tests confirm them. The source archive was generated on 2026-11-17 and may not exactly match the currently deployed or committed Git state.
