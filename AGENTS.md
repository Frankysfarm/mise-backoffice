# AGENTS.md — Driver/Dispatch Remediation Rules

> Merge this proposal with any existing repository `AGENTS.md`. Never overwrite stricter existing instructions.

## Mission

Deliver a server-authoritative, race-safe, observable driver and dispatch system. Correctness and recoverability precede dispatch optimization.

## Required context

Before changing driver, order, kitchen, dispatch, GPS, push, recovery, or delivery code, read:

- `DRIVER_SYSTEM_AUDIT.md`
- `DRIVER_SYSTEM_FACTS.json`
- `docs/driver-remediation/PROGRAM_STATUS.md`
- the active task packet under `docs/driver-remediation/task-packets/`

## Absolute safety rules

- Never run production deployments, production migrations, destructive SQL, real pushes, real orders, or production feature-flag changes without explicit human approval.
- Never use `git reset --hard`, `git clean`, destructive checkout, silent stash, or force-push.
- Preserve all pre-existing dirty and untracked files. Record them before edits.
- Never print secrets, customer data, complete private locations, access tokens, or service-role keys.
- Use isolated branches/worktrees and task-scoped commits.
- Feature flags and tenant writer gates remain default-off until their release gate passes.

## Architectural invariants

1. **One authoritative writer per tenant.** Exactly one dispatch writer may assign or reassign orders for a tenant.
2. **Atomic assignment.** Batch/trip, stops, order claim, driver load, audit event, and notification outbox are committed in one database transaction or not at all.
3. **Exactly one active assignment per order.** Enforce this in the database, not only in code.
4. **Versioned state transitions.** Critical transitions require expected state/version and return the new version.
5. **Idempotency.** Every externally retried mutation has a stable idempotency/action key and deterministic replay result.
6. **Server authority.** Browser/mobile clients may not directly mutate critical order, assignment, trip, pick, pickup, delivery, driver-state, or canonical GPS-current-state fields.
7. **Push is a wake-up signal.** The current server snapshot is the source of truth. Push delivery is not presumed.
8. **No normal driver rejection.** A driver acknowledgment confirms receipt only. Safety exceptions are explicit server-side events that may trigger supervised or automatic reassignment.
9. **Monotonic GPS.** Current position may advance only by session/sequence/device timestamp policy. Delayed older packets cannot overwrite newer state.
10. **Persistent deadlines.** Hold/release times, assignment expiry, pickup windows, and delivery deadlines are stored and watchdog-recoverable.
11. **No silent failure.** Every critical database/API result is checked. Errors carry correlation IDs and structured context.
12. **Compatibility first.** Schema/API changes must document old-client behavior and provide a controlled migration/rollback path.

## Critical file ownership

The following may be modified by only one active task/worktree at a time:

- `lib/frank.ts`
- `lib/delivery/dispatch-engine.ts`
- canonical state-machine and lifecycle modules
- dispatch/assignment migrations and RPCs
- `lib/delivery/recovery.ts`
- `app/fahrer/app/client.tsx`

The orchestrator records current ownership in `docs/driver-remediation/status/FILE_OWNERSHIP.md`.

## Implementation rules

- Prefer explicit domain types and transition tables over scattered status strings.
- Prefer database constraints/RPC transactions for cross-row invariants.
- Use server-generated correlation IDs and client-generated action IDs.
- Store event time and receipt time separately.
- Keep pure scoring/routing policy separate from side effects.
- Explain every dispatch decision with candidate exclusion and score reason codes.
- Do not add a second queue, state model, GPS path, or dispatch writer as a temporary shortcut.
- Do not activate long-distance hold or batching before persistent deadlines and route feasibility exist.
- Do not make broad refactors unrelated to the active task packet.

## Required tests

Every task must add the tests named in its packet. At minimum, changes to critical lifecycle code require:

- expected-state/CAS tests;
- duplicate request/idempotency tests;
- out-of-order event tests;
- failure-injection/rollback tests;
- concurrency tests where multiple workers or clients can race;
- compatibility tests for the current app/API version;
- evidence that focused typecheck and lint/build gates pass.

Tests may use local/isolated databases only. A mocked pure unit test is not sufficient evidence for database atomicity or device lifecycle behavior.

## Completion report

Return:

- exact changed files and symbols;
- commands and exit codes;
- invariant/test evidence;
- known limitations;
- gate result;
- no-production-change confirmation.

Do not claim success when a required environment, migration, real-device test, or concurrency test was not executed. Mark it explicitly blocked or unverified.
