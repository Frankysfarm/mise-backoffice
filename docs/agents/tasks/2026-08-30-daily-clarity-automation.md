# Task packet: Daily clarity automation (Codex)

## Identity

- Task: Finish the Pontstraße packet, then build the daily automation layer:
  escalation sweep, morning briefing, and the weekly schedule assistant v1.
- Owner: Codex (integration lead)
- Role: integration
- Base: uncommitted work on `codex/neo-module-integration-20260826` (base 50b554e9)
- Requested by: business owner, 2026-08-30
- Claude review of the pending diff: PASS, no blocker/major (see findings below)

## Step 0 — Land the pending Pontstraße work first

1. Apply Claude's two MINOR findings, then commit the pending diff:
   - `supabase/migrations/20260830113000_shift_linked_operational_tasks.sql`
     (~L546): a `storniert` task revived to `offen` with the SAME assignee keeps
     its stale `accepted_at`. Reset `accepted_at` to null whenever status is
     reset from `storniert` to `offen`, regardless of assignee change.
   - `responsibility-client.tsx` TaskTemplateCard: edit button uses the Save
     icon; use a pencil (`Pencil`/`SquarePen`) instead.
2. During the authenticated acceptance run, verify explicitly: a shift WITHOUT
   a department matches no department-bound template (all 11 Pontstraße
   templates are department-bound). Decide and document whether that is the
   intended behavior or whether shifts must require a department.
3. NOTE (no action forced): `p_task_kind` is validated only by Zod, not in SQL;
   route `isLead` first-gate pass is dead code. Clean up only if trivial.

## Outcome

Every morning the system creates clarity on its own: overdue tasks escalate to
the accountable person, each location gets a morning briefing (who works today,
what is open/overdue, which areas are uncovered), and the manager gets a
suggested weekly schedule built from availability and area responsibility that
they confirm — never silent auto-assignment.

## Scope, in priority order

### 1. Escalation sweep (service-role, idempotent, safe to re-run)

- A scheduled job (Vercel cron route or SQL function + pg_cron — pick what the
  deploy target actually supports; document the choice) that, per tenant and
  location: finds `operational_tasks` past `due_at` in open states, raises
  `escalation_level` by 1 (cap 3) at most once per configurable interval
  (default 4h) per task, and records who must act (accountable, then
  controller at level ≥2). Audit every change. No hard-coded tenant IDs.

### 2. Morning briefing (per location, per day)

- Materialize one briefing record per location/day (new additive table, RLS
  manager-read within location, tenant-scoped): today's shifts with assignees,
  open + overdue task counts per department, coverage gaps from
  `v_responsibility_coverage`, absences, escalated tasks. Idempotent upsert.
- Surface it read-only in Neo (a small card/section on the existing
  responsibility dashboard tab is enough — Kimi builds the full clarity page
  separately; do NOT build a big new page yourself).

### 3. Weekly schedule assistant v1 (suggestion, not automation)

- A service-role function that, for a given location + week, proposes shift
  assignments from: availability (existing availability data), department
  responsibility/qualification, no double-booking, and fairness (balance
  assigned hours across employees). Output = draft suggestions the manager
  confirms per shift in the existing scheduling UI; confirming writes normal
  shifts (which then auto-materialize shift tasks — the loop closes).
- Never overwrite confirmed shifts. Suggestions must be explainable: each one
  carries a short reason string (German, owner-friendly).

## Exclusive file boundary

- May edit: responsibility/operations API+UI, scheduling suggestion API,
  additive migrations, cron/job routes, matching tests, agent docs.
- Must not touch: Supabase Auth users, POS/order flows, `/opt/franky-storefront`,
  unrelated tenants, historical shifts.
- Kimi works in parallel in worktree `mise-neo-kimi-tagesklarheit` (branch
  `kimi/tagesklarheit-ui`, base 50b554e9) on a read-only clarity page under
  `app/(neo)/neo/app/klarheit/`. Do not create that page; you integrate and
  review their branch when it is handed back.

## Security and data scope

- All new writes go through service-role RPCs or RLS-guarded tables with
  tenant_id + location scope enforced in SQL (same pattern as
  `save_shift_operational_template`).
- German user-facing texts, no private HR fields in the browser, no secrets in
  the repo.

## Verification (gates before you call anything done)

- Unit tests for sweep, briefing and suggestion logic; SQL isolation test for
  new migrations; full suite + typecheck + build green; update
  `docs/agents/HANDOFF.md` with evidence; request independent Claude review
  before deploy. Only you deploy, with backup + rollback note, as usual.

## Execution record

- [x] Step 0 Pontstraße review fixes applied and committed as `5f8e4880`.
- [x] Escalation sweep implemented through the existing protected Vercel cron;
  configurable four-hour default interval, level cap, accountable/controller
  owner, notifications, and audit evidence are covered by SQL suite `077`.
- [x] Privacy-safe Berlin-day briefings materialize idempotently per location,
  use location-scoped manager RLS, include overlapping shifts and today/null-due
  tasks, and render read-only in Neo.
- [x] Weekly schedule suggestions use availability (including continuous weekly
  ranges), department qualification, conflict checks, and fair assigned hours.
  Managers confirm one shift at a time; confirmation rechecks constraints and
  serializes per employee.
- [x] Kimi's read-only Tagesklarheit page was integrated and hardened for
  loading, error, empty, desktop, mobile, privacy, probe/canceled shift, and
  Berlin-date states.
- [x] A browser-discovered UTC serialization defect was closed in `edd5c7ad`;
  `2026-09-14` now remains the assistant week while shift queries use the correct
  Berlin-midnight UTC bounds.
- [x] Departmentless shifts intentionally match no department-bound Pontstraße
  template. They remain valid for location-wide planning; department recurring
  workflows require the manager to select a department.
- [x] Full verification is recorded in `docs/agents/HANDOFF.md`: 34/222 unit
  tests, both TypeScript checks, 227-page build, 28 Playwright checks, fresh SQL
  suites `075`–`077`, and authenticated desktop/mobile local acceptance.
- [x] Final independent Claude re-review: `PASS`, no blocker/major. Three
  non-gating pre-deploy follow-ups are recorded in `docs/agents/HANDOFF.md`.
- [x] No deploy or production database operation performed in this run.

## Operational choices and rollback

- Scheduler: Vercel cron was chosen because it is already configured in the
  deploy target at `/api/cron/operational-escalations`. Briefings refresh on the
  same three-minute invocation; only insert/delete briefing lifecycle events are
  audited, so derived refreshes do not flood the audit log.
- Rollback before deployment: revert the integration commits and deploy nothing.
  After an additive migration, revert the app and disable cron/shift-task
  triggers; retain generated rows for auditability. Any destructive schema down
  migration requires a separate retention/dependency review.
