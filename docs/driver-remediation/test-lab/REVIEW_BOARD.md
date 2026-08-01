# Independent review board

Reviewers inspect a fixed commit and evidence only. An implementer cannot sign
its own gate. Each record names commit, evidence, confirmed findings,
unconfirmed assumptions, risks and `APPROVE`/`REJECT`. P0/P1 gates require two
independent approvals. Required chairs are architecture, PostgreSQL concurrency,
dispatch/OR, kitchen operations, driver/mobile UX, security/tenant, SRE/chaos,
adversarial QA and a read-only final release judge.

The judge may return only `BLOCKED`, `SHADOW-ONLY` or `PRODUCTION-READY`. A
software review never substitutes for the human acceptance or physical-device
matrix.
