# G7 Evidence — Routing, Batching and Kitchen Hold

Date: 2026-07-28
Status: **GREEN (isolated local evidence)**
Confidence: **HIGH for source and PostgreSQL invariants**

| Requirement | Implementation evidence | Files | Test command / working directory | Exit | Result | Commit | Known limitation |
|---|---|---|---|---:|---|---|---|
| Atomic competing route append | Single RPC locks writer, driver, batch and order; true-overlap barrier is session-local | `scripts/migrations/282_routing_batching_kitchen_hold.sql`, `scripts/tests/run-282-route-append-race.sh` | Full T08 runner, `/Users/eule/mise-driver-remediation` | 0 twice | PASS | `5fa6b6f3` | Disposable PostgreSQL, not production |
| Idempotency and no partial loser | Exact replay returns stored result; changed fingerprint rejected; all projections counted | SQL migration/tests | Full T08 runner | 0 twice | PASS | `5fa6b6f3` | None for tested DB contract |
| Real Frank integration | Snapshot, fresh GPS, capacity/store/deadline checks, road/fallback insertion, bounded CAS retry, RPC-only write | `lib/frank.ts`, `lib/delivery/t08-frank-route.ts`, `lib/delivery/atomic-offer.ts` | focused `tsc`; full T07 runner | 0 | PASS | `570d953e`, `c02e15e0` | Live route provider deferred to isolated staging |
| Shadow write freedom | Orchestrator makes append unreachable; before/after business snapshot unchanged | `lib/delivery/route-append-dispatch.ts`, `scripts/tests/t08-route-append-dispatch.test.ts` | Full T08 runner | 0 twice | PASS | `570d953e` | Shadow decision audit is intentionally the only write |
| Persistent kitchen hold | Versioned hold, 15-minute cap, stable calculation, CAS cancel/release, locked watchdog, transactional audit/outbox | migration, `lib/delivery/kitchen-hold-worker.ts`, internal dispatch tick route | Full T08 runner | 0 twice | PASS | `570d953e` | Scheduler activation remains default-off |
| Deterministic replay | Ten scenario dataset covers distances, vehicles, route, delay, stale GPS, matrix failure, deadline, stores, failure and restart | `scripts/tests/fixtures/t08_dispatch_replay.json`, replay test | Full T08 runner | 0 twice | PASS | `c02e15e0` | Synthetic isolated data |
| No regression of canonical writer | Retained baseline plus 100 true-overlap writer races | `scripts/tests/run-t07-deterministic-dispatch.sh` | wrapped disposable PostgreSQL runner | 0 | PASS | current tree | No production activation |

## Gate decision

G7 is GREEN for the required isolated source, deterministic replay and
PostgreSQL invariants. This does not authorize production activation and does
not pre-approve the T10 live-provider, load, mobile or rollout gates.
