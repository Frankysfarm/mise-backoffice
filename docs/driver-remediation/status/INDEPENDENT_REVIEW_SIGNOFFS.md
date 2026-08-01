# Independent review sign-offs

## Fixed commit `8934b878`

- Principal Architecture + Security/Tenant: **REJECT** TL-G0/TL-G1 and staging readiness. Confirmed the CLI guard core (10/10 at reviewed commit) but found the page/API used a weaker policy, DB factory/cleanup absent, suite labels non-selective, sparse evidence and no authentication. The central-guard, suite-selection and evidence findings were corrected after the frozen review; DB factory/authentication still block approval and the correction needs re-review.
- Dispatch/Operations Research: **APPROVE oracle-core only; REJECT TL-G4**. Confirmed independent exhaustive enumeration and 500 seeds, but no production comparison, stored optimality gap, representative generator, complete shrink predicate or full production feature model.
- PostgreSQL/SRE/Adversarial QA: **REJECT TL-G0/TL-G3/TL-G6/TL-G8/TL-G9**. Demonstrated production endpoint/provider credential bypasses, corrupt route snapshots accepted, labels without integrated races/faults, false-positive terminal-push ordering and `up` success against an unreachable database. Isolation endpoint/credential checks, route/pick/tenant/fingerprint checks, temporal push ordering, suite selection and DB healthcheck were hardened afterward; integrated DB chaos/restart and review of the new commit remain open.
- Final decision from all three reviews: **BLOCKED**; production forbidden.

No release sign-off is claimed. Re-review, two independent P0/P1 approvals and
the final release judge remain required.
