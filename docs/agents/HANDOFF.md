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
# 2026-08-31 — Packet C-A Bewerbungstests, Schulungen, Onboarding

- Branch: `vollausbau/c-a`; Implementierungscommit `ca8a8f3`.
- Audit/Änderungen/DB/RLS/Rollback/manuelle Klickwege: `docs/agents/reports/2026-08-31-c-a.md`.
- Gates: TypeScript Exit 0; Vitest 37 Dateien/229 Tests grün (Stand Fix round 2, inklusive AI-Normalisierungsregression); Next Build Exit 0/233 Seiten; gezieltes, API-simuliertes Playwright für den Bewerberbildschirm Desktop + Mobile 2/2 grün (kein Ende-zu-Ende-/Datenbankbeleg); `git diff --check` Exit 0.
- Risiko/Restpunkt: kein `.env` und keine Datenbank auf Factory-Host, daher Migration und authentifizierter Live-Supabase-Personaflow vor Deployment in isolierter Testinstanz ausführen. Kein Deploy aus diesem Packet.

# 2026-08-31 — Packet C-F (vollausbau/c-f)

- Implementierungscommit: `18be150` (`feat(ablaeufe): replace JSON editor with guided workflows`).
- Visueller Ablauf-/Listen-Editor ersetzt das bisherige JSON-Textarea auf dem kanonischen `shift_guides.inhalt`-Modell.
- Mobile geführte Ausführung nutzt `operational_tasks` und den bestehenden Foto-Evidence-Mechanismus; Pflichtschritte blockieren den Abschluss.
- Additive Migration: `20260831150000_visual_shift_guide_editor.sql` (Scope/RLS, Legacy-Normalisierung, Procedure-Snapshots).
- Gates: Vitest 228/228, TypeScript Exit 0, Next Build 228/228. Playwright-Spec vorhanden; Factory-Webserver durch read-only `node_modules`/`.next/standalone` EROFS blockiert. Details und manuelle Prüfung: `docs/agents/reports/2026-08-31-c-f.md`.

# Vollausbau Packet C-C — 2026-08-31

- Wiederkehrende operative Regeln und strukturierte Übergaben sind additiv auf `operational_task_templates`, `operational_tasks` und `responsibility_handovers` umgesetzt; keine parallelen Mitarbeiter-, Aufgaben- oder Authmodelle.
- Gate-Evidence: Vitest 35/35 Dateien und 230/230 Tests grün; `tsc -p .` und finaler `next build` Exit 0; `git diff --check` Exit 0. Details und manuelle Verifikation: `docs/agents/reports/2026-08-31-c-c.md`.
- Playwright ist nicht grün belegt: ohne `E2E_AUTH_STATE` überspringt die packet-eigene Spec ihre vier authentifizierten Abläufe; der letzte Gesamtlauf endete nach lokalem Server-Reset mit 6 bestandenen, 4 übersprungenen und 22 Verbindungsfehlern.
- Migration/Rollback/RLS-Sicherheitsprüfung: `supabase/migrations/20260831120000_recurring_tasks_and_handover_ack.sql` und `supabase/migrations/20260831120100_recurring_tasks_escalation_enum_fix.sql` bestehen den Produktionsschema-Dry-Run; `scripts/tests/077_recurring_tasks_handovers.sql` verwendet ausschließlich zurückgerollte eigene Fixtures und lief in Fix-Runde 4 gegen den restaurierten Produktionsschema-Snapshot mit Exit 0.

# Vollausbau 2026-08-31 — was war da / was geändert / DB-Änderungen / was getestet / offen

- **Was war da:** Neo nutzte bereits dieselbe Supabase-Identität, Tenants, Standorte, Mitarbeiter, Aufgaben, Schichten, Lager- und Betriebsdaten. Teilfunktionen waren versteckt, unvollständig verbunden oder technisch dargestellt.
- **Was geändert:** Sechs PASS-WITH-MINORS-Pakete integriert; alle 15 letzten MINORs geschlossen. Bewerbungstests/Onboarding, Organigramm/Avatare, wiederkehrende Aufgaben/Übergaben, Dienstplan-Loop, Lagerplan/QR und visueller Ablaufeditor bilden einen erreichbaren A–Z-Prozess. Konflikte wurden funktionsbewahrend kombiniert.
- **DB-Änderungen:** acht additive, transaktionale Migrationen seit `87320087`; geordnete Liste, Objekte und Rollback in `docs/agents/deploy/2026-08-31-migrations.md`. Gemeinsamer Produktionsschema-Snapshot-Dry-Run: 243 Tabellen, Restore 0 Fehler, 8/8 `OK`.
- **Was getestet:** Typecheck nach jedem der sechs Merges; Fokus 57/57 Tests; final Vitest 42 Dateien/271 Tests, Typecheck Exit 0, Next Build Exit 0 mit 242/242 statischen Seiten, `git diff --check` Exit 0. Playwright ohne Live-DB Desktop/Mobile 32 bestanden, 8 authentifizierte Fälle übersprungen. Details: `docs/agents/reports/2026-08-31-c-int.md`.
- **Offen:** kein Deploy/keine Produktionsänderung. Vor Deployment Staging-Migration, authentifizierte Persona-E2E mit `E2E_AUTH_STATE`, Delivery-Health gegen Live-DB und echte E-Mail-/Worker-Zustellung. Owner-Testplan: `docs/agents/reports/2026-08-31-persona-e2e.md`.

# Vollausbau Final Review — Fix round 1

- Claude-NO-GO M1–M4 und alle sicher behebbaren MINORs sind in `20260831160000_vollausbau_review_corrections.sql`, TypeScript, Tests und dem Deploy-Runbook geschlossen. Die reviewte Migration `20260831100944` blieb unverändert.
- Produktions-Preconditions: verifiziertes Backup vor Datei 1; die beiden Scope-Abfragen im Runbook müssen auf Produktion vor Datei 8 null Zeilen liefern. Kein Deploy und keine Produktionsmutation in dieser Runde.
- Evidence: Vitest 42/42 Dateien und 276/276 Tests; TypeScript Exit 0; Next Build Exit 0 und 242/242 Seiten; August-31-Migrationssatz 9/9 OK; `git diff --check` Exit 0. Der exakt angeforderte Glob `2026083*.sql` bleibt wegen des vorbestehenden Snapshot-Konflikts von `20260830154500_daily_clarity_automation.sql` Exit 1; alle Fix-Round-Migrationen darin sind OK. Details: `docs/agents/reports/2026-08-31-c-int.md`.
- Rollback: RPC-/Triggerdefinitionen aus dem unmittelbar vor Datei 9 gesicherten Schema wiederherstellen; Datenkorrekturen aus Datei 1 nur aus dem verpflichtenden Pre-Deploy-Backup. Reviewer-Freigabe ist vor Deployment weiterhin erforderlich.

## Production deployment — Vollausbau 2026-08-31

- Result: **deployed to production**. The approved source candidate is
  `a69bf7d0b8956cb75e44726e31ce3dbd53aec8ab`; production serves it from
  `mise_backoffice_3310`, container
  `5c338387d791ffff345b2413168459a1316347975c3c560730bc7339216f4836`,
  immutable image
  `22ccae64d4d10a5b781f672875455dee06078ddf111353faad770fd484292c87`.
  Final verification at `2026-08-31T22:52:43Z` found `running|0`, start time
  `2026-08-31T20:29:31.502665463Z`, public `/login` `200`, and no error matches
  in the preceding five minutes of container logs. Production had therefore
  remained stable for more than two hours before final handoff.
- Release guards passed. The local `vollausbau/integration` worktree was clean
  at `a69bf7d`; `87320087` was an ancestor. Production started at exact
  `873200876190c90833174ecde8e33764b4f47b34` with only generated
  `app/fahrer/build-version.ts` modified. Disk was 75 GB total, 62 GB used,
  11 GB available (86%), above the 8 GB stop threshold. The live pre-deploy
  container was `mise_backoffice_3300` on immutable image
  `2d29e61bfdda98fb82570361da139a3945c864fe4e37a6740f28d2d27be18085`;
  it was `running|1`. The fixed `/opt/mise/auto-deploy.sh` was mode `0755`,
  root-owned, passed `bash -n`, retained SHA-256
  `e8ca14dfcf64c762bf632e5fa571b2c121f9d376fe78e4eac12954e5ddd4caf9`,
  and its rollback-preservation dry-run passed.
- Transport followed the supplied `px`/`pscp` helpers exclusively. The first
  read-only `px` preflight was locally denied access to the existing control
  socket; after the mandated 60-second wait, the single retry connected and no
  production command had run before it. A later client connection ended with
  SSH exit `255` during rollback-artifact recovery; after the mandated wait,
  the single reconnect succeeded and showed that the remote guarded command
  had completed. No production command used a separately created SSH control
  master.
- Git bundle evidence: Git rejected a raw-SHA-only positive revision as an
  empty advertised bundle, so the same 63-commit range was created from the
  verified `vollausbau/integration` ref, which pointed exactly at `a69bf7d`,
  excluding `87320087`. `/tmp/vollausbau-a69bf7d.bundle` was 499,385 bytes,
  required `873200876190c90833174ecde8e33764b4f47b34`, advertised
  `a69bf7d0b8956cb75e44726e31ce3dbd53aec8ab`, passed `git bundle verify`
  locally and on production, and had SHA-256
  `be7bc9a8a28f07011950a9c8ffe6b48f210e3f28b7a165e5512dde689b60a3c5`.
  Production fetched only that bundle and fast-forwarded at
  `2026-08-31T20:12:35Z`; no GitHub fetch, rebase, or non-fast-forward merge was
  used. Production source ended at exact `a69bf7d` with only the generated
  build-version file modified.
- The required full pre-migration restore point is
  `/opt/mise/backups/vollausbau-pre-20260831T201020Z.dump`, mode `0600`,
  root-owned, 9,097,310 bytes, SHA-256
  `bb26e52278c491f7e5611ecf2e6d3bc524077b053958dbc98911ea27200b3a67`.
  `pg_restore --list` returned 4,200 entries. Immediately before migration 9,
  a separate schema-only restore point was created at
  `/opt/mise/backups/vollausbau-pre-review-corrections-20260831T201326Z.dump`,
  mode `0600`, root-owned, 2,253,286 bytes, SHA-256
  `6068a64c05ae8cc94f6549571f9d484fe50b82b9a5e4d0b62facac1bc36e91ae`,
  with 4,112 restore-list entries. Both were re-hashed during final verification.
- The literal pre-deploy scope query in
  `docs/agents/deploy/2026-08-31-migrations.md` initially stopped read-only with
  `function min(uuid) does not exist`; it did not mutate the database. The
  operator reran the semantically identical UUID-safe fallback actually used by
  migration 8, `(array_agg(id))[1]`, query SHA-256
  `51755c5fbac17db0fd24a8ea2f588dff5df1bba4f12963288fc57590d77fab52`.
  Both required result sets were empty: `shift_guides` `(0 rows)` and
  `checkup_templates` `(0 rows)`. The runbook expression should be corrected
  before it is reused; production scope itself passed.
- All nine migrations applied with `ON_ERROR_STOP=1`, one explicit transaction
  per file, in the documented order between `20:13:21Z` and `20:13:29Z`:

  ```text
  bed3f64738c9f823a1c5056e07c501fb90f81af7d0cb1c953657db3261fe648c  20260831100944_application_assessments_training_onboarding.sql
  20cf9b495cc441853f616eee0d7d1a7013699b2b3380e67f7e42d6c2172800be  20260831115000_employee_avatars.sql
  f683f7728bd86850668393ac71c4f48d048b012c39e44bb7e1d05edc351449e1  20260831120000_recurring_tasks_and_handover_ack.sql
  715a1504d630a553784ec63cd69d6eb214efdc34d2da576e420c3f1435f2d231  20260831120100_recurring_tasks_escalation_enum_fix.sql
  1e607425badfd7be98c4aa4aaa2b1faf26153e5350535f9be0695ca5fbfa7aec  20260831130000_schedule_planning_loop.sql
  ee3d89a19485a35803ba69e20d7714e7388e14f9c8b285f6b5c4b4d579a00685  20260831140000_inventory_warehouse_plan.sql
  3ff5d7cfefd2796c568c016a5b7f82f7441ab781e4afa5a84537c844225c2d5c  20260831140100_inventory_warehouse_plan_review_fixes.sql
  b113af657fd7159ebf3f394dc5c6ff7889f0d807def22ab2480d4b7723ebd5f1  20260831150000_visual_shift_guide_editor.sql
  b9578038bb452fd1502292303888d51f373702c13f01f85c75e68bfed3888704  20260831160000_vollausbau_review_corrections.sql
  ```

  Migration 1 reported zero removed training duplicates. Migration 8 updated
  four legacy guides and two templates; its ambiguity guards passed. All nine
  transactions printed `COMMIT`. No application switch occurred until the
  entire set and post-migration assertions had passed.
- Final post-migration assertion script SHA-256 was
  `e9b267353aa33fd87910df90f5210ca85dbedc63178422588884fd22d08d2613`.
  It verified all required tables, columns, functions, the public `avatars`
  bucket contract, the training-progress unique key, and `pgcrypto` in schema
  `extensions`. All four `shift_guides` and both `checkup_templates` rows had
  non-null tenant/location scope. The eight expected scoped policies existed,
  and these eight expected triggers were enabled with `tgenabled='O'`:
  `operational_tasks_escalation_notify`,
  `inventory_shelves_validate_hierarchy`,
  `shifts_published_schedule_change`, `schedule_templates_audit`,
  `schedule_template_slots_audit`, `schedule_weeks_audit`,
  `shift_availability_responses_audit`, and
  `schedule_publication_changes_audit`. Earlier read-only verifier drafts used
  an incorrect legacy column name and bucket ID; they stopped without mutation
  before the corrected assertion set passed.
- `/opt/mise/auto-deploy.sh` built candidate image
  `22ccae64d4d10a5b781f672875455dee06078ddf111353faad770fd484292c87`.
  Candidate container
  `5c338387d791ffff345b2413168459a1316347975c3c560730bc7339216f4836`
  passed inactive-port 3310 health after two seconds with HTTP `307` and
  `running|0`. The script tagged old image `2d29e61b...18085` as
  `mise-backoffice:previous` before nginx switched at `20:29:34Z`, then
  re-verified that exact tag after its own cleanup. The deploy completed at
  `20:29:37Z`; independent local `/login` returned `200`, `current` pointed to
  `22ccae64...92c87`, and disk still had 11 GB available.
- Public unauthenticated smoke passed twice, initially at `20:30:46Z` and in
  the final pass at `22:52:43Z`: `/login` returned `200`;
  `/api/cron/operational-escalations` returned `401`; `/neo/app/tests`,
  `/neo/app/lager/plan`, `/neo/app/ablaeufe/aufgaben`,
  `/neo/app/dienstplan`, `/neo/app/schulungen`, and `/neo/app/mitarbeiter`
  each returned `307` to `/login?next=...`, never `500`. Candidate startup logs
  contained only the normal Next.js ready sequence, and the final five-minute
  log window was empty with zero error-pattern matches.

### Vollausbau rollback artifact recovery and final rollback recipe

- An external cleanup race was observed after the successful script-level
  preservation check: at `20:30:46Z`, about one minute after the switch, the
  required `mise-backoffice:previous` tag and immutable old image
  `2d29e61b...18085` were both gone. The candidate remained healthy. A separate
  scheduled `/opt/mise/storefront-auto-deploy.sh` process was observed starting
  at the same `20:30` boundary, but causality was not proven. The original old
  binary image could not be recovered and this fact must not be hidden.
- Rollback safety was rebuilt without changing live traffic. A detached remote
  worktree at exact source `873200876190c90833174ecde8e33764b4f47b34`
  produced a replacement `mise-backoffice:previous` image with immutable ID
  `0365022eed3f636c8f784613c37104964a9ef842c20eb72de42846d33e488faf`,
  size 257,904,911 bytes, label
  `com.mise.rollback-source=873200876190c90833174ecde8e33764b4f47b34`.
  This is a source-equivalent rebuild of the immediately preceding release, not
  the deleted original binary. At `22:53:56Z` it was started independently on
  inactive port 3300, returned `/login` `200`, and reported `running|0`; it was
  then cleanly stopped with exit code 0 while public candidate `/login`
  remained `200`.
- The stopped prune guard is container
  `mise_backoffice_rollback_guard`, immutable container ID
  `6c0011d2c6dc83ac00d5375e3ab0279e243ff5199f4df2986c134a69d0120c65`.
  It references exact rollback image `0365022e...8faf`, uses host networking,
  the production env files, read-only `/opt/mise/secrets`, `PORT=3300`,
  `HOSTNAME=0.0.0.0`, and restart policy `unless-stopped`. Its stopped state
  protects the rollback image from ordinary unused-image pruning.
- A second recovery copy is
  `/opt/mise/backups/mise-backoffice-rollback-87320087-20260831T204753Z.tar`,
  mode `0600`, root-owned, 265,664,000 bytes. `tar -tf` passed and SHA-256 is
  `58d37bfdaa044478aef6f3f14a0d1bd6bedff56bc09f232addec015d76969cc6`.
  Final image inventory contained only `current` on `22ccae64...92c87` and
  `previous` on `0365022e...8faf`; final disk was 75 GB total, 61 GB used,
  12 GB available (84%).
- For an authorized **application-only rollback**, first verify
  `mise-backoffice:previous` resolves exactly to `0365022e...8faf` and that the
  guard references the same ID. If the tag/image is absent, load the verified
  archive and re-check the immutable ID. With candidate traffic still on 3310
  and port 3300 free, rename the stopped guard to `mise_backoffice_3300`, start
  it, and require local `/login` `200`, state `running`, and restart count zero.
  Only then point `/etc/nginx/conf.d/mise-upstream.conf` to `127.0.0.1:3300`,
  pass `nginx -t`, reload nginx, and write `3300` to
  `/opt/mise/.mise_active_port`. Re-run the full public smoke matrix before
  stopping or removing candidate container `mise_backoffice_3310`.
- The nine Vollausbau migrations are left in place for an application rollback;
  do not restore either database dump, drop objects, or reverse the
  `training_progress` deduplication automatically. Use the full pre-migration
  dump only for a separately authorized data recovery, and the pre-file-9
  schema dump only for the migration-9 RPC/trigger rollback described in
  `docs/agents/deploy/2026-08-31-migrations.md`. The cross-deployment image
  cleanup race remains an operational follow-up: future backoffice deploys
  should create a stopped guard and/or verified archive before any unrelated
  host build can prune the newly preserved previous image.
- Per the deployment packet, no local build or test command was run during this
  production operation. Durable acceptance evidence consists of the approved
  pre-deploy gates, production migration assertions, inactive-port health,
  public smoke, container/log checks, backup validation, and rollback
  re-health/archive verification above.
