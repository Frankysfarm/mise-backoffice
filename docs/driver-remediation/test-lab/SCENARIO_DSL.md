# Scenario DSL v1

A scenario declares a stable lowercase ID, tags, uniquely identified typed
actors, ordered steps and explicit expectations. Validation rejects unknown
actors, duplicate IDs, missing steps and malformed versions before execution.
Seeds and the environment-owned run ID belong to execution metadata rather
than the scenario, allowing exact replay without changing the catalog entry.

Business mutations are actions implemented by actors through public UI/API
contracts. Scenario files cannot contain SQL or provider credentials.
