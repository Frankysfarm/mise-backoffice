# Runtime dispatch shadow capture

`adaptive-dispatch-runtime-shadow.ts` is a strictly read-only, explicit
shadow seam. It accepts the runtime snapshot and a separately read persisted
observation, invokes the unchanged production adaptive optimizer, and retains
all three values: runtime input, optimizer input/plan, and persisted
assignments/stops. It has no database, network, writer, provider, feature flag,
or activation callback; passing `enabled=false` fails closed.

The focused fixture captures two and four drivers, Bike and Car capacity,
staggered ready times, an endangered-order marker, an incumbent route prefix,
two stores, two traffic-matrix versions, and maximum bundle sizes one through
four. Capacity and bundle size are decision inputs. Readiness and incumbent
stops are validated constraints; endangered and traffic-matrix version are
retained metadata here, not proven decision-sensitive optimizer inputs. The
persisted readback fixture is constructed separately from route estimates.
Assignments and exact stop sequences must match both the captured route
estimate and the independently implemented exhaustive Oracle. Reordered,
independently declared stops fail even when assignment membership is unchanged;
a different persisted assignment also fails explicitly.

This closes the deterministic capture/comparison format, not production
activation. Frank does not currently invoke the adaptive optimizer; its active
runtime remains the canonical per-order deterministic/T08 pipeline. Therefore
this seam must not be described as evidence that adaptive global bundling is
live, database-persisted, or production-wired. A later integration needs an
explicitly reviewed default-off Frank shadow call and a disposable full-schema
readback. Existing route feasibility and ready time remain provider inputs:
the seam proves they are captured and that estimates preserve the incumbent
prefix/do not predate readiness, not that an external routing provider computed
them correctly.

Focused command:

```sh
node --import tsx --test tests/driver-system-lab/adapters/captured/runtime-shadow-pipeline.test.ts
```

## DB-backed readback (2026-08-04)

`lib/delivery/adaptive-dispatch-db-shadow.ts` extends this seam with a
default-off, read-only loader: it reads the actual persisted assignment, batch
stop, order, driver and latest GPS rows through an injected SELECT-only
executor, rebuilds the runtime snapshot with deterministic haversine
estimates and reuses the comparison above. The real HTTP lifecycle proves the
green path and both drift directions (stop-sequence swap, GPS-driven
assignment flip) against live PostgreSQL. The shadow is not called by any
production scheduler; activation stays a reviewed default-off decision.
