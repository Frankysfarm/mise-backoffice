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
- Extension: all 65 canonical profiles are materialized. Factory plus real simultaneous create/cleanup races pass 3/3; each race has exactly one winner and preserves a foreign run schema.

## Executable registry and comparison seam

- Registry: all 115 catalog descriptors are bound exactly once; 6/6 validation tests pass. Unknown/unbound IDs and substituted metadata fail closed. Every current handler is explicitly `audit-only`, and the CLI returns exit 2 rather than pretending an E2E pass.
- Oracle adapter: adapter plus oracle tests pass 17/17 including 500 seeds. Hard-constraint violations, exact match, tolerance and quality-gap verdicts are recorded without importing production scoring into the oracle.
- Limitations: a pure production-optimizer capture exists, but no real runtime-pipeline capture or concrete production route sequence is connected; catalog handlers do not yet drive application APIs/UI.
- Aggregate run `tl_20260801t220000z_abcdef12`: 73 pass, 3 correctly skipped DB-only tests, 0 failures. The three DB cases separately pass 3/3 in disposable PostgreSQL.
- Latest `npm run build`: exit 0, 447 pages.

## Browser, replay, soak and integrated recovery — 2026-08-02

- Synthetic Driver Chromium: 1/1 pass with real clicks from accept through pick, route, arrival and delivery. Evidence: `artifacts/driver-system-lab/browser/tl_20260802t000000z_11e594f4/`.
- Actual Next dashboard Chromium: 1/1 pass against guarded `http://localhost:3200/test-lab`; external origins are blocked. It filtered five smoke cases, entered seed 4242, toggled headed preview and verified all 115 API descriptors. Evidence: `artifacts/driver-system-lab/browser-app-local/`.
- First dashboard attempt exposed a local middleware redirect to the public domain and was failed; no mutation occurred. The test now blocks every non-local origin and uses the canonical localhost host. The potentially contaminated failed trace was removed.
- Soak run `tl_20260802t011000z_2233bbcc`: 2,000 independent in-memory single-order model deliveries / 12,000 timeline events, exit 0. It is bounded functional repetition, not a long-running resource soak. Seed/suite rerun `tl_20260802t012000z_3344ccdd` also exits 0, but does not yet compare source and replay outputs.
- Integrated disposable PostgreSQL: transaction-abort rollback plus eight parallel retries, and SIGKILLed `psql` client disconnect rollback plus a replacement raw-SQL write, 2/2 pass. This is not canonical application-worker restart recovery. Factory concurrency remains 3/3 pass.
- Captured pure production-optimizer comparison: combined adapter/oracle 18/18 pass including bundle sizes 1–4 and 500 Oracle-only seeds. It proves the comparison seam, not runtime-pipeline equivalence; the capture is limited to one driver, one store, four feasible orders and assignment membership without a concrete production stop sequence.
- Limitation: browser driver flow is explicitly a synthetic harness; actual Dashboard is production code, but Storefront/Kitchen/Driver application flows still require auth/test fixtures.
- Current aggregate console run `tl_20260802t030000z_f00dba11`: 74 pass, 8 intentional skips, 0 failures. Its retained report records overall status and test-file list, not the individual TAP counters. The five disposable-PostgreSQL cases separately pass 5/5.
- Current `npm run build`: exit 0 and 447/447 static pages generated. Webpack reported a non-fatal cache-write `ENOSPC` warning; compilation and page generation still completed.
- Current T10 isolated local release-readiness aggregate: exit 0 across all database, race, routing, push/offline, GPS, runtime-integrity and source-contract suites.
- Browser dependency hardening: Playwright 1.55.1 installed, matching Chromium build 1193 downloaded, and the real synthetic-driver Chromium flow reran 1/1 green. Production-dependency audit remains nonzero: two high Next/PostCSS groups and one moderate Anthropic SDK finding require breaking migrations.

## Complete DSL and deterministic fixture compiler — 2026-08-02

- DSL validation covers all master-contract domains and rejects root/nested unknown fields, production-like tenant identity, broken actor/store/vehicle/order references, unsafe cleanup and unordered faults before materialization.
- Canonical fixture compilation produces sorted actor/vehicle/driver/order rows, absolute timestamps, provider fixtures, a stable mixed action/fault timeline and SHA-256 digest. Same scenario/seed is byte-identical; seed/provider changes alter the digest.
- Initial focused DSL/compiler tests: 12/12 pass; after registry/digest hardening the focused set is 16/16. Focused TypeScript check and current smoke aggregate pass.
- Current full aggregate `tl_20260802t051000z_d51c0de2`: 83 pass, 8 intentional environment-only skips, 0 failures.
- Scope boundary: this proves TL-G1 data/DSL determinism, not the TL-G2/TL-G5 real UI/API execution of all 115 catalog cases.
- First independent TL-G1 reviews: both REJECT at `cbc27456`, no P0. They independently reproduced a `testlab-`/`testlab_` mismatch, identical digests after material semantic changes, arbitrary profile/provider/fault references, inert seed and a compiler disconnected from PostgreSQL.
- Post-review correction: DSL uses the central `testlab_` identity; actor profiles, actions, faults/targets, GPS/provider fixtures and expectation IDs bind to declared registries. Provider/GPS IDs resolve to concrete deterministic data. The digest now includes the complete validated source plus items, step arguments, expectations and cleanup; seed derives order idempotency keys.
- PostgreSQL factory now verifies tenant/seed, stores the exact scenario manifest/digest and materializes stores, scenario actors, vehicles, drivers with GPS paths, orders/items/times, timeline and providers in the run-owned schema. Canonical 65 actor rows now carry kind-specific capacity/GPS/prep/payment metadata. Disposable factory/concurrency rerun: 3/3 pass.
- Post-correction full aggregate `tl_20260802t060000z_d51c0de3`: 87 pass, 8 intentional environment-only skips, 0 failures.
- Second TL-G1 reviews still REJECTED `70c6f23b`, no P0: one reviewer proved post-compile mutation/stale digest could reach PostgreSQL; the other found behavior profiles too coarse and provider variants incomplete.
- Current correction detaches and deeply freezes compiler output, authenticates version/digest/complete canonical bytes again at the PostgreSQL boundary, and rejects forged content. Actor actions are kind-compatible. All 65 behavior profiles now carry defining configured state (capacity/load/GPS/tabs/cancel timing/prep/realtime/etc.). Registries cover successful/slow/partial/unavailable routing, reliable/lost/duplicate/delayed push, successful/duplicate/delayed payment, geocoding failure, realtime disconnect, clock skew, worker restart, DB timeout, disk, cache and backlog.
- TL-G2 preparation adds stable `data-testid` selectors without behavior changes to the real BISS Storefront item/cart/checkout flow, real Kitchen start/finish actions and real Driver offer acceptance.
- Current full aggregate `tl_20260802t070000z_d51c0de4`: 89 pass, 8 intentional environment-only skips, 0 failures. Disposable authenticated factory/concurrency remains 3/3 pass.
- Third independent TL-G1 review at `9b3e66bd`: both APPROVE, no P0/P1. Adversarial probes confirm post-compile mutation remains byte-stable and forged digest/row/version are rejected before schema mutation. Architecture probe confirms 65/65 unique semantic configurations and the complete required provider/infrastructure matrix.
- Post-selector production build: exit 0, 447/447 pages generated.

## Production Storefront browser actor — 2026-08-02

- Guarded actor route `/test-lab/actors/storefront` renders the actual production `BissStorefront` component and fails closed through the central environment guard outside an explicitly isolated lab. Middleware exposes only that exact path before the guard; production remains prohibited.
- Real Chromium clicks add item, open cart, checkout, fill customer data and submit. It asserts the exact intercepted synthetic order payload, reaches the real order-success UI, records no external origin or page error, and retains screenshot plus trace under `artifacts/driver-system-lab/storefront-component/`.
- The first adversarial component run exposed a malformed-ETA crash in `BissPhase2310LiveEtaTrackingHub`: an injected successful partial response produced an unknown load configuration. This does not prove the absent `/api/delivery/public/eta` route emits that response. The component now validates the complete response and safely falls back; the browser test deliberately supplies the partial response and asserts the fallback UI.
- Browser result: 1/1 pass. Full aggregate console run `tl_20260802t130000z_57f0a001`: 89 pass, 9 intentional opt-in skips, 0 failures. Its retained report/JUnit records selected files rather than TAP testcase counters and therefore is not standalone proof of those counters. T10 local PostgreSQL/race/release-readiness aggregate: exit 0.
- Clean production build after disk-cache recovery: exit 0, 448/448 pages generated. Separate repository-wide `tsc` with the default heap exhausted memory; the 8-GB retry remained non-terminating and was stopped, so it is not claimed as typecheck evidence.
- Scope boundary: this is the actual production Storefront component with a synthetic intercepted mutation, not the canonical database-backed order API. Kitchen, Driver and Dispatcher production-component actors remain the next TL-G2 work.

## Storefront review correction and Kitchen actor — 2026-08-02

- Independent reviews of frozen `51f7df7a` found no P0 but rejected the Storefront subgate for hostname-only HTTP allowance and incomplete WebSocket capture. The correction uses exact HTTP origins and a catch-all WebSocket handler with only the derived test-app WS origin and explicit local Supabase stub allowed. Active negative probes prove both `http://localhost:9` and `ws://localhost:9` are intercepted and recorded.
- ETA hardening now bounds integer ETA, active-driver and queue values, rechecks component liveness after JSON parsing and explicitly asserts the 25-minute fallback UI. P0 TypeScript configuration and the 17-case central guard suite pass.
- The guarded Kitchen actor renders the production `StationDisplay`. Real Chromium clicks start then finish, asserts the exact table/path/item filter and mutation bodies, injects a first 500 failure, proves the item remains with a visible error, retries successfully and only then reaches the empty-station UI. Screenshot/trace are retained under `artifacts/driver-system-lab/kitchen-component/`. Combined Storefront/Kitchen browser run: 2/2 pass; focused failure/retry rerun: 1/1 pass.
- The Kitchen correction follows an independent P1 rejection of optimistic removal after failed writes. `StationDisplay` now mutates local state only after a confirmed Supabase update and surfaces retryable failure state.
- A second independent review found the HTTP-200/zero-row and stale-tab gap. Kitchen transitions now CAS on exact item, station and prior status, require one returned row, and keep the item plus error UI for both a 500 response and a zero-row success before a confirmed retry.
- Review-board scope decision remains correct: TL-G2/TL-G5 stay PARTIAL. The Storefront browser POST is intercepted and proves no canonical API/DB persistence. The identified client-price P1 is corrected in source: the endpoint now loads available `menu_items` for the exact location, ignores client name/price and rejects missing, foreign, unavailable, duplicate or invalid-quantity lines. Pure boundary negatives pass 3/3; canonical API/DB transaction and exactly-once persistence remain mandatory before the full-stack Storefront gate can pass.
- Post-correction full aggregate `tl_20260802t150000z_57f0a004`: 92 pass, 10 intentional opt-in skips, 0 failures. The retained report limitation described above still applies.
- Production build at the catalog/Kitchen-error checkpoint: exit 0, 449/449 pages generated. The subsequent Kitchen CAS is covered by the P0 TypeScript configuration and focused browser rerun; another clean aggregate build remains queued with the next checkpoint.

## Atomic and idempotent Storefront persistence — 2026-08-02

- Migration 289 adds a service-role-only `fn_storefront_create_order_v1` boundary. It locks each UUID idempotency key, returns the prior result only for the same SHA-256 request fingerprint, rejects conflicting reuse and validates/locks active location plus available canonical menu rows in the same transaction that writes `customer_orders`, `order_items` and the request record.
- The public route no longer directly writes either order table. It validates UUIDs, bounded quantities/customer fields, explicit order/payment modes and delivery address, then calls only the atomic RPC. Client-provided names/prices never enter persistence.
- Disposable PostgreSQL behavior passes: canonical price calculation, foreign/unavailable rejection, same-key replay even after catalog availability changes, conflicting fingerprint rejection, service-role-only privilege, and injected item-write failure leaving neither orphan header nor request row.
- A real two-session race with the same key produces one fresh result, one replay, the same order ID and exactly one order/request. Storefront Chromium injects a first 503 and proves the retry reuses the same payload-bound UUID idempotency key before reaching success.
- Focused RPC/source/catalog contracts: 5/5 pass; P0 TypeScript configuration passes. Scope remains local: migration 289 was not applied to production, and a canonical HTTP→PostgREST→disposable-DB lifecycle still remains to close the full TL-G2/TL-G5 Storefront gate.
- First frozen review of `a0955836` rejected two P1s: middleware redirected the unauthenticated order POST, and location activation was checked without a row lock. The exact `/api/delivery/orders` path is now public while sibling delivery APIs remain protected; a real un-intercepted POST reaches the route and returns its expected 400 rather than a login redirect.
- The RPC now holds a share lock on the active location through commit. A trigger-delayed two-session test proves a concurrent deactivation remains blocked until the order transaction completes. The complete T10 release-readiness aggregate, including migration 289, exits 0. Raw database errors are logged only server-side with a correlation ID; callers receive a stable error code.
- Independent architecture/security re-review of frozen `e276fdfb`: APPROVE with no P0/P1; it independently reproduced the real 400/no-redirect probe and all three disposable PostgreSQL behavior/race groups.
- A financial review then found fractional-cent divergence between once-rounded headers and separately rounded lines. The RPC now persists two-decimal canonical unit prices, derives each line from those units and derives the header from the exact rounded lines. A two-line `0.005 + 0.005` regression proves header and line sum both equal `0.02`.
- Independent financial/database re-review of `2b4e2d9d`: APPROVE for the atomic Storefront subgate, with no remaining bounded P0/P1. Clean production build after all corrections: exit 0, 449/449 pages. TL-G2/TL-G5 remain PARTIAL for full-schema HTTP→DB→Kitchen→ready→dispatch lifecycle evidence.

## Production Driver component actor — 2026-08-02

- Guarded `/test-lab/actors/driver` renders the actual production `FahrerApp` with a synthetic assigned batch. The route remains unreachable unless the central isolation guard accepts an explicitly local test-lab environment.
- Real Chromium loads the canonical offer and the same base64url SSR auth-cookie format used by the Supabase browser client, clicks the production Accept control and observes the exact `/api/driver/v1/orders/accept` request. The assertion covers Bearer authentication, offer/version values and a UUID transition key. It waits for the component-triggered navigation to finish and only then verifies that canonical local assignment version 2 survived the reload. The synthetic actor intentionally provides the same server snapshot again, so this does not claim post-reload server reconciliation or removal of the offer UI.
- HTTP and WebSocket interception is fail-closed and browser service workers are blocked. Local app/Supabase origins are explicit; OpenStreetMap tile requests are fulfilled from an in-memory one-pixel fixture and never reach the network. No unexpected origin or page error is accepted. Screenshot and trace are retained under `artifacts/driver-system-lab/driver-component/`.
- Focused Chromium console result: 1/1 pass. P0 TypeScript: exit 0. Full guarded aggregate console result for `tl_20260802t120000z_1234abcd`: 92 pass, 11 intentional opt-in skips, 0 failures. The generated aggregate report/JUnit contain file-level discovery events rather than TAP testcase counters and are not evidence for those numbers or for the focused browser result. Complete T10 disposable-PostgreSQL/race release-readiness: exit 0. Clean production build: exit 0, 450/450 pages.
- Scope boundary: this proves the real Driver UI and atomic Accept client contract against a synthetic intercepted response; it does not yet prove HTTP→canonical API→disposable database persistence or the Dispatcher production component. TL-G2/TL-G5 therefore remain PARTIAL.
- Two independent re-reviews of fixed `6489c4be` APPROVE the bounded Driver UI/Accept subgate with no P0/P1. Both verified the two document loads around the Accept POST, post-reload version assertion, blocked service workers, controlled origins and the corrected artifact-scope wording.
