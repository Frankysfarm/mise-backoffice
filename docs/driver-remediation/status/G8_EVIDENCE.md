# G8 Evidence — Operations, Security and Observability

Status: **GREEN (isolated server/PostgreSQL evidence)**
Confidence: **HIGH**

| Requirement | Proof | Files | Command / cwd | Exit | Result | Commit | Limitation |
|---|---|---|---|---:|---|---|---|
| Safe emergency state machine | Authenticated role/tenant/location scope, reason, CAS, idempotency, before/after audit | migration 283, operations override API | T09 full runner, repo root | 0 | PASS | `3399cfad`, `426d5924` | Default-off |
| Parallel dispatch safety | Driver row lock/version fence and two-session same-version override race | override race runner | T09 full runner | 0 | PASS | `3399cfad` | Isolated PostgreSQL |
| RLS/direct writes | Browser roles revoked; service-only tables/functions; cross-tenant and kitchen escalation denied | migrations 278/280/282/283 and SQL tests | T09 full runner | 0 | PASS | `3399cfad` | Full hosted PostgREST staging remains T10 |
| Replay and audit | Exact retry, changed fingerprint rejection, immutable actor/reason/time/before/after/correlation | migration/test | T09 full runner | 0 | PASS | `3399cfad` | None for tested contract |
| Redaction | Recursive bounded allow-list contract hashes IDs and removes location, PII, notes and secrets | ops module/test | T09 full runner | 0 | PASS | `596c7b52` | Export destination not configured |
| Alerts and worker | Durable deduplicated alerts for GPS, lease, hold, push, queue, deadline and worker health | monitor worker, alert RPC, dispatch tick | T09 full runner + focused typecheck | 0 | PASS | `426d5924` | External pager/dashboard not activated |
| GPS retention | Tenant-configured 1–365 day cleanup cannot delete another tenant | prune RPC/test | T09 full runner | 0 | PASS | `3399cfad` | Production retention unchanged |
| Operations view | Authenticated tenant-derived snapshot, database errors redacted | snapshot API/wiring test | T09 full runner | 0 | PASS | `426d5924` | UI presentation may evolve |

G8 is GREEN for the locally required durable authority and security contracts.
This is not production activation or external alert-delivery evidence.
