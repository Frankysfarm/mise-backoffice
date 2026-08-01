# Autonomous test evidence

## TL-G0 environment isolation

- Requirement: abort before first mutation for any non-isolated environment.
- Scenario: `security-production-url-denied` and guard negative matrix.
- Seed: 42.
- Test run: `tl_20260801t160000z_a1b2c3d4` (first aggregate discovery run).
- Implementation: `tests/driver-system-lab/support/environment.ts` and provider sinks.
- Command/workdir: `npm run test:lab:guard` in `/Users/eule/mise-driver-remediation`.
- Exit: 0; 10/10 pass.
- Evidence: console TAP; aggregate report directory under `artifacts/driver-system-lab/`.
- Limitation: database mutation/cleanup integration is not yet executed.
- Reviewer: lead implementation; independent security sign-off pending.
- Gate: locally green implementation, review pending under TL-G9.

## TL-G4 independent oracle

- Requirement: independent enumeration, hard constraints, deterministic tie-break and property evidence.
- Scenario: oracle unit/metamorphic/property suite.
- Seed range: 1–500.
- Implementation/commit: `8a96ace5`.
- Command: `./node_modules/.bin/tsx --test tests/driver-system-lab/oracle/dispatch-oracle.test.ts`.
- Exit: 0; 11/11 pass including 500 seeds.
- Limitation: production-decision adapter and recorded optimality gaps are open.
- Reviewer: independent OR implementation agent; separate gate reviewer pending.
- Gate: local oracle green; system comparison partial.

## Build

- Command/workdir: `npm run build` in `/Users/eule/mise-driver-remediation`.
- Result: exit 0; Next 14.2.35 compiled successfully and generated 447 pages.
- Test-lab routes: `/test-lab` and `/api/test-lab/scenarios` compiled; both hard-hide in production by contract.
- Known limitation: repository Next configuration explicitly skips lint and type validation during build; focused strict test-lab TypeScript separately exited 0.

## Existing driver-system regression

- Command/workdir: `scripts/tests/run-t10-local-release-readiness.sh` in the repository root.
- Exit: 0.
- Result: all isolated PostgreSQL/source suites passed, including 100 overlapping atomic-writer races, driver API/RLS, pick/pickup, recovery/push/offline, GPS, deterministic dispatch, routing/hold, operations/security, migrations 285–288, route-before-depart, multi-order cancel/arrival, explicit append consent and UI/push contracts.
- Limitation: local disposable PostgreSQL/source evidence only; no hosted or physical-device inference.

## Post-review harness regression

- Run: `tl_20260801t183000z_e1f2a3b4`, seed 42.
- Command: `npm run test:lab:full` with the documented isolated environment.
- Exit/result: 0; 49/49 tests pass.
- Changes verified: all surfaces call the central guard, suite-specific discovery is active, and reports list selected test files rather than an empty timeline.
- Review status: fixes occurred after frozen review commit `8934b878`; re-review is pending.

## Adversarial P0 hardening

- Run: `tl_20260801t190000z_f1a2b3c4`, seed 42.
- Command/result: `npm run test:lab:full`, exit 0, 59/59.
- Isolation: production Supabase/backend URLs and real APNs/email credentials now fail closed; guard matrix is 15/15.
- Invariants: cross-tenant route plans/picks, batch-driver mismatch, stop-order mismatch, invalid counters/sequences, stale fingerprints and provider-send-after-terminal ordering are checked.
- Healthcheck negative control: run `tl_20260801t190100z_deadbeef` against PostgreSQL port 1 exited 1 and wrote a failed report; `lab:up` no longer claims success for an unreachable service.
- Limitation: these post-review fixes need independent re-review; integrated DB/process chaos remains absent.

## Final local hardening run

- Run: `tl_20260801t194000z_ace0face`, seed 42.
- Full suite: 61/61 pass, exit 0.
- Environment matrix: 17/17, including unqualified `NODE_ENV=production` rejection and explicitly marked staging allowance.
- DB healthcheck: now executes `SELECT current_database()` through `psql` and verifies exact identity; unreachable negative run `tl_20260801t193000z_badc0ffe` exits 1.
- Build: clean `npm run build` on the latest working tree exits 0 and generates 447 pages; `.next` was removed afterward for disk safety.

## PostgreSQL run-owned data factory

- Command: `scripts/tests/with-local-remediation-postgres.sh node --import tsx --test tests/driver-system-lab/fixtures/postgres-factory.test.ts`.
- Exit/result: 0; 1/1 integration test passes against a fresh disposable PostgreSQL cluster.
- Proof: creates a dedicated run schema, inserts run/tenant-marked synthetic actors/order, rejects cleanup for another run, cleans the exact owned schema and verifies zero remaining namespace rows.
- Limitation: minimal factory only; canonical application APIs/tables and full profile set are not yet exercised.
- Hardening/review: commit `003b2c53` checks run and tenant atomically in the drop transaction, revalidates inputs at runtime, serializes compliant cleanup and proves a second run survives. Two independent reviewers approved this TL-G0 subgate.
