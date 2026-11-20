# Dental App — Remediation Roadmap

**Updated:** 2026-11-17
**Basis:** Static audit of `dental_app_audit.zip`. See `AUDIT_REPORT.md` for evidence, file locations, impacts and limitations.

## Guiding rules

- No remediation is considered complete until it has a regression test.
- Tests must use a disposable, verified test database—not the configured clinic SQLite database.
- Preserve existing behavior except for explicitly approved fixes.
- Do not deploy with real patient information until the critical security and data-integrity items are resolved and verified.
- Keep `AGENTS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `STATE_LEDGER.md` and this roadmap synchronized and versioned.

## Phase 0 — Audit baseline

- [X] **AUDIT-001:** Static source audit of routes, models, migrations, configuration, templates, JavaScript and CSS.
- [X] **DOC-001:** Correct the State Ledger scheduling rule to match the intended business behavior: booking a treatment to an active scheduled appointment changes `planned` → `scheduled`.
- [X] **DOC-002:** Document cancellation/unlink reconciliation, multi-visit semantics and GET read-only requirements.
- [ ] **DOC-003:** Review `.gitignore`; required governance docs and `migrations/` are currently ignored by patterns. Inspect tracked files before changing ignore rules.
- [ ] **QUAL-001:** Create a pytest baseline using a disposable SQLite test database.

## Phase 1 — Critical security and patient privacy

1. [X] **SEC-001 —** Stored XSS in clinical notes: Replaced `insertAdjacentHTML()` with safe DOM construction using `textContent` (2026-11-18).
2. [X] **SEC-002** — Prosthetic IDOR: Ownership validation added
3. [X] **SEC-003 —** Clinical note relationship validation: Validate treatment/appointment ownership and same-patient constraint (2026-11-18).

4. **SEC-004 — High — Payment allocation IDOR:** In `calendar.py`, constrain client-provided payment treatment IDs to the appointment's patient and eligible treatments.

5. [X] **SEC-005 — Appointment authorization:** Replaced broken patient/user ID check with role-based scope (Dentist restricted to own appointments). Unified cancellation logic with API route (LOGIC-007) (2026-11-18).Correct the invalid `appointment.patient_id == current_user.id` check in `app/routes/appointment.py`; implement role-specific appointment scope consistentl

6. **SEC-006 — High — Appointment update/cancel scope:** Enforce dentist assignment and agreed secretary/admin permissions consistently across read, update, cancel and complete routes

7. [X] **SEC-007** — Assistant role: Removed from destructive operations
8. [X] **SEC-008 —** Logout method: Changed to POST with CSRF
9. [X] **SEC-009 —** Open redirect: URL validation added

10. **SEC-010 — Medium — Frontend policy:** Remove inline event handlers and inline `<style>`/script logic according to project rules; ensure CSP-compatible behavior.

## Phase 2 — Appointment and treatment state integrity

**Approved business rule:** If a treatment is linked to an active appointment whose status is `scheduled`, a `planned` treatment becomes `scheduled`. `in_progress` remains `in_progress`. This is intentional and must not be reverted to the old State Ledger rule.

1. [X] **LOGIC-001 — GET purity: State mutation removed from GET endpoint**
2. [X] **LOGIC-002 — High — Cancellation reconciliation:** Implemented active-appointment check (2026-11-18).
3. [X] **LOGIC-003 — High — Unlink reconciliation:** Applied same remaining-active-appointment check (2026-11-18).

4. **LOGIC-004 — High — Final association set:** Make appointment editing reconcile the complete desired treatment link set atomically; do not rely on partial or ambiguous unlink payloads.
5. **LOGIC-005 — High — Legal state transitions:** Centralize transitions and prevent arbitrary client-selected status changes. Distinguish appointment completion from treatment completion.
6. **LOGIC-006 — Medium — Multi-visit behavior:** Preserve `in_progress` treatment status when booking subsequent visits; block completion only when the documented future-visit rule applies.

7. [X] **LOGIC-007 — Single cancellation service:** HTML and API cancellation routes now share the exact same treatment reconciliation logic (2026-11-18).

## Phase 3 — Financial correctness

1. **DATA-001 — High — Patient credit invariant:** Define one authoritative ledger formula for treatment cost, insurance, payments and credit. Document whether credit is a stored wallet balance, an unapplied payment liability, or a derived balance; prevent double counting.
2. **DATA-002 — High — Input validation:** Validate all financial inputs as finite Decimal values, with non-negative/maximum/two-decimal constraints and safe error handling.
3. **DATA-003 — High — Payment allocation:** Validate ownership, linked treatment membership, remaining balance and credit behavior. Test overpayment, partial payment, refunds and allocation rollback.
4. **DATA-004 — Medium — Decimal boundaries:** Parse catalog prices with Decimal (not float). Keep Decimal in calculations and persistence; serialize with a documented JSON precision contract.
5. **DATA-005 — Medium — Expense payment ownership:** Verify `Payment.expense_id == exp_id` before deleting a payment using `/expenses/<exp_id>/payment/<pay_id>`.

6. [X] **DATA-006** — Expense payment ownership: Validation added

## Phase 4 — Database integrity and clinical data lifecycle

1. **DB-001 — High — Patient deletion policy:** Decide archival/soft-delete versus hard-delete based on clinical/legal retention requirements. Do not hard-delete clinical history without an approved retention policy.
2. **DB-002 — High — Referential integrity:** Define FK cascade/restrict behavior for patient, treatment, payments, notes, prosthetics, tooth records and appointment-treatment links. Verify SQLite foreign-key enforcement.
3. **DB-003 — Medium — Server-side clinical validation:** Validate FDI tooth numbers, same-arch ranges and prosthetic endpoints on the server, not only in JavaScript.
4. **DB-004 — Medium — Appointment validation:** Validate end time after start time, timezone normalization, overlapping appointments and dentist availability.
5. **DB-005 — Medium — Schema/migrations:** Review migration chain, schema drift and constraints. Ensure migrations are tracked in Git.

## Phase 5 — Production operations

1. **OPS-001 — High — Production configuration:** Add/select explicit production config with DEBUG and SQL echo disabled, secure cookies, HTTPS/proxy settings and no development server.
2. **OPS-002 — High — Logging/privacy:** Remove raw payload prints and sensitive exception responses. Use structured redacted logs with access controls and retention.
3. **OPS-003 — High — Instance permissions:** Remove Windows `chmod(..., 0o777)` and provision least-privilege filesystem ACLs.
4. **OPS-004 — Medium — CORS:** Disable if unnecessary; otherwise restrict origins, methods and headers.
5. **OPS-005 — High — Backups/recovery:** Establish encrypted backups, retention, off-device copies and periodic restore drills.
6. **OPS-006 — Medium — Dependencies:** Pin dependency versions and run vulnerability checks; plan supported upgrades.
7. **OPS-007 — Medium — Deployment:** Use a production WSGI server, TLS, firewalling and documented environment provisioning.

## Phase 6 — Quality, performance and usability

1. **TEST-001 — High:** Role matrix, CSRF and cross-patient access tests for every sensitive route.
2. **TEST-002 — High:** Appointment/treatment state-machine tests, including create, reschedule, multi-visit, unlink, cancel and completion.
3. **TEST-003 — High:** Financial invariant tests for Decimal, payment allocations, credit, refunds and transaction rollback.
4. **TEST-004 — Medium:** Frontend tests for calendar modal reset, treatment selection and safe rendering.
5. **PERF-001 — Medium:** Profile and address N+1 queries in clinical log and payment aggregation.
6. **UX-001 — Medium:** Audit responsive behavior, accessibility, keyboard/focus management and validation feedback.

## Completion criteria

The application is not production-ready until all High findings have been fixed and verified, the critical tests pass against an isolated database, backups have been restored successfully in a drill, and production configuration has been reviewed. Medium/Low items should be scheduled and tracked rather than silently deferred.
