# Test-lab environment safety

Every test-lab command calls `assertTestLabEnvironment()` before creating an
artifact directory, connecting to PostgreSQL, or invoking an actor. The guard
requires an explicit enable flag, a local/test/staging environment, a statically
allowlisted PostgreSQL host, a visibly test-only database name, a `testlab_`
tenant and a run-scoped ID. Production runtime markers, hosted production
domains, live Stripe keys and non-sink communication providers abort the run.

The initial routing provider is fixture-only. Provider messages accept only
`synthetic:` recipient aliases and retain hashes rather than private payloads.
Cleanup must present the exact owning `test_run_id`; cross-run cleanup fails.

Negative tests deliberately exercise disabled mode, production database,
unmarked database, production tenant, live payment, real push, live routing,
production runtime and cross-run cleanup. This is the executable TL-G0 proof.
