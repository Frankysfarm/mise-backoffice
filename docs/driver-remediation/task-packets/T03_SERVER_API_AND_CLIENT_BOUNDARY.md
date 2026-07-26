# T03 — Server API and Client Mutation Boundary

## Objective

Remove the driver browser/WebView as a business-logic writer.

## Required implementation

1. Introduce versioned authenticated driver APIs for:
   - session/online state;
   - canonical current snapshot;
   - technical assignment ACK;
   - arrival;
   - item pick resolution;
   - pickup/departure;
   - stop completion/delivery;
   - driver exception;
   - GPS event upload.
2. Require action/idempotency key and expected state/version on critical mutations.
3. Return canonical server snapshot/version after every mutation.
4. Replace direct Supabase writes in critical driver UI flows with these APIs.
5. Keep Realtime as invalidation/wake-up; reload canonical snapshot after reconnect or version gap.
6. Add RLS/permissions that deny unauthorized direct writes to canonical lifecycle fields.
7. Preserve an explicit old-client compatibility path with bounded lifetime and telemetry.
8. Ensure the app cannot normally decline an assignment. Remove/disable conflicting API/UI paths or map them to structured exceptions where appropriate.
9. Add correlation IDs and check every database/API error.

## Mandatory tests

- unauthorized/other-driver mutation;
- stale expected version;
- duplicate action ID;
- app restart snapshot restoration;
- Realtime event gap;
- old-client/new-backend compatibility;
- normal decline path rejected;
- safety exception accepted and audited.

## Acceptance

Gate G3 green. No critical browser direct-write path remains for the canonical lifecycle.
