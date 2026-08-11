# Production hardening sequence — 2026-08-11

These are the exact SQL migrations applied to the production database during
the delivery-platform release audit. Apply them in numeric order with
`ON_ERROR_STOP=1` only after taking a PostgreSQL custom-format backup.

The sequence repairs the delivery schema and RPCs, secures customer and driver
data with least-privilege RLS, gates dispatch and payouts, and adds the public
tracking capability token plus rate-limited legacy-link verification.

Migration `028_tracking_capability_tokens.sql` was applied after the earlier
hardening sequence. The production verification on 2026-08-11 confirmed:

- all 178 existing orders had distinct non-null tracking tokens;
- direct anonymous reads of customer orders and verification attempts returned
  HTTP 401;
- the full shop-to-driver-to-delivery E2E completed and cleaned up successfully.

These files are a release record, not an automatic re-run mechanism. Check the
target database's migration state before applying them to an existing system.
