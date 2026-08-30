# Multi-agent handoff

This file is the durable status board for the current integration. Update it when
ownership, commits, test evidence, risks, or deployment state change.

## Current product invariant

Mise OS is fused into Mais Gastro Neo. Neo remains the only active login,
employee model, tenant/location structure, navigation, notifications, tasks,
reporting, and operational data source.

## Current assignment

- Codex: integration lead for the Pontstraße shift-task packet and daily clarity
  automation.
- Kimi: completed the bounded, read-only Tagesklarheit UI packet; its three
  commits are integrated.
- Claude: completed the independent integrated-diff re-review with `PASS`.

## Integration status

- Base commit: `50b554e9`
- Working branch: `codex/neo-module-integration-20260826`
- Task packets:
  - `docs/agents/tasks/2026-08-30-pontstrasse-shift-operations.md`
  - `docs/agents/tasks/2026-08-30-daily-clarity-automation.md`
- Integrated code commits, in order:
  - `5f8e4880` — shift-linked recurring tasks and both Step 0 MINOR fixes
  - `b8036dba` — escalation, briefing, and weekly schedule assistant
  - `445bf41c`, `348f4c5b`, `679e9a36` — Kimi Tagesklarheit page,
    navigation, and handoff
  - `b2bdaf85` — privacy, loading/error, canceled-shift, and Berlin-date
    hardening for Tagesklarheit
  - `1e85f775`, `d7e93213` — integrated acceptance and reviewer finding fixes
  - `edd5c7ad` — stable Berlin week calendar/query boundaries
- Deployment state: **not deployed**. No production schema or data operation was
  performed in this run, as requested.

## Acceptance mapping and decisions

- Shift-linked tasks are unique per template/shift, keep tenant/location/
  department scope, safely follow unprogressed shift changes, and never silently
  reassign progressed tasks. Reviving any canceled task clears `accepted_at`.
- Departmentless shifts intentionally remain valid location-wide shifts. They
  match no department-bound template; all 11 Pontstraße starter templates are
  department-bound, so a manager must select a department for those workflows.
  This behavior is explicit in the isolated SQL regression suite.
- Escalation uses the existing protected Vercel cron route
  `/api/cron/operational-escalations`, already scheduled every three minutes.
  The escalation interval is independently configurable through
  `OPERATIONAL_ESCALATION_INTERVAL_HOURS` (default four hours, cap level 3).
  The same invocation refreshes derived daily briefings; refresh updates are not
  audit events, preventing a three-minute audit-log flood.
- One Berlin-day briefing is materialized per tenant/location and exposes safe
  operational facts only. Private absence reasons are absent from browser and
  briefing payloads; managers are limited to their own location.
- Weekly assignment suggestions consider availability, responsibility/
  qualification, overlaps, and fairness. Every suggestion explains itself and
  requires per-shift manager confirmation. Confirmation revalidates eligibility,
  serializes per employee, never overwrites an assignment, and closes the normal
  shift-task materialization loop.
- Neo is the only surface. The new clarity route and schedule assistant reuse the
  existing Supabase identity, employee, tenant, location, navigation, task, and
  shift models.

## Verification evidence

- `git diff --check`: passed before the evidence commit; repeat after the final
  review record.
- Full Vitest suite with pinned Node 22.23.0: **34 files / 222 tests passed**.
- `tsc -p tsconfig.delivery-hardening.json --noEmit`: passed.
- Full `tsc --noEmit`: passed with a 4096 MB Node heap.
- Next.js production build: passed; **227 pages** generated. Existing unrelated
  repository lint warnings remain non-fatal.
- Repository Playwright suite: **28 passed** across Desktop Chrome and Pixel 5.
- Fresh isolated PostgreSQL 16 chain passed, in order:
  `unified-operations-base.sql`, migrations `20260828174510`, `20260829204500`,
  `20260830113000`, `20260830154500`, then SQL suites `075`, `076`, and `077`.
  Final markers: responsibility organization, shift-linked operational task, and
  daily clarity automation tests all passed.
- Authenticated local acceptance passed through the real Next middleware, server
  components, APIs, desktop Chrome, and Pixel 5 using a disposable Supabase-
  protocol fixture and non-production auth cookie. Verified: Tagesklarheit
  desktop/mobile, privacy-safe absence display, morning briefing, explainable
  weekly suggestions, per-shift confirmation, and the exact Berlin week value
  `2026-09-14` reaching the generation RPC.
- Browser artifacts:
  - `docs/agents/evidence/daily-clarity-2026-08-30/klarheit-desktop.png`
  - `docs/agents/evidence/daily-clarity-2026-08-30/klarheit-mobile.png`
  - `docs/agents/evidence/daily-clarity-2026-08-30/morgenbriefing-desktop.png`
  - `docs/agents/evidence/daily-clarity-2026-08-30/wochenassistent-desktop.png`

## Independent review

The first integrated Claude review returned FAIL with two major and five minor
findings. Code fixes now close the audit-refresh flood, briefing/task-count
drift, probe-shift inclusion, manager location scope, cleared-shift regeneration,
concurrent confirmation race, and null-location company-wide actor behavior.
The stale handoff/evidence major is addressed by this document.

Final read-only re-review of `50b554e9..30d7515a`: **PASS**, with no blocker or
major and all nine previously open findings verified closed. Claude independently
reproduced SQL suites `075`–`077` on PostgreSQL 16.13 and the four newly relevant
unit files (19/19). Three non-gating minors remain for a pre-deploy follow-up or
explicit human disposition:

- `20260830113000_shift_linked_operational_tasks.sql:778`: membership expressed
  with `id in (nullable columns)` can evaluate to SQL NULL rather than false.
  The reviewer empirically confirmed the fail-open for a task with every
  participant field null; current application-created tasks make those actors
  non-null, so the app path is not reachable. Follow-up: wrap membership checks
  in `coalesce(...,false)` and add the malformed-row regression.
- `20260830154500_daily_clarity_automation.sql:380` and `:589`: generation and
  confirmation acquire week/suggestion/employee/shift locks in different orders,
  leaving a transient deadlock possibility under an exact concurrent interleave.
  Follow-up: align lock order or add bounded SQLSTATE `40P01` retry coverage.
- `20260830113000_shift_linked_operational_tasks.sql:815`: the shift trigger has
  no historical-date guard, so a newly inserted or materially updated historical
  shift can materialize tasks. Existing historical rows are not backfilled.
  Follow-up: define the intended import behavior and add an end-time guard if
  historical imports must remain inert.

Evidence gaps retained from the review: authenticated workflow proof uses the
controlled local protocol fixture rather than a real Supabase staging project;
the exact concurrent deadlock interleave and historical-import policy do not yet
have automated acceptance coverage. These are pre-deploy items; deployment is
outside this run.

## Database change and rollback

- Additive migrations:
  - `20260830113000_shift_linked_operational_tasks.sql`
  - `20260830154500_daily_clarity_automation.sql`
- No production migration was applied. Before deployment, the safe rollback is
  therefore to revert the listed application commits and deploy nothing.
- If application rollback occurs after migration, the previous application is
  compatible with the additive schema. Disable calls to the operational cron and
  the `shifts_operational_tasks_materialize`,
  `shifts_operational_tasks_retire_change`,
  `shifts_operational_tasks_cancel_delete`, and
  `task_templates_materialize_shifts` triggers to stop new automation while
  retaining generated records for auditability.
- Do not drop tables/columns as an emergency rollback. A later destructive down
  migration may remove briefing/suggestion functions, policies, and tables only
  after dependency and retention review.

## Known risks and next authorized step

- No staging/live Supabase credentials were present, so real-provider auth and
  deployed-environment acceptance remain a pre-deploy requirement. The local
  protocol fixture contains no secrets; SQL/RLS behavior was separately proven
  in PostgreSQL.
- The three final-review minors above require a follow-up fix packet or explicit
  human acceptance before a later deployment.
- Pontstraße draft employee profiles still require real email addresses before
  invitations/login creation.
- Stop in the current run after the final green commit. A later, explicitly
  authorized release must repeat backup, migration, authenticated staging smoke,
  health checks, and rollback verification before production deploy.
