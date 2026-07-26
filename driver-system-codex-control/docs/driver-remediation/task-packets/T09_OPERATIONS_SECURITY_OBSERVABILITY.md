# T09 — Operations, Security and Observability

## Objective

Make failures visible and provide safe, audited human control.

## Required implementation

1. Correlation IDs across order, assignment, trip, stop, driver, GPS, push and worker tick.
2. Structured event/audit schema with redaction.
3. Metrics and alerts for:
   - unassigned order age;
   - duplicate assignment attempts;
   - dispatch latency/failures;
   - stale/untrusted GPS;
   - push no-ACK/expired;
   - overdue holds;
   - queue backlog;
   - route/deadline risk;
   - worker/cron failures;
   - app version/platform error rates.
4. Operations console for canonical state, reason codes and safe versioned override.
5. Emergency reassignment/hold/disable actions with actor, reason and expected version.
6. Per-tenant kill switches and feature flags.
7. RLS/authz/security contract tests for driver, kitchen, dispatcher and admin.
8. Remove unauthenticated sensitive debug beacons or constrain/redact them.
9. Secure token storage where applicable.
10. Configurable GPS retention and verified cleanup.

## Mandatory tests

- unauthorized cross-driver/order access;
- kitchen location/role isolation;
- override race;
- sensitive log redaction;
- kill switch;
- alert generation from injected failures;
- retention cleanup in isolated DB.

## Acceptance

Gate G8 green without altering production settings.
