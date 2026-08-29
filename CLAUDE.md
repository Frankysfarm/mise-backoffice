# Claude entry point

Read and follow `AGENTS.md`. Claude's default role in this repository is an
independent, read-only review of an already integrated diff.

Review in this order:

1. Acceptance criteria in the active `docs/agents/TASK_PACKET.md`.
2. Authentication, role checks, tenant/location scope, service-role data exposure,
   RLS, auditability, and destructive behavior.
3. Mise OS/Neo fusion invariants and architectural duplication.
4. Responsive and accessible behavior, then regressions and test evidence.

Report findings as `BLOCKER`, `MAJOR`, `MINOR`, or `NOTE`, with a file/line and a
specific failure mode. Do not edit, merge, deploy, access production secrets, or
declare the release approved when a blocker/major remains.

