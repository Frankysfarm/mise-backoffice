# Autonomous test-lab status

Updated: 2026-08-01

| Gate | Current decision | Evidence / blocker |
|---|---|---|
| TL-G0 Isolation | PARTIAL / REVIEW REJECT | Central fail-closed guard and 11 positive/negative tests pass and now protect CLI, page and API; DB mutation/cleanup isolation and independent re-review are not proven. |
| TL-G1 Data Factory / DSL | PARTIAL | DSL validation, deterministic catalog and synthetic actor profiles exist; database-backed per-run factory/cleanup is not yet proven. |
| TL-G2 UI actors | BLOCKED | Click harness and role flows exist; Playwright browser, selectors/auth fixtures and real browser E2E are not installed/proven. |
| TL-G3 Invariant monitor | GREEN locally | Fail-fast structured evidence, run binding, order/assignment/driver/route/pick/push/audit checks; 10 focused cases pass. Independent gate review remains under TL-G9. |
| TL-G4 Dispatch oracle | PARTIAL / REVIEW REJECT | Independent small-N oracle core and 500 seeds pass; no production-vs-oracle adapter, representative production model or stored optimality gaps. |
| TL-G5 Functional catalog | PARTIAL | 100+ named categories/cases are catalogued; they are not all executable E2E scenarios yet. |
| TL-G6 Race/chaos/recovery | PARTIAL | Deterministic seeded/virtual-time fault controller and five focused cases pass; true database sessions, killed workers and restart integration remain open. |
| TL-G7 Push/GPS/native | BLOCKED_EXTERNAL | Local contracts exist; real devices/background/locked/terminated evidence is unavailable. |
| TL-G8 Continuous operation | PARTIAL | Guarded CLI, report formats and preview dashboard exist; CI/nightly/soak and authenticated pause/abort are open. |
| TL-G9 Independent review | BLOCKED | Review structure exists; required double sign-offs and final judge are not complete. |
| TL-G10 Human acceptance | BLOCKED_EXTERNAL | Runbook exists; employees/devices/sign-offs not executed. |

Current release decision: `BLOCKED` (confirmed independently). No production action occurred.

Build status: GREEN on a clean retry (`npm run build`, 447 pages). The generated
`.next` directory was removed afterward to recover local disk capacity.
