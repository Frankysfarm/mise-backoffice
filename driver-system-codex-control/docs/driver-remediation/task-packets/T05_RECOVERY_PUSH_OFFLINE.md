# T05 — Recovery, Push, Realtime and Offline Outbox

## Objective

Recover correct server state after push loss, app restart, network interruption, duplicate events and worker restart.

## Required implementation

1. Replace the two incompatible `mise_offline_queue` formats with one versioned outbox schema and migration strategy.
2. Every queued action has stable action ID, created time, expected version, attempts and terminal result.
3. Server idempotency makes replay safe.
4. Define notification ledger states such as queued, provider-accepted, app-acknowledged, expired and failed. Do not claim provider delivery when unavailable.
5. Push/CallKit/Web Push only wakes the app; app always fetches canonical snapshot.
6. Implement technical ACK distinct from assignment acceptance.
7. Add fallback polling/reconnect snapshot for missing push/Realtime.
8. Add worker/server restart recovery using CAS and persistent deadlines.
9. Remove silent error swallowing in recovery and delivery critical paths.
10. Resolve duplicate subscriptions/listeners and cleanup behavior.

## Mandatory tests

- push missing;
- duplicate push;
- app ACK before/after snapshot fetch;
- app killed then reopened;
- network offline with queued actions;
- duplicate replay;
- events in reverse order;
- server restart during assignment;
- assignment expires while app offline;
- old queue format migration.

## Acceptance

Relevant G4 clauses green and no normal decline semantics reintroduced.
