# Canary Rollout Runbook

No canary was executed.

Required order after G9 external evidence:

1. Confirm migrations/preflight and app compatibility.
2. Enable observability only.
3. Enable T07/T08 shadow for one synthetic tenant and compare decisions.
4. Select one approved pilot tenant, trained dispatchers and test drivers.
5. Elect exactly one Atomic-v2 writer; verify lease/epoch and all kill switches.
6. Enable kitchen hold, then route append, one capability at a time.
7. Monitor unassigned age, conflicts, stale GPS, holds, deadlines, push ACK,
   worker heartbeat, app version failures and manual overrides.
8. Expand only after the observation window has no stop criterion.

Stop on duplicate assignment, partial transaction, writer ambiguity, missed
deadline caused by hold/routing, cross-tenant access, unbounded backlog,
unrecoverable app state, audit gaps or unexplained data-integrity drift.
