# Autonomous test-lab status

Updated: 2026-08-02

| Gate | Current decision | Evidence / blocker |
|---|---|---|
| TL-G0 Isolation | GREEN | Central guard received two independent P0 approvals at `8dd1eb2e`; atomic run+tenant cleanup received two independent approvals at `003b2c53`. Disposable PostgreSQL integration passes. |
| TL-G1 Data Factory / DSL | PARTIAL | All 65 profiles persist in run-owned PostgreSQL; 115 descriptors have deterministic fail-closed registry bindings. They remain explicitly `audit-only`, so canonical storefront/API/UI execution is open. |
| TL-G2 UI actors | PARTIAL | Real Chromium clicks, screenshot and trace pass for the synthetic driver lifecycle and actual guarded Next dashboard. Real Storefront/Kitchen/Driver production UIs with auth fixtures remain open. |
| TL-G3 Invariant monitor | PARTIAL / REVIEW REJECT | Post-review hardening adds cross-tenant route/pick, batch-driver, stop-order, numeric, sequence, fingerprint and temporal push checks; focused tests pass, but canonical DB-snapshot integration and re-review are open. |
| TL-G4 Dispatch oracle | PARTIAL | A captured test invokes the real pure adaptive optimizer for bundle sizes 1–4 and compares through the independent oracle seam. Diverse captures and concrete production stop-sequence comparison remain open. |
| TL-G5 Functional catalog | PARTIAL | 100+ named categories/cases are catalogued; they are not all executable E2E scenarios yet. |
| TL-G6 Race/chaos/recovery | PARTIAL | Real disposable DB transaction abort, eight-session idempotent recovery and SIGKILLed psql worker rollback/replacement pass. Broader network/service-worker/restart matrix remains open. |
| TL-G7 Push/GPS/native | BLOCKED_EXTERNAL | Local contracts exist; real devices/background/locked/terminated evidence is unavailable. |
| TL-G8 Continuous operation | PARTIAL | Guarded CLI, reports, deterministic replay and 2,000-run bounded soak pass; dashboard preview works in real Chromium. CI scheduling, authenticated execution/pause/abort and long resource soak remain open. |
| TL-G9 Independent review | BLOCKED | Review structure exists; required double sign-offs and final judge are not complete. |
| TL-G10 Human acceptance | BLOCKED_EXTERNAL | Runbook exists; employees/devices/sign-offs not executed. |

Current release decision: `BLOCKED` (confirmed independently). No production action occurred.

First incomplete gate: **TL-G1 Data Factory / Scenario DSL**. The minimal
run-owned factory is real, but the 115 catalog descriptors are not yet bound to
canonical Storefront/Kitchen/Driver/Dispatcher API/UI execution.

Build status: GREEN on a clean retry (`npm run build`, 447 pages). The generated
`.next` directory was removed afterward to recover local disk capacity.
