# Migration Matrix

Updated: 2026-07-26

| Migration / schema scope | Repository state | Environment applied by this program | Default state | Validation path | Owner / gate |
|---|---|---|---|---|---|
| Existing migrations `001`–`273` | tracked history | none | existing behavior | disposable PostgreSQL fixture/schema inventory required before relying on them | baseline only |
| `274_atomic_single_order_offer.sql` | tracked at base commit | none | tenant gate missing/disabled preserves legacy behavior | isolated PostgreSQL contract, behavior and two-session concurrency tests | T02 / G2 |
| `275_gps_history_security_retention.sql` | preserved pre-T00 input | none | unverified | isolated schema validation only after T01 contract | T06 / G5 |
| Future canonical state migration | not created | none | must be default-off/compatible | migration dry run plus rollback in disposable database | T01/T02 |

No migration has been executed against production or staging by T00.

## Isolated database command path

`scripts/tests/with-local-remediation-postgres.sh` starts a fresh local
PostgreSQL 16 cluster under the operating-system temporary directory, exports
only a loopback `TEST_DATABASE_URL`, executes one supplied command, stops the
server, and deletes the temporary cluster. It never reads repository `.env`
files and cannot infer a production URL.

Examples:

```sh
scripts/tests/with-local-remediation-postgres.sh \
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select version()"

scripts/tests/with-local-remediation-postgres.sh \
  scripts/tests/run-274-atomic-offer-concurrency.sh
```

The second command is a future G2 validation and requires its schema-compatible
fixture; T00 only proves the isolated engine path.
