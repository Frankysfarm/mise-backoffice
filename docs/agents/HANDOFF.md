# Multi-agent handoff

This file is the durable status board for the current integration. Update it when
ownership, commits, test evidence, risks, or deployment state change.

## Current product invariant

Mise OS is fused into Mais Gastro Neo. Neo remains the only active login,
employee model, tenant/location structure, navigation, notifications, tasks,
reporting, and operational data source.

## Current assignment

- Codex: completed integration of the Pontstraße shift-task packet, daily clarity
  automation, and final pre-deploy SQL hardening.
- Kimi: completed the bounded, read-only Tagesklarheit UI packet; its three
  commits are integrated.
- Claude: completed the original integrated-diff re-review and the final
  pre-deploy hardening review with `PASS`.

## Integration status

- Base commit: `50b554e9`
- Working branch: `codex/neo-module-integration-20260826`
- Task packets:
  - `docs/agents/tasks/2026-08-30-pontstrasse-shift-operations.md`
  - `docs/agents/tasks/2026-08-30-daily-clarity-automation.md`
  - `docs/agents/tasks/2026-08-30-predeploy-operational-hardening.md`
- Integrated code commits, in order:
  - `5f8e4880` — shift-linked recurring tasks and both Step 0 MINOR fixes
  - `b8036dba` — escalation, briefing, and weekly schedule assistant
  - `445bf41c`, `348f4c5b`, `679e9a36` — Kimi Tagesklarheit page,
    navigation, and handoff
  - `b2bdaf85` — privacy, loading/error, canceled-shift, and Berlin-date
    hardening for Tagesklarheit
  - `1e85f775`, `d7e93213` — integrated acceptance and reviewer finding fixes
  - `edd5c7ad` — stable Berlin week calendar/query boundaries
  - `48a587b1` — nullable membership, schedule lock-order, and historical-shift
    import hardening
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
  serializes first by tenant/location/week and then per employee, never overwrites
  an assignment, and closes the normal shift-task materialization loop. Generation
  and confirmation now take the same week lock before any row lock.
- Operational-task actor and reviewer membership treats nullable legacy
  participant columns as false. A malformed row therefore cannot bypass update
  or close authorization.
- Historical shift import policy: inserts and material updates may materialize
  tasks only when `end_zeit` is within the preceding 12 hours or later. The grace
  window permits delayed same-day syncs and overnight closeout; older historical
  imports remain inert and are not backfilled.
- Neo is the only surface. The new clarity route and schedule assistant reuse the
  existing Supabase identity, employee, tenant, location, navigation, task, and
  shift models.

## Verification evidence

- `git diff --check`: passed before the implementation commit and after the final
  review record.
- Full Vitest suite with pinned Node 22.23.0: **34 files / 222 tests passed**.
- `tsc -p tsconfig.delivery-hardening.json --noEmit`: passed.
- Full `tsc --noEmit`: passed with a 4096 MB Node heap.
- Next.js production build: passed; **227 pages** generated. Existing unrelated
  repository lint warnings remain non-fatal.
- Repository Playwright suite: **28 passed** across Desktop Chrome and Pixel 5.
- Fresh isolated PostgreSQL 16 chain passed, in order:
  `unified-operations-base.sql`, migrations `20260828174510`, `20260829204500`,
  `20260830113000`, `20260830154500`, `20260830183000`, then SQL suites `075`,
  `076`, and `077`. Final markers passed for responsibility organization,
  shift-linked operational tasks, and daily clarity automation. New assertions
  prove both malformed membership paths fail closed, historical insert/update
  stays inert, and installed generation/confirmation functions share the week-
  first lock order.
- Focused follow-up Vitest run: **2 files / 12 tests passed**.
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

Original final read-only re-review of `50b554e9..30d7515a`: **PASS**, with no blocker or
major and all nine previously open findings verified closed. Claude independently
reproduced SQL suites `075`–`077` on PostgreSQL 16.13 and the four newly relevant
unit files (19/19). Its three non-gating pre-deploy follow-ups are now closed in
`48a587b1`.

Claude's final read-only review of the follow-up implementation: **PASS**, no
blocker or major. It verified both nullable membership checks fail closed, the
malformed-row regression exercises update and close paths, the shared week-first
lock removes the generation/confirmation cycle, the installed function order is
tested, and the 12-hour historical import guard matches the existing template
rematerialization boundary. The only minor is that lock-order coverage is
structural rather than a live two-session interleave; the reviewer accepted it as
adequate for the requested lock-alignment option.

Remaining evidence gap: authenticated workflow proof still uses the controlled
local protocol fixture rather than a real Supabase staging project. A later
release must repeat staging acceptance; deployment is outside this run.

## Database change and rollback

- Additive migrations:
  - `20260830113000_shift_linked_operational_tasks.sql`
  - `20260830154500_daily_clarity_automation.sql`
  - `20260830183000_predeploy_operational_hardening.sql`
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
- If rollback is required after applying `20260830183000`, ship a new additive
  migration restoring the previous three function bodies. Do not edit applied
  migration history; keep operational tasks and audit records intact.

## Known risks and next authorized step

- No staging/live Supabase credentials were present, so real-provider auth and
  deployed-environment acceptance remain a pre-deploy requirement. The local
  protocol fixture contains no secrets; SQL/RLS behavior was separately proven
  in PostgreSQL.
- The original three final-review follow-ups are closed. A live two-session
  confirmation/generation interleave remains optional stronger evidence; the
  installed lock-order regression and independent review are green.
- Pontstraße draft employee profiles still require real email addresses before
  invitations/login creation.
- Stop in the current run after the final green commit. A later, explicitly
  authorized release must repeat backup, migration, authenticated staging smoke,
  health checks, and rollback verification before production deploy.

## Production deployment attempt — aborted 2026-08-30

- The business owner authorized deployment. The mandatory local guard passed at
  `/Users/eule/mise-neo-module-integration-20260826` on branch
  `codex/neo-module-integration-20260826` at `19e7cc4c` with a clean worktree.
- Production preflight found `/opt/mise/backoffice` on
  `deployment-mise-ready-20260821` at `50b554e9`. The existing generated
  `app/fahrer/build-version.ts` modification was preserved. The active Neo app
  remained `mise_backoffice_3310`; `deploy-app-1` and `deploy-db-1` belong to the
  separate `/opt/rufwaechter/deploy` project and were not changed.
- Required pre-migration backup:
  `/opt/mise/backups/neo-module-integration-pre-20260830T190043Z.dump`
  (PostgreSQL custom format, 8,978,042 bytes, mode `0600`, 4,129 archive-list
  entries, SHA-256
  `79847b1e11290d317c16a223cde0bfadb49fe6865de4c99e82e41453793ff9c2`).
- GitHub `main` was fetched at `92d371ec`. It had diverged from the recorded
  release base, so the release used the required explicit candidate rebase:
  `git rebase --onto 92d371ec 50b554e9`. The first approved release commit
  stopped with nine modify/delete conflicts because concurrent `main` had
  deleted Neo operations application, API, test, and handoff files modified by
  the release. No conflict was resolved or skipped.
- Stop/rollback action: `git rebase --abort` restored the local release exactly
  to `19e7cc4c`. Production source was re-verified at `50b554e9`; no fast-forward
  merge, application build, proxy switch, migration, seed, or production data
  mutation occurred. The validated backup is retained.
- Migration count: **0/3**. Migrations `20260830113000`, `20260830154500`, and
  `20260830183000` were not applied. Post-abort checks found no
  `operational_task_templates.trigger_type` column and no
  `operational_daily_briefings` table.
- Seed count: **0 runs**. Post-abort counts were zero for Pontstraße draft
  employees, `pontstrasse_initial` templates, and `pontstrasse_setup` tasks; the
  seed assertions were therefore not invoked.
- Live checks before the stop: public `/login` returned `200`; unauthenticated
  `/api/cron/operational-escalations` returned protected `401`. Briefing
  materialization and RLS smoke were not run because their migration was not
  applied.
- Resume only with a newly reviewed integration strategy for the deleted Neo
  surfaces. Repeat `fetch`, the explicit release-only rebase, full combined
  gates, backup, migrations in order, seed assertions, blue-green deploy, and
  all live smoke checks. If a future application rollback is needed after
  migration, route nginx back to a preserved previous image and disable the
  operational cron plus the four materialization/retirement triggers named in
  **Database change and rollback**; retain additive schema and audit records.
