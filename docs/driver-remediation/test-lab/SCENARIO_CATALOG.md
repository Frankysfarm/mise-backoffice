# Scenario catalog

The executable catalog contains more than 75 unique deterministic core cases
across smoke, adaptive bundling, kitchen/hold, picking/departure, routing,
push/consent, multi-order lifecycle, offline/GPS/device, concurrency/crash,
security/tenant and soak categories. `catalog.test.ts` prevents category loss
and duplicate IDs. Commit smoke selects five fast cases; full/nightly select
the entire catalog, with nightly additionally owning the 500-seed property
run. Device cases remain evidence-blocked until the matching physical platform
is available; their presence is not represented as a pass.
