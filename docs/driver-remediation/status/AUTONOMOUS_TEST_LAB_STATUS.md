# Autonomous test-lab status

Updated: 2026-08-04

| Gate | Current decision | Evidence / blocker |
|---|---|---|
| TL-G0 Isolation | GREEN | Central guard received two independent P0 approvals at `8dd1eb2e`; atomic run+tenant cleanup received two independent approvals at `003b2c53`. Disposable PostgreSQL integration passes. |
| TL-G1 Data Factory / DSL | GREEN | Two independent reviewers approve fixed commit `9b3e66bd`: strict DSL, seeded canonical fixtures, deep immutability/authentication, 65 configured roles, complete required provider/infrastructure variants and run-owned PostgreSQL materialization pass with no P0/P1. |
| TL-G2 UI actors | PARTIAL — browser actors + local canonical DB/auth recovery GREEN | The reproducible local UI orchestrator passes 12/12, including production Storefront, Kitchen, Driver Accept and the pruned production Dispatcher core. Unmocked Next/GoTrue/PostgREST/PostgreSQL links the terminal lifecycle with exact-once assignment/push. Sessions survive GoTrue and Next restarts; committed response loss replays idempotently, while a pre-commit PostgREST outage returns retryable 503 with zero writes and later commits once. Realtime and canonical replacements for disabled legacy controls remain open. |
| TL-G3 Invariant monitor | PARTIAL / REVIEW REJECT | Post-review hardening adds cross-tenant route/pick, batch-driver, stop-order, numeric, sequence, fingerprint and temporal push checks; focused tests pass, but canonical DB-snapshot integration and re-review are open. |
| TL-G4 Dispatch oracle | PARTIAL — runtime-shadow + real DB snapshot/readback GREEN | A default-off read-only shadow seam compares runtime-shaped captures and independently declared persisted assignments/exact stop sequences against the adaptive optimizer/oracle. Capacity and bundles 1–4 are decision inputs; readiness/route prefix are validated, while endangered/matrix values are capture-only. Real DB snapshot/readback wiring is now GREEN: a default-off, read-only, SELECT-only DB shadow loads actual persisted assignment/stop/driver/GPS rows from the live lifecycle PostgreSQL, rebuilds the runtime snapshot and fails closed on stop-sequence or assignment drift. The active Frank runtime still uses per-order deterministic dispatch; wiring the shadow into a production scheduler tick remains a reviewed product decision. |
| TL-G5 Functional catalog | PARTIAL | 100+ named categories/cases are catalogued; they are not all executable E2E scenarios yet. The Aachen shift simulation (`test:lab:shift:aachen`) now executes the core restaurant-operations scenario end-to-end: multi-customer HTTP orders, kitchen, dispatch, three tracked rider tours, second-wave reassignment and terminal delivery, 6/6 green. |
| TL-G6 Race/chaos/recovery | PARTIAL | Real disposable DB transaction abort, killed-client rollback, PostgREST/GoTrue/Next restart, committed-response loss and pre-commit Driver network outage/recovery pass. Two parallel authenticated requests through one Next process deduplicate to one write/replay; a stale version preserves fingerprints across assignment, driver, batch, order, stops, action/event registries and target-batch outbox. Realtime, service-worker, independent queue workers, terminal-state push-worker races and provider crash paths remain open. |
| TL-G7 Push/GPS/native | BLOCKED_EXTERNAL | Local contracts exist; real devices/background/locked/terminated evidence is unavailable. |
| TL-G8 Continuous operation | PARTIAL | Guarded CLI, reports, seed/suite rerun and 2,000-case bounded model repetition pass; dashboard preview works in real Chromium. Output-comparing replay, CI scheduling, authenticated execution/pause/abort and long resource soak remain open. |
| TL-G9 Independent review | BLOCKED | Review structure exists; required double sign-offs and final judge are not complete. |
| TL-G10 Human acceptance | BLOCKED_EXTERNAL | Runbook exists; employees/devices/sign-offs not executed. |

Current release decision: `BLOCKED` (confirmed independently). No production action occurred.

First incomplete gate: **TL-G2 UI Actor Automation**. The 115 catalog
descriptors still lack canonical Storefront/Kitchen/Driver/Dispatcher full-stack API/UI
execution under TL-G2/TL-G5.

Build status: GREEN on a clean retry (`npm run build`, 450 pages).
