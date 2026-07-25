# P1 Intelligent 15 km Dispatch Eligibility

## Problem

The legacy dispatcher does not expose one deterministic, auditable decision for
delivery radius, GPS freshness, route workload, assignment fairness, and
deadline feasibility.

## Scope

- Reject orders whose restaurant-to-customer distance exceeds the configured
  limit. The effective limit is always capped at 15 km.
- Fail closed when pickup, dropoff, or driver coordinates are missing.
- Reject stale or implausibly future-dated driver GPS positions.
- Include driver-to-pickup travel, pickup-to-dropoff travel, service time, and a
  safety margin in deadline feasibility.
- Account for active route capacity and recent assignment fairness.
- Produce deterministic scores, reason codes, inputs, and tie-breaking.
- Use a clearly labelled Haversine/static-speed approximation only.

## Non-goals

- No claim of live-road, traffic-aware, or turn-by-turn routing.
- No external routing API.
- No automatic production activation.
- No schema migration, deployment, commit, or push in this slice.

## Safety and rollout

The integration is active only when both conditions are true:

1. `P0_ATOMIC_OFFER_ENABLED=true`
2. `P0_INTELLIGENT_15KM_ENABLED=true`

The atomic offer RPC additionally enforces the tenant-scoped single-writer
gate. With either environment flag absent, Frank keeps the legacy selection
path unchanged.

The configured distance is read from dispatch configuration, tenant delivery
radius, or `P0_MAX_DELIVERY_KM`, in that order, with an 8 km fallback. Every
value is clamped to a maximum of 15 km.

## Verification

- Pure deterministic unit tests:
  `scripts/tests/intelligent-dispatch.test.ts`
- Full TypeScript check:
  `npx tsc --noEmit --pretty false`
- Patch hygiene:
  `git diff --check`

## Rollback

Set `P0_INTELLIGENT_15KM_ENABLED=false` or remove it. No data rollback is
required because the feature is default-off and the legacy path remains.

## Known limitations

- ETA is an approximation based on Haversine distance and fixed speeds, not
  live traffic or road geometry.
- Capacity quality depends on the accuracy of the driver's stored
  `current_capacity`.
- Fairness uses recent Frank assignment-decision records and therefore depends
  on complete decision logging.
- Orders without a deadline can be scored, but cannot receive a deadline
  feasibility rejection.
