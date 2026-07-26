# T08 — Routing, Multi-Order Batching and Kitchen Hold

## Objective

Choose route-compatible bundles and kitchen release times without harming existing or new deliveries.

## Routing requirements

1. Use road travel-time matrix when available, with bounded cache and conservative fallback.
2. Model pickup ready windows, service times, delivery deadlines and current route progress.
3. Evaluate insertion positions for new pickup/drop-off stops.
4. Reject insertion if any existing/new order violates deadline, quality or configured detour constraints.
5. Respect vehicle capacity and approved store/tenant combination rules.
6. Recompute on material events only; use hysteresis/versioning to avoid route churn.
7. Persist route plan/version and decision explanation.

## Kitchen/hold requirements

1. Replace fragmented wait concepts with one persistent policy and fields such as `kitchen_release_at`, absolute hold deadline and next evaluation time.
2. Inputs include prep estimate, kitchen load/queue, driver ETA to pickup, route feasibility, promised deadline and confidence margin.
3. Global hard cap configurable up to 15 minutes; initial default remains conservative until replay evidence.
4. Release immediately when latest-safe-start is reached or lateness risk rises.
5. Idempotent kitchen release and duplicate-send protection.
6. Watchdog handles missed cron/worker restart.
7. Cancellation during hold is safe.
8. Store reason codes and exact input snapshot.

## Mandatory tests

- 0–3, 3–8, 8–15 and 15–20 km scenarios;
- traffic/road ETA versus Haversine difference;
- compatible and opposite-direction bundles;
- existing-customer detour breach;
- kitchen fast/slow/load spike;
- hold cancellation;
- worker restart;
- duplicate release;
- deadline override;
- no future matching order arrives;
- route matrix unavailable;
- stability under repeated events.

## Acceptance

Gate G7 green in replay/staging. Production activation remains separately gated.
