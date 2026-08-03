# PC power-loss checkpoint — 2026-08-03

Repository: `/Users/eule/mise-driver-remediation`
Branch: `codex/driver-remediation`

## Last durable commits

- `8eed47bb` — strict Dispatcher startup subgate.
- `aad06df7` — real Storefront HTTP→Next→PostgREST→PostgreSQL foundation.
- `ce4b6cce` — token-bound atomic Kitchen-ready transition.

The pre-existing modified `artifacts/driver-system-lab/dispatcher-component/dispatcher-trace.zip`
and generated artifact directories are not part of these commits and must not be staged.

## Current continuation

The continuation composes migrations 274, 276, 277, 278, 279, 289 and 290 on a disposable
local PostgreSQL database and real local PostgREST. The first complete run after adding 278/279
correctly failed closed because the writer lease expired during a long cold Next compile. The
test now renews the exact same elected writer lease immediately before assignment.

Confirming result after the invariant extension: `npm run test:lab:lifecycle:http-db`, exit 0,
7/7. It proves Storefront
create/replay, token-bound atomic Kitchen-ready, boundary/cross-station rejection, Atomic-v2
assignment/replay with exactly one batch/assignment/push, Driver ACK, pickup arrival, incomplete
manifest rejection, whole-trip pickup/departure, drop-off arrival, delivery completion/replay,
terminal rows, zero driver capacity, concurrent Kitchen finalization, terminal redispatch denial
and a zero-violation canonical database snapshot.

Next required command (local only):

`npm run test:lab:lifecycle:http-db`

After restart, first run `git status --short` and verify this checkpoint commit. The next gate is
an invariant snapshot over the real lifecycle followed by application-path chaos/recovery.
Production remains forbidden.
