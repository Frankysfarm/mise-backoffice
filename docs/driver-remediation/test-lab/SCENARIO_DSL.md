# Scenario DSL v1

The versioned machine-readable contract is implemented by
`tests/driver-system-lab/scenarios/schema.ts`. It rejects unknown fields at
every level and validates all cross references before fixture creation.

Required data covers scenario identity and seed, capabilities, isolated
environment and test tenant, virtual clock, stores, typed actor profiles,
vehicles and capacity, driver start/GPS fixtures, orders and required items,
payment state, routing/traffic/push/network fixtures, ordered UI/API actions,
fault events, UI/invariant/dispatch expectations, optimization tolerance and
run-only verified cleanup.

`compileScenarioFixture()` converts a validated scenario into sorted actor,
vehicle, driver and order rows, absolute timestamps, provider selections and a
stable action/fault timeline. Canonical serialization and a SHA-256 digest make
same-input/same-seed equivalence directly testable. A changed seed or provider
fixture changes the digest. The compiler performs no database, provider or
production mutation.

Business mutations remain actions implemented by actors through public UI/API
contracts. Scenario documents cannot contain SQL, credentials or undeclared
fields. Full Storefront/Kitchen/Driver/Dispatcher execution belongs to TL-G2
and TL-G5 and is not implied by DSL validation.
