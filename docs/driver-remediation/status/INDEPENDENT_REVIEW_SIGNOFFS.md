# Independent review sign-offs

## Fixed commit `8934b878`

- Principal Architecture + Security/Tenant: **REJECT** TL-G0/TL-G1 and staging readiness. Confirmed the CLI guard core (10/10 at reviewed commit) but found the page/API used a weaker policy, DB factory/cleanup absent, suite labels non-selective, sparse evidence and no authentication. The central-guard, suite-selection and evidence findings were corrected after the frozen review; DB factory/authentication still block approval and the correction needs re-review.
- Dispatch/Operations Research: **APPROVE oracle-core only; REJECT TL-G4**. Confirmed independent exhaustive enumeration and 500 seeds, but no production comparison, stored optimality gap, representative generator, complete shrink predicate or full production feature model.
- PostgreSQL/SRE/Adversarial QA: **REJECT TL-G0/TL-G3/TL-G6/TL-G8/TL-G9**. Demonstrated production endpoint/provider credential bypasses, corrupt route snapshots accepted, labels without integrated races/faults, false-positive terminal-push ordering and `up` success against an unreachable database. Isolation endpoint/credential checks, route/pick/tenant/fingerprint checks, temporal push ordering, suite selection and DB healthcheck were hardened afterward; integrated DB chaos/restart and review of the new commit remain open.
- Final decision from all three reviews: **BLOCKED**; production forbidden.

No release sign-off is claimed. Re-review, two independent P0/P1 approvals and
the final release judge remain required.

## Re-review of `8106a757`

- Architecture/Security: **APPROVE** the prior P0 central isolation/guard findings (15/15 at that commit); remaining dashboard authentication and route-level integration were explicitly excluded.
- Adversarial/SRE: **APPROVE** the corrupt-snapshot invariant subgate (16/16), but **REJECT** isolation because an unqualified `NODE_ENV=production` was accepted and **REJECT** the TCP-only DB healthcheck.
- Follow-up: unqualified production Node now fails; production-compiled staging requires explicit staging markers. The healthcheck now uses `psql`, verifies a real query and exact database identity. These latest changes are not yet independently signed.
