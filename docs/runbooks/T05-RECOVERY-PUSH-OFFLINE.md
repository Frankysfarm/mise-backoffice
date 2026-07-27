# T05 recovery, push and offline outbox

Push payloads are wake-only (`notification_id`, `event_type`, and the v2 snapshot
path). They never restore assignment state. On push, Realtime reconnect, network
reconnect, foreground, or process restart, fetch `GET /api/driver/v2/snapshot`.

The only local queue format is `{version:1, actions:[...]}` under
`mise_offline_queue`. Each action contains a stable `actionId`, creation time,
expected version, request fingerprint, attempts, and terminal result. Only exact
driver-v2 action/endpoint pairs are replayable. Legacy replay is default-off;
legacy and invalid entries are retained in the
versioned `quarantine` collection instead of being deleted. Terminal success,
client-error, and retry-exhaustion evidence is retained for seven days and then
pruned during the next outbox read.

`executeDriverV2OrQueue` is the handoff seam for the canonical client request:
network failures freeze its original envelope and HTTP 409 triggers canonical
snapshot reconciliation. `replayCanonicalDriverOutbox` obtains a fresh bearer
token at replay time; credentials are not persisted in local storage.

The push worker claims rows with a worker UUID. Abandoned claims become eligible
after two minutes. Provider acceptance is recorded as `provider_accepted`, not
delivery. The app separately calls `/api/driver/v2/notifications/ack`; this is a
technical receipt and cannot change assignment state.

The repush watchdog persists one escalation per overdue active assignment and
queues a snapshot wake. It deliberately does not release or decline an
assignment. Operators must resolve escalations through the canonical supervised
exception/reassignment flow.

Stale GPS follows the same escalation-only rule. `recoverCancelledBatch` uses a
batch state/version CAS RPC and never clears order ownership or calls the legacy
dispatcher. Recovery failure fails the cron/status request visibly.

Rollback: disable callers of the 281 RPCs, restore the prior push worker, then
leave additive columns/tables in place. Do not drop ledger data during rollback.
