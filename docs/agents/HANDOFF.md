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
- Deployment state: **deployed to production** in owner-approved attempt 6. The
  application is serving release `87320087` from image `2d29e61b`; the additive
  schema and Pontstraße seed are live, and the four automation triggers are
  enabled. Full attempt-6 evidence and the executable rollback outline are
  recorded below.

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

The controlled local authenticated browser evidence remains the broad UI proof.
Attempt 6 adds live-provider evidence for identity resolution and manager RLS:
an Auth-linked production manager could read the one own-location briefing and
zero of three foreign-location briefings. Public application and protected-cron
checks also passed after the production switch.

## Database change and rollback

- Additive migrations:
  - `20260830113000_shift_linked_operational_tasks.sql`
  - `20260830154500_daily_clarity_automation.sql`
  - `20260830183000_predeploy_operational_hardening.sql`
- Production attempt 5 applied all three migrations in order. The application
  was then rolled back to source commit `50b554e9`; the additive schema and
  seeded audit/operational records were retained. The four new automation
  triggers were disabled as recorded in the attempt-5 evidence below.
- Production attempt 6 deployed source commit `87320087` and re-enabled all four
  automation triggers in one committed transaction after rollback-image and
  application health verification. The schema was not reapplied; installed
  migration objects were verified before deployment. The idempotent Pontstraße
  seed was rerun once and passed.
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

## Known risks and post-release follow-up

- The full authenticated browser suite still uses the controlled local protocol
  fixture. Production acceptance covered live identity helper resolution and
  manager briefing RLS directly in PostgreSQL, plus public HTTP health; it did
  not use a human production browser session.
- The original three final-review follow-ups are closed. A live two-session
  confirmation/generation interleave remains optional stronger evidence; the
  installed lock-order regression and independent review are green.
- Pontstraße draft employee profiles still require real email addresses before
  invitations/login creation.
- The production deploy-script fix currently lives at
  `/opt/mise/auto-deploy.sh`; its exact pre-attempt-6 backup and both checksums
  are recorded below. A future infrastructure change should bring that script
  under version control without restoring the old global-prune behavior.
- GitHub `origin/main` reconciliation remains a separate reviewed task. The
  production checkout intentionally follows the previously authorized
  fast-forward ancestry and was not rebased or merged during attempt 6.

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

## Production deployment attempt 5 — aborted and rolled back 2026-08-30

- Owner-approved release guard: the clean local branch
  `codex/neo-module-integration-20260826` was exactly `87320087`. Production
  `/opt/mise/backoffice` was re-verified on
  `deployment-mise-ready-20260821` at exact HEAD `50b554e9`, and
  `git merge-base --is-ancestor 50b554e9 87320087` passed before any production
  change. The known generated-only modification to
  `app/fahrer/build-version.ts` was the sole checkout change.
- Transport used
  `/tmp/neo-module-integration-attempt5.bundle` through the approved SSH jump
  host. The bundle required exact base `50b554e9`, exposed exact candidate
  `87320087`, and had SHA-256
  `e07d399475fb57da366aed93261297bca9e7a60626ddf57f131d57368304b8bb`.
  The production checkout was advanced with `git merge --ff-only`; no GitHub
  fetch, rebase, merge, or `origin/main` reconciliation occurred.
- Preflight disk state was 75 GB total, 60 GB used, 13 GB available (83%).
  Docker reported zero build cache and no useful safe unused-image cleanup, so
  no image cleanup was run manually. The prior validated backup was reused and
  retained unchanged:
  `/opt/mise/backups/neo-module-integration-pre-20260830T190043Z.dump`,
  8,978,042 bytes, mode `0600`, 4,129 archive-list entries, SHA-256
  `79847b1e11290d317c16a223cde0bfadb49fe6865de4c99e82e41453793ff9c2`.
- The production database has no
  `supabase_migrations.schema_migrations` registry. The reviewed SQL files were
  therefore applied directly with `psql`, `ON_ERROR_STOP`, and their explicit
  transactions. All three committed successfully in order:
  `20260830113000`, `20260830154500`, `20260830183000`. Verification found the
  new `trigger_type` column and `operational_daily_briefings` table/function,
  plus the installed 12-hour historical guard and advisory-lock hardening.
- The Pontstraße seed ran twice and printed
  `Pontstraße organization seed passed` both times. Both runs ended with the
  same assertions: 9 draft employee profiles, 11 active
  `pontstrasse_initial` templates, 10 `pontstrasse_setup` tasks, zero uncovered
  required areas, and zero draft profiles linked to Auth identities.
- Candidate image `507aa0201593b25a6c892f8129a77c09371dac98e78a5558029dd7365a275f68`
  built successfully, passed inactive-port 3300 health in two seconds with HTTP
  `307` and `running|0`, and nginx switched from 3310 to 3300 at
  `2026-08-30T20:09:59Z`.
- Mandatory post-switch rollback-readiness verification then failed: the
  pre-tagged old image and tag `mise-backoffice:rollback-50b554e9-attempt5`
  were both absent after the deployment script's final container/image cleanup
  phase. The old image had been
  `2068f64b9440b5acfaa0530041277616f1cc40b45a99ea406f6be9135fcec2b0`.
  Acceptance stopped immediately; briefing materialization and production RLS
  smoke were not run.
- Rollback rebuilt exact application source commit `50b554e9` in isolated
  detached worktree `/opt/mise/rollback-attempt5-50b554e9` as image
  `df8cf1b837fbad52511a25247fa104e5941f8c3ddb0b87700296489a1c505dc7`
  tagged `mise-backoffice:rollback-50b554e9-attempt5`. It passed inactive-port
  3310 health in two seconds with HTTP `307` and `running|0`; nginx switched
  back to 3310 at `2026-08-30T20:22:59Z`, and the candidate container was
  removed.
- Rollback verification: the active container is
  `mise_backoffice_3310` on the rebuilt `50b554e9` image; public
  `https://mise-gastro.de/login` returns `200`; unauthenticated
  `/api/cron/operational-escalations` returns `401`. The production source
  checkout intentionally remains the authorized fast-forward at `87320087`
  with only the generated build-version modification; the deployed application
  is the previous `50b554e9` release.
- Database rollback retained the additive migrations and seed records. The
  application rollback removes the new cron invocation path. In one committed
  transaction, triggers `shifts_operational_tasks_materialize`,
  `shifts_operational_tasks_retire_change`,
  `shifts_operational_tasks_cancel_delete`, and
  `task_templates_materialize_shifts` were disabled; catalog verification
  reported `tgenabled = 'D'` for all four. Do not restore the pre-migration dump
  or drop the additive objects as an emergency rollback.
- Release state: **not deployed**. Before another attempt, fix and independently
  verify rollback-image preservation across the deployment script's cleanup,
  re-enable the four triggers only as part of an authorized successful release,
  and repeat live briefing materialization plus RLS smoke. Reconciliation with
  the stale/diverged GitHub `origin/main` remains explicitly out of scope and is
  a HANDOFF follow-up, not a prerequisite to preserving the production
  fast-forward ancestry.

## Production deployment attempt 6 — deployed 2026-08-30

- Owner-approved release guard: local
  `/Users/eule/mise-neo-module-integration-20260826` was clean at `cdd72763`,
  whose only change after authorized release `87320087` is this handoff record.
  Production `/opt/mise/backoffice` was exact `87320087` with only the expected
  generated `app/fahrer/build-version.ts` modification. No Git fetch, merge,
  rebase, or checkout advance was performed.
- Phase-1 disk preflight reported 75 GB total, 62 GB used, and 11 GB available
  (86%). The live application was `mise_backoffice_3310` on exact image
  `df8cf1b837fbad52511a25247fa104e5941f8c3ddb0b87700296489a1c505dc7`.
  The validated pre-migration backup remained present, mode `0600`, 8,978,042
  bytes, SHA-256
  `79847b1e11290d317c16a223cde0bfadb49fe6865de4c99e82e41453793ff9c2`.
- The production deployment script was fixed in place. Before nginx can switch,
  it now resolves the active container's immutable image ID, tags that exact ID
  as `mise-backoffice:previous`, and verifies the tag-to-ID mapping. After a
  successful switch it tags the candidate as `mise-backoffice:current` and
  cleans only obsolete `mise-backoffice` images; current, previous, and any
  image still used by a container are excluded. New builds carry the
  `com.mise.app=backoffice` label, and the former global
  `docker image prune -f` is gone. Cleanup ends with a second exact previous-ID
  assertion.
- Script evidence: the original is retained as
  `/opt/mise/auto-deploy.sh.pre-attempt6-20260830T210444Z`, SHA-256
  `401d9f291069240e2db8719201edf5eb8e0b16130de7822e2f6a2223d1629d37`.
  The fixed `/opt/mise/auto-deploy.sh` is mode `0755`, owned by root, passed
  `bash -n`, and has SHA-256
  `e8ca14dfcf64c762bf632e5fa571b2c121f9d376fe78e4eac12954e5ddd4caf9`.
  Its `--check-rollback-preservation` dry-run resolved the exact live image,
  marked it protected, and reported `PASS`; before/after comparisons proved the
  Docker image and container inventories were unchanged.
- Installed migration objects were verified rather than reapplied. All four
  automation triggers were still disabled before deployment. The existing seed
  counts were 9 Pontstraße draft profiles, 11 active starter templates, and 10
  setup tasks; one authorized idempotent rerun committed and printed
  `Pontstraße organization seed passed` with the same assertions.
- The fixed script built candidate image
  `2d29e61bfdda98fb82570361da139a3945c864fe4e37a6740f28d2d27be18085`,
  which passed inactive-port 3300 health in two seconds with HTTP `307` and
  `running|0`. It preserved the old image before switching nginx to 3300 at
  `2026-08-30T21:21:16Z`; cleanup finished at `21:21:20Z` with its rollback
  assertion green.
- Independent post-cleanup verification found active tag
  `mise-backoffice:current` on `2d29e61b` and rollback tag
  `mise-backoffice:previous` on exact old image `df8cf1b`. Only those two unique
  backoffice images remain (the candidate also has `auto`; the previous also
  retains `rollback-50b554e9-attempt5`). Disk use remained 62 GB with 11 GB
  available (86%).
- Only after that verification, one transaction enabled
  `shifts_operational_tasks_materialize`,
  `shifts_operational_tasks_retire_change`,
  `shifts_operational_tasks_cancel_delete`, and
  `task_templates_materialize_shifts`. The transaction committed and final
  catalog verification reported `tgenabled = 'O'` for all four.
- Live acceptance passed. Briefing materialization returned 6 and produced one
  Berlin-day row for each of the 6 production locations. An Auth-linked manager
  resolved to the expected employee and tenant, read exactly 1 own-location
  briefing, and read 0 of 3 same-tenant foreign-location briefings under role
  `authenticated`. `https://mise-gastro.de/login` returned `200`, while an
  unauthenticated request to
  `https://mise-gastro.de/api/cron/operational-escalations` returned `401`.
  Final container state was `running|0` on 3300, the rollback tag still resolved
  to `df8cf1b`, and all four triggers remained enabled.

### Final rollback notes for attempt 6

- Application rollback target is the preserved
  `mise-backoffice:previous` image, immutable ID
  `df8cf1b837fbad52511a25247fa104e5941f8c3ddb0b87700296489a1c505dc7`,
  corresponding to source release `50b554e9`. Before using it, re-verify both
  the tag and immutable ID with `docker image inspect`.
- Recreate `mise_backoffice_3310` from `mise-backoffice:previous` using the same
  `.env`, `.env.local`, read-only `/opt/mise/secrets` mount, host network,
  `PORT=3310`, `HOSTNAME=0.0.0.0`, and `unless-stopped` policy used by the deploy
  script. Require HTTP `200/30x`, container `running`, and restart count zero on
  inactive port 3310 before changing nginx or `/opt/mise/.mise_active_port`.
- If traffic is rolled back to 3310, disable all four attempt-6 triggers in one
  transaction and verify `tgenabled = 'D'` for each; then remove the 3300
  candidate container only after public `/login` is `200` and unauthenticated
  cron remains `401` on the previous application. Keep the additive schema,
  seeded records, briefings, operational tasks, and audit history intact.
- Do not restore the pre-migration dump, drop additive objects, or use the old
  deploy script as an emergency shortcut. The pre-attempt-6 script backup is
  retained for audit/forensics; it contains the cleanup defect that caused
  attempt 5 to abort.
