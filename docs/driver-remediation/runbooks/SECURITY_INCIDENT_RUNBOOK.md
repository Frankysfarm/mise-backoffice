# Driver Security Incident Runbook

## Immediate containment

1. Disable the affected tenant's operations mutation flag and dispatch writer
   gate through the approved administrative procedure.
2. Preserve correlation IDs, action IDs and immutable audit rows.
3. Rotate exposed service credentials through the secret owner; never paste a
   token into logs, tickets or chat.
4. If GPS exposure is suspected, restrict access and preserve only the minimum
   evidence required for the investigation.

## Investigation

- Determine tenant, location, actor, role, action ID and resource version.
- Compare authenticated API access with `ops_actor_scopes_v2`.
- Review changed-fingerprint attempts, cross-tenant denials, override
  before/after states and correlated lifecycle events.
- Check direct browser grants/RLS, push debug endpoints and native token
  storage boundaries.
- Use hashed resource/actor identifiers in exported telemetry. Customer
  addresses, coordinates, names, contact data, notes and credentials remain
  redacted.

## Recovery

- Restore access narrowly by tenant/location/role.
- Re-enable flags in the documented canary order only after integrity checks.
- Run GPS retention cleanup with the tenant's configured retention period.
- Reconcile active orders, assignments, routes, holds, outboxes and writer
  lease before reopening dispatch.

## Evidence

Record timestamps, decisions, commands, query results, affected versions and
the final containment state. Do not delete or rewrite audit evidence.
