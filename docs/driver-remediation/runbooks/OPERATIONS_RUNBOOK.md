# Driver Operations Runbook

## Preconditions

Use only the authenticated operations API. The employee must have an enabled
`ops_actor_scopes_v2` row for the tenant, role and location. Tenant mutation
and observability flags are default-off and may be enabled only under an
approved rollout.

## Triage

1. Load `GET /api/admin/operations/snapshot`.
2. Record the correlation ID, canonical resource version, writer epoch/lease,
   open hold and alert episodes.
3. Confirm tenant and location before acting.
4. Prefer recovery without mutation. If mutation is required, generate one
   action UUID and keep it unchanged for transport retries.
5. Submit `POST /api/admin/operations/override` with the observed expected
   version, a specific reason code and a factual note.
6. On a version conflict, reload the snapshot and reassess. Never increment a
   guessed version or loop automatically.
7. Verify the override ledger, before/after state, correlated event and any
   hold/push outbox projection.

## Supported emergency controls

- accident, vehicle/device/GPS failure, unreachable driver and unsafe shift end;
- safe tour interruption and reassignment escalation;
- order/kitchen cancellation;
- immediate kitchen release.

These actions are independent from ordinary driver decline. Drivers cannot use
this endpoint.

## Alert response

- `WRITER_LEASE_LOST`: stop new dispatch mutations; verify writer identity,
  epoch and lease before recovery.
- `STALE_OR_UNTRUSTED_GPS`: check device permission, tracker session and current
  point; do not dispatch new work to the driver.
- `HOLD_DEADLINE_OVERDUE`: run the controlled watchdog and confirm exactly one
  release or cancellation.
- `QUEUE_BACKLOG` / `PUSH_ACK_OVERDUE`: verify outbox claims and snapshot
  recovery; never infer assignment loss from a missing push.
- `UNASSIGNED_ORDER_AGE` / delivery risk: inspect candidate reasons and
  deadlines before any override.

## Never do

Do not write business tables from a browser, disclose raw GPS/customer data in
notes, reuse an action ID for changed input, bypass a CAS conflict, or change a
production flag without the rollout authorization.
