# T04 Pick/Pickup Correctness Runbook

## Invariant

A driver departs only through `fn_driver_pickup_batch_v2`. The RPC locks the
trip, driver, every assignment, order and stop; validates an exact manifest;
records exact item outcomes and evidence; and advances all remaining assigned
orders to delivery in one transaction.

`unresolved` is never cargo confirmation. The client displays the required
kitchen/dispatch resolution and keeps departure disabled. Non-present terminal
outcomes require evidence. Orders cancelled during picking are excluded from
cargo and their pre-custody assignments are cancelled by the server.

## Verification

Run only against the disposable PostgreSQL harness:

```sh
scripts/tests/with-local-remediation-postgres.sh \
  scripts/tests/run-279-pick-pickup-correctness.sh
```

Run the pure client manifest test through the repository's cached/bundled
TypeScript test mechanism. The test proves exact item identity, deterministic
server order, partial-set rejection and fabricated-item rejection.

## Failure handling

- `ITEM_MISSING_REQUIRES_RESOLUTION`: kitchen/dispatch must publish an evidenced
  terminal resolution; reload the canonical snapshot.
- `ASSIGNED_ORDER_SET_MISMATCH` or `REQUIRED_ITEM_SET_MISMATCH`: do not retry a
  modified payload; reload the snapshot and restart the pick check.
- `EXPECTED_VERSION_CONFLICT`: another device or server event won; reload.
- Network loss: replay the byte-identical stored action envelope and action ID.
- Unknown failure: do not depart. Preserve the correlation ID for operations.

Migration 279 is additive and is not run against production by this task.
