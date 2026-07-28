# T09 Final Report — Operations, Security and Observability

Date: 2026-07-28

T09 is complete for the isolated server/database environment. Migration 283
adds default-off tenant policy, tenant/location role scopes, durable
idempotent manual overrides, structured redacted event persistence, deduplicated
alert episodes, worker heartbeats and tenant-scoped GPS retention.

The authenticated operations API derives tenant and actor identity from the
server session, never from the request body. The database repeats role, tenant,
location, expected-version and idempotency checks in the same transaction.
Driver emergencies fence concurrent dispatch by incrementing `state_version`
and persist a canonical exception; cancellation and kitchen release use locked
canonical state and correlated audit.

The controlled dispatch scheduler now runs a default-off monitor for
unassigned age, stale GPS, push backlog/no-ACK, overdue holds, deadline risk,
worker health and writer lease loss. Alerts are durable and deduplicated. The
read API exposes a tenant-scoped canonical operations snapshot.

Verification:

```sh
scripts/tests/with-local-remediation-postgres.sh \
  scripts/tests/run-283-operations-security-observability.sh
```

Exit `0`: migration double-apply, default-off, cross-tenant/location/role
denial, direct authenticated-write denial, required reason, exact retry,
changed fingerprint, stale version, two-session override race, complete
before/after audit, alert deduplication, GPS retention, recursive redaction and
API/monitor wiring.

Commits: `3399cfad`, `426d5924`.

No production policy, telemetry destination, database, scheduler or flag was
changed. External paging/dashboard destinations remain rollout configuration,
not a source/database correctness blocker.
