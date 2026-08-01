# Adaptive deterministic dispatch optimizer v1

The optimizer is a pure planning function. It cannot write assignments, call an
LLM, fetch routes, or bypass the atomic canonical writer.

It enumerates bundle sizes from one through each driver's remaining capacity
(bounded by configuration), applies hard eligibility gates before scoring, and
solves a global set-packing problem: a driver appears at most once and an order
appears at most once. The objective is lexicographic: maximize assigned orders,
then minimize soft cost, then use the stable driver/order signature.

Hard gates are online status, active session, usable GPS, capacity, pickup
radius, delivery deadline, network availability, and precomputed route
feasibility/detour policy. Soft cost contains ETA, detour, normalized load,
recent-assignment fairness, low battery, and poor network quality. Hard gates
are never relaxed.

The deterministic fallback ladder is: globally feasible bundles, globally
feasible singles, then HOLD. Every evaluated driver/bundle is retained in the
decision trace with exclusions or exact score components. Route estimates and
the evaluation timestamp are immutable inputs, making decisions replayable.

Production integration must remain shadow-only until bounded option counts,
road-routing inputs, atomic writer compatibility, and replay drift are proven.
Both candidate enumeration and exact-search nodes have explicit fail-closed
limits; exceeding either produces no partial plan.
