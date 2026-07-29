# Rollback and Forward-Fix Runbook

1. Close tenant mutation and route/hold flags.
2. Disable the Atomic-v2 writer gate for new work; do not rewrite active state.
3. Preserve current assignments and let canonical snapshots remain readable.
4. Stop schedulers only after confirming no claimed outbox/hold transaction is
   in flight.
5. Compare orders, assignments, batches, stops, driver capacity, holds,
   outboxes and audit.
6. Prefer an additive forward-fix migration for persisted data. Destructive
   down migrations require a separately reviewed backup/restore procedure.
7. Restore the previous compatible server/app version only if its read
   contract covers the current schema.
8. Re-enable from observability to shadow to active, one tenant at a time.

Never reset a production database, delete audit/idempotency rows, decrement a
guessed version, or replay with a changed fingerprint.
