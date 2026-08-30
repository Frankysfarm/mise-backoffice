# Task packet: Pontstraße shift operations

## Identity

- Task: Connect operational task templates to shifts and configure the initial
  Franky's Farm Pontstraße organization.
- Owner: Codex
- Role: integration
- Base commit: `50b554e9`
- Branch/worktree: `codex/neo-module-integration-20260826`
- Requested by: business owner, 2026-08-30

## Outcome

Managers configure recurring shift workflows in the existing responsibility
module. Each generated task keeps its shift, assignee, accountable lead,
controller, deadline, evidence, and escalation chain. Pontstraße receives an
initial hierarchy and operational templates without creating a second employee
or login model.

## Acceptance criteria

- [x] An active shift template materializes exactly one task per matching shift.
- [x] Open generated tasks follow safe shift assignment/time changes; progressed
      tasks are not silently reassigned.
- [x] Individual tasks continue to work without a shift.
- [x] Managers can create and deactivate shift workflows in Neo on desktop and
      mobile; employees see the linked shift in the existing team app.
- [x] Tenant, location, department, shift, and employee scope are enforced in
      SQL and the server route.
- [x] Pontstraße profiles, hierarchy, responsibilities, deputies, and starter
      workflows are inserted idempotently. Draft profiles do not create Auth
      accounts before real email addresses are supplied.
- [x] Recruiting, trial-shift review, and training routes remain available.

## Exclusive file boundary

- May edit: responsibility API/UI, employee operations UI, matching tests,
  one additive migration, one idempotent production operations script, agent
  task/handoff documentation.
- Read-only context: scheduling, recruiting, training, existing employee/auth
  code.
- Must not touch: Supabase Auth users, unrelated locations/tenants, POS/order
  flows, historical shifts.

## Security and data scope

- Roles in scope: admin/backoffice/manager manage templates; employees consume
  only their own generated tasks.
- Tenant/location rules: every referenced shift, department, and employee must
  belong to the template/task tenant and location.
- Sensitive fields allowed in the browser: names, roles, task/shift context;
  no private HR fields or placeholder technical email addresses.
- Schema/RLS impact: additive task-template and task shift fields, scoped
  security-definer materialization functions callable only by service role,
  existing RLS retained. Rollback keeps columns and disables materialization
  triggers before reverting application code.

## Verification

- Focused tests: shift materialization SQL, responsibility API/source contracts,
  manager and employee rendering.
- Full gates: unit tests, typecheck, build, relevant lint and SQL isolation.
- Browser viewports and authenticated flows: manager desktop/mobile templates;
  employee mobile task with shift context.
- Evidence to record: generated task uniqueness, reassignment guard, canceled
  shift handling, production backup/migration/seed counts, live health.

## Handoff

- Commit: `5f8e4880`
- Step 0 review fixes: revived canceled tasks always clear `accepted_at`; the
  template edit action uses `Pencil` rather than the save icon.
- Department decision: departmentless shifts remain permitted but intentionally
  match none of the 11 department-bound Pontstraße templates. The isolated SQL
  regression proves the non-match; managers select a department when a recurring
  department workflow is required.
- Evidence: SQL suites `075` and `076`, full unit/type/build/browser gates, and
  the integrated evidence record in `docs/agents/HANDOFF.md`.
- Known risks: employee logins remain unavailable until real emails are supplied.
- Reviewer required: independent security and product logic review.
- Rollback: application rollback is compatible with additive schema; disable
  `shifts_operational_tasks_materialize` and
  `task_templates_materialize_shifts` to stop automatic generation.
