# Autonomous test-lab status

Updated: 2026-08-01

| Gate | Current decision | Evidence / blocker |
|---|---|---|
| TL-G0 Isolation | GREEN | Central guard received two independent P0 approvals at `8dd1eb2e`; atomic run+tenant cleanup received two independent approvals at `003b2c53`. Disposable PostgreSQL integration passes. |
| TL-G1 Data Factory / DSL | PARTIAL | All 65 profiles persist in run-owned PostgreSQL; 115 descriptors have deterministic fail-closed registry bindings. They remain explicitly `audit-only`, so canonical storefront/API/UI execution is open. |
| TL-G2 UI actors | BLOCKED | Click harness and role flows exist; Playwright browser, selectors/auth fixtures and real browser E2E are not installed/proven. |
| TL-G3 Invariant monitor | PARTIAL / REVIEW REJECT | Post-review hardening adds cross-tenant route/pick, batch-driver, stop-order, numeric, sequence, fingerprint and temporal push checks; focused tests pass, but canonical DB-snapshot integration and re-review are open. |
| TL-G4 Dispatch oracle | PARTIAL | Independent core plus a normalized production-decision comparison seam now report hard violations and objective gaps; real production capture, route-sequence comparison and representative production model remain open. |
| TL-G5 Functional catalog | PARTIAL | 100+ named categories/cases are catalogued; they are not all executable E2E scenarios yet. |
| TL-G6 Race/chaos/recovery | PARTIAL | Deterministic seeded/virtual-time fault controller and five focused cases pass; true database sessions, killed workers and restart integration remain open. |
| TL-G7 Push/GPS/native | BLOCKED_EXTERNAL | Local contracts exist; real devices/background/locked/terminated evidence is unavailable. |
| TL-G8 Continuous operation | PARTIAL | Guarded CLI, report formats and preview dashboard exist; CI/nightly/soak and authenticated pause/abort are open. |
| TL-G9 Independent review | BLOCKED | Review structure exists; required double sign-offs and final judge are not complete. |
| TL-G10 Human acceptance | BLOCKED_EXTERNAL | Runbook exists; employees/devices/sign-offs not executed. |

Current release decision: `BLOCKED` (confirmed independently). No production action occurred.

First incomplete gate: **TL-G1 Data Factory / Scenario DSL**. The minimal
run-owned factory is real, but the 115 catalog descriptors are not yet bound to
canonical Storefront/Kitchen/Driver/Dispatcher API/UI execution.

Build status: GREEN on a clean retry (`npm run build`, 447 pages). The generated
`.next` directory was removed afterward to recover local disk capacity.
