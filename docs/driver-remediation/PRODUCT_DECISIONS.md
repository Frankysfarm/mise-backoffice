# Product Decisions — Proposed Defaults for Staging

These defaults prevent the engineering program from stalling. They remain configurable and default-off for production until approved.

## Assignment acceptance

- A regular assignment is server-authoritative and does not require driver approval.
- The app sends a **technical receipt ACK**, not an acceptance decision.
- No normal “decline” button or API is exposed in the target flow.
- If the app does not ACK, the assignment remains visible in the canonical server snapshot and the system escalates/retries according to policy.

## Driver safety exceptions

The driver may report only structured exceptions:

- medical/safety emergency;
- vehicle failure;
- accident/road closure;
- location permission/GPS failure;
- network/device failure;
- shift invalid or dispatcher-authorized break.

An exception does not silently delete the assignment. It creates an auditable event and triggers a server-side hold/reassignment/escalation process.

## GPS freshness — staging defaults

- active pickup/delivery trip: warn after 45 seconds, ineligible for a **new** assignment after 90 seconds;
- idle/returning: warn after 90 seconds, ineligible after 180 seconds;
- values are tenant-configurable and must be validated on real devices;
- an active order is never abandoned solely because GPS is stale; it is escalated operationally.

## Capacity — staging defaults

- bicycle: maximum 2 drop-offs;
- car: maximum 4 drop-offs;
- capacity is further reduced by route/deadline feasibility;
- these are ceilings, not targets.

## Batching

A new order may join a trip only when every existing and new order remains within:

- pickup readiness window;
- promised delivery deadline;
- configured maximum added detour;
- vehicle capacity;
- same-tenant/store policy or an explicitly approved multi-store rule.

Fairness is a low-weight tie-breaker. Deadline and quality feasibility dominate.

## Hold and kitchen release

- persistent global hard cap: configurable up to 15 minutes;
- initial staging/production-default cap: 5 minutes until replay and product-quality data prove longer waits safe;
- release immediately when the predicted latest safe kitchen start is reached;
- never hold past an order-specific promised deadline margin;
- every decision stores reason, inputs, next evaluation time and absolute deadline;
- a watchdog guarantees release or escalation after deadline.

## Location retention

- retention is controlled by configuration, not hard-coded;
- local/staging tests may use 30 days because an existing migration proposes that value;
- production activation is blocked until the approved business/privacy policy is recorded.

## Manual override

Every override requires authenticated actor, reason code, free-text note, expected state/version and audit event. Overrides use the same atomic transition machinery as automation.
