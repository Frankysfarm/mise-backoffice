# Isolated Staging E2E Runbook

## Local deterministic environment

From `/Users/eule/mise-driver-remediation`:

```sh
scripts/tests/run-t10-local-release-readiness.sh
```

The command creates a fresh disposable PostgreSQL 16 cluster for every
canonical suite, applies migrations in the tested order, seeds fixtures, runs
two-session races/fault injection and destroys the cluster afterwards. It
never reads a production URL.

For a hosted isolated staging run:

1. Create a new non-production project/schema and credentials.
2. Verify the hostname/project ID twice and record it in the evidence log.
3. Apply migrations 274, 276–283 in order, including each preflight.
4. Seed only synthetic tenants, locations, drivers, orders and push tokens.
5. Configure fake push, controlled Realtime and routing stubs.
6. Keep every feature flag and writer gate off; enable shadow per test tenant,
   then one synthetic active tenant.
7. Run the 26-step lifecycle checklist from `T10_FINAL_REPORT.md`, followed by
   fault injection.
8. Export redacted evidence, disable flags, revoke credentials and delete the
   isolated environment.

Abort immediately on tenant mismatch, unexpected real data, multiple writers,
partial projections, missing audit, unredacted telemetry or any production
hostname.
