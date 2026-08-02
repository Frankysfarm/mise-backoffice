# Autonomous test-lab status

Updated: 2026-08-02

| Gate | Current decision | Evidence / blocker |
|---|---|---|
| TL-G0 Isolation | GREEN | Central guard received two independent P0 approvals at `8dd1eb2e`; atomic run+tenant cleanup received two independent approvals at `003b2c53`. Disposable PostgreSQL integration passes. |
| TL-G1 Data Factory / DSL | GREEN | Two independent reviewers approve fixed commit `9b3e66bd`: strict DSL, seeded canonical fixtures, deep immutability/authentication, 65 configured roles, complete required provider/infrastructure variants and run-owned PostgreSQL materialization pass with no P0/P1. |
| TL-G2 UI actors | PARTIAL | Real Chromium clicks, screenshots and traces pass for the synthetic lifecycle, guarded dashboard, production BISS Storefront through retry/order success, production Kitchen through failed/zero-row/CAS retry, and production Driver through authenticated atomic Accept/version reload. Atomic Storefront DB creation passes locally. Dispatcher production-component execution and HTTP-to-DB full-stack lifecycle remain open. |
| TL-G3 Invariant monitor | PARTIAL / REVIEW REJECT | Post-review hardening adds cross-tenant route/pick, batch-driver, stop-order, numeric, sequence, fingerprint and temporal push checks; focused tests pass, but canonical DB-snapshot integration and re-review are open. |
| TL-G4 Dispatch oracle | PARTIAL | A captured test invokes the real pure adaptive optimizer for bundle sizes 1–4 and compares through the independent oracle seam. Diverse captures and concrete production stop-sequence comparison remain open. |
| TL-G5 Functional catalog | PARTIAL | 100+ named categories/cases are catalogued; they are not all executable E2E scenarios yet. |
| TL-G6 Race/chaos/recovery | PARTIAL | Real disposable DB transaction abort, eight-session idempotent recovery and SIGKILLed psql-client disconnect rollback/replacement pass. Canonical app-worker, network, service-worker and restart recovery remain open. |
| TL-G7 Push/GPS/native | BLOCKED_EXTERNAL | Local contracts exist; real devices/background/locked/terminated evidence is unavailable. |
| TL-G8 Continuous operation | PARTIAL | Guarded CLI, reports, seed/suite rerun and 2,000-case bounded model repetition pass; dashboard preview works in real Chromium. Output-comparing replay, CI scheduling, authenticated execution/pause/abort and long resource soak remain open. |
| TL-G9 Independent review | BLOCKED | Review structure exists; required double sign-offs and final judge are not complete. |
| TL-G10 Human acceptance | BLOCKED_EXTERNAL | Runbook exists; employees/devices/sign-offs not executed. |

Current release decision: `BLOCKED` (confirmed independently). No production action occurred.

First incomplete gate: **TL-G2 UI Actor Automation**. The 115 catalog
descriptors still lack canonical Storefront/Kitchen/Driver/Dispatcher full-stack API/UI
execution under TL-G2/TL-G5.

Build status: GREEN on a clean retry (`npm run build`, 450 pages).
