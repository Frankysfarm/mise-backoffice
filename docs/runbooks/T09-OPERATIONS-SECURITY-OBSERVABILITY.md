# T09 Operations, Security and Observability — Safe Additive Candidate

## Scope and safety

This candidate is deliberately additive and has no production callsite. It
defines the redaction, alert, authorization, override-evidence, kill-switch and
retention contracts that can be integrated only after their database/API
ownership is assigned. It does not change lifecycle state, dispatch, recovery,
GPS transport, push delivery, native code, environment variables or production
settings.

`lib/delivery/ops-observability.ts` is not an alert delivery system and must not
be described as one. `evaluateOpsAlerts` deterministically converts a supplied
snapshot into alert records; persistence, deduplication, routing and paging are
future integration work.

## Data handling contract

- Correlation IDs are UUIDs and may cross service boundaries.
- Tenant scope is mandatory.
- Raw actor/resource identifiers are hashed before an event is emitted.
- Address, coordinates, names, phone/email, free-text notes, credentials,
  cookies, authorization headers, tokens and secrets are redacted recursively.
- Attributes are bounded by depth, count and string length. Free-form strings
  are redacted by default; only enumerated categorical fields such as platform,
  state and app version may retain bounded string values.
- Operational logs must never carry an entire API request, driver snapshot,
  push token, GPS point or customer/order payload.
- Retention is configurable from 1–365 days. The program does not choose or
  activate a production value; the proposed 30 days remains staging-only.

## Alert inputs

The pure evaluator covers the required source categories:

| Alert | Required upstream observation |
|---|---|
| old unassigned order | oldest canonical unassigned order timestamp |
| duplicate assignment | rejected atomic assignment counter |
| dispatch failure | checked writer/tick failure counter |
| stale/untrusted GPS | oldest currently trusted GPS timestamp |
| push no-ACK | oldest provider-accepted, technically unacknowledged notification |
| overdue hold | persistent hold deadline watchdog count |
| queue backlog | canonical outbox backlog |
| delivery risk | nearest canonical promised delivery deadline |
| worker failure | last successful worker heartbeat |
| app-version errors | errors and request count grouped by version/platform |

An absent observation does not produce a false healthy value or a synthetic
alert. The collector must separately report observation-source health.

## Kill-switch and override rules

- The mutation boundary must call a tenant-scoped policy check inside the same
  authenticated server action, not in the UI.
- Both dispatch and mutation flags fail closed.
- Production flags remain default-off until G9 approval.
- Manual override evidence requires authenticated dispatcher/admin actor,
  stable action ID, correlation ID, reason code, bounded note and expected
  version.
- Validation alone is not authority. The eventual API must execute the override
  through the atomic CAS transition and durable audit transaction.

## Security matrix

- A driver can read only resources explicitly associated with that same driver
  and tenant.
- Kitchen can read tenant-scoped order/trip/stop/hold views, never GPS.
- Dispatcher/admin/service access remains tenant-scoped.
- These pure policy tests complement but do not replace PostgreSQL RLS and
  authenticated API tests.

## Verification

Run:

```sh
scripts/tests/run-t09-safe-observability.sh
```

Expected output ends with `ops observability contract tests: ok`.

## Protected-scope handoffs required before G8

The following are intentionally not implemented in this candidate:

1. A new migration for durable telemetry, tenant policies, alert episodes,
   retention cleanup and least-privilege RLS.
2. Authenticated versioned operations APIs and a manual-override RPC wired to
   atomic CAS. This requires explicit ownership of protected server contracts
   and transition migrations.
3. Read-only operations console fed exclusively by canonical server views.
4. Correlation propagation at protected T02–T07 writer, recovery, GPS, push and
   client callsites.
5. A scheduler/worker for alert evaluation, deduplication and checked delivery.
6. Isolated PostgreSQL tests for RLS roles, override races, kill switches and
   retention deletion.
7. Metrics backend, dashboards, alert destinations and SLO thresholds.

Until those handoffs pass their gates, G8 remains red and this module remains
default-off/unwired.
