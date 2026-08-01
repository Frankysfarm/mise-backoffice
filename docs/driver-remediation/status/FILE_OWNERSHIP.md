# Critical File Ownership

Updated: 2026-08-01

| File/scope | Active task | Owner | Mode | Notes |
|---|---|---|---|---|
| `lib/frank.ts` | none | released after T08 | protected | T07 baseline plus default-off T08 route insertion are frozen after G7. |
| T08 routing/batching/hold modules, migration and tests | none | released after T08 | protected | Atomic append, shadow and persistent hold evidence frozen after G7. |
| `lib/delivery/dispatch-engine.ts` | none | released by T07 | protected | Deterministic scoring/reason contract frozen after G6. |
| canonical lifecycle/state-machine modules | none | released after continuation regression | protected | T01 compatibility evidence was refreshed for the T03 boundary; transition semantics remain frozen. |
| dispatch/assignment migrations and RPCs | none | released by T02 | protected | T02 Atomic-v2 migrations/RPCs frozen after G2 approval. |
| `lib/delivery/recovery.ts` | none | released by T05 | protected | Ownership-preserving recovery contract frozen after G4. |
| `app/api/cron/smart-dispatch/route.ts` and `app/api/delivery/tours/[id]/status/route.ts` recovery callsites | none | released by T05 | protected | Recovery failures must remain visible; dispatch/status business logic is frozen. |
| `app/fahrer/app/client.tsx` | none | released by T04/T05 | protected | Atomic pickup and canonical offline/snapshot reconciliation frozen after G4. |
| `app/api/driver/v1/**` lifecycle boundary | none | released by T03 | protected | v1 adapters constrained; future changes require exclusive ownership. |
| `app/api/driver/v2/**` and `lib/delivery/driver-v2-*` | none | released by T03 | protected | Canonical action/snapshot boundary frozen after G3. |
| migration `279_*`, pick/item APIs/tests | none | released by T04 | protected | Atomic multi-order pickup contract frozen after G4. |
| migration `280_*`, GPS API/transport/native files | none | released after T06 continuation | protected | Local source/DB candidate complete; G5 remains BLOCKED_EXTERNAL for compiled/device evidence. |
| migration `281_*`, recovery/outbox/push tests | none | released by T05 | protected | Push is wake-up only; assignment authority unchanged. |
| T09 observability/security modules, tests and runbooks | none | released after T09 | protected | Redaction, alerts, durable authority and runbooks frozen after G8. |
| migration `283_*`, operations APIs/monitor/tests | none | released after T09 | protected | Durable default-off operations/security authority frozen after G8. |
| T10 aggregate runner and release/runbook evidence | none | released after T10 local work | protected | G9 remains externally blocked; no production authorization. |
| `package.json`, `next.config.js`, ESLint config | none | released by T00 | protected | Tool configuration complete. |
| native verification scripts in `/Users/eule/mise-driver-native-t00` | none | released by T00 | protected | Native T00 commit `0ec66de`; no app logic changed. |
| `docs/driver-remediation/status/*` | program | lead orchestrator | exclusive | Baseline, status, gates and command evidence. |
| final-completion schema/preflight, migrations `285_*` onward and their tests | final completion | lead orchestrator | exclusive | Masterauftrag 2026-08-01; local/disposable databases only, no production mutation. |
| final-completion routing/lifecycle/UI cleanup | final completion | lead orchestrator | exclusive | Existing dirty edits are preserved and audited before consolidation; no parallel writer may edit these scopes. |
| `scripts/tests/285_*`, `scripts/tests/run-285-*`, schema-preflight helpers | final completion | push_offline_audit | exclusive | Migration 285 behavior/race evidence only; migration SQL itself remains lead-owned. |
| route-before-depart successor migration and its dedicated SQL runners | final completion | pickup_routing_audit | exclusive | New files only; do not edit migrations 276-285 or shared runners. |
| reachable driver UI import/render cleanup and dedicated UI contract test | final completion | navigation_ui_audit | exclusive | May edit `app/fahrer/app/client.tsx` plus new dedicated test only; preserve canonical DeliveryView behavior. |
| adaptive deterministic optimizer successor module/spec/tests | final completion | push_offline_audit | exclusive | New optimizer files only; no edits to `lib/frank.ts` or frozen T07 files until lead review. |
| multi-order cancel and arrival-sequence successor migration/tests | final completion | pickup_routing_audit | exclusive | New migration/test files after 286 only; no edits to existing migrations or shared API modules. |
| push service-worker ACK/dedupe contract and tests | final completion | navigation_ui_audit | exclusive | New helper/test files and existing service-worker/push-register files only; no lifecycle UI edits. |
| mid-tour proposed-append consent successor migration/tests | final completion | pickup_routing_audit | exclusive | New post-287 SQL/test files only; T08 append remains unchanged and callable only through accepted proposal handoff. |
| `tests/driver-system-lab/support/**`, `tests/driver-system-lab/providers/**`, environment-guard tests | autonomous test lab | lead orchestrator | exclusive | TL-G0 isolation, run identity, provider sinks and safe cleanup; production is fail-closed. |
| `tests/driver-system-lab/oracle/**`, `tests/driver-system-lab/scenarios/dispatch/**`, oracle tests/docs | autonomous test lab | dispatch_oracle_lab | exclusive | Independent data model/cost function; must not import production optimizer scoring. |
| `tests/driver-system-lab/actors/**`, `tests/driver-system-lab/ui/**`, UI scenario fixtures | autonomous test lab | ui_actor_lab | exclusive | Synthetic actors and real-click browser harness; no business-state DB writer. |
| `tests/driver-system-lab/invariants/**`, `tests/driver-system-lab/chaos/**`, invariant/chaos tests/docs | autonomous test lab | invariant_chaos_lab | exclusive | Read-only invariant checks and deterministic test-only failpoints. |
| `tests/driver-system-lab/{cli,orchestrator,fixtures,scenarios,reports}/**`, lab package scripts, test-lab status/docs | autonomous test lab | lead orchestrator | exclusive | DSL, execution, evidence, dashboard/API safety, aggregate commands and gate decisions. |
| `app/test-lab/**`, `app/api/test-lab/**` | autonomous test lab | lead orchestrator | exclusive | Local/test/staging-only dashboard; hard 404 in production and no direct business writer. |

Ownership must be updated before another task edits a listed scope.
