# Task packet: Pre-deploy operational hardening

## Identity

- Task: Close the three non-gating SQL follow-ups from the final daily clarity
  review.
- Owner: Codex
- Role: integration
- Base commit: `fcd7f6cd`
- Branch/worktree: `codex/neo-module-integration-20260826`
- Requested by: business owner, 2026-08-30

## Outcome

Malformed operational tasks fail closed during actor updates, schedule suggestion
generation and confirmation share an acyclic lock order, and historical shift
imports do not create stale work after a documented grace period.

## Acceptance criteria

- [x] Nullable participant and reviewer membership checks use
      `coalesce(...,false)` and a malformed-row SQL regression covers both paths.
- [x] Confirmation acquires the same tenant/location/week advisory lock as
      generation before any row lock; the installed function order is tested.
- [x] Shift inserts and material updates ending more than 12 hours ago do not
      materialize tasks; current and delayed same-day writes retain existing
      behavior.
- [x] All database changes are in one new additive migration; committed
      migrations are unchanged.
- [x] Full unit, SQL, TypeScript, build, and Playwright gates pass with pinned
      Node 22.23.0.
- [x] Independent Claude review returns `PASS` with no blocker or major.
- [x] No deployment or production database operation occurs.

## Exclusive file boundary

- May edit: one new additive migration, SQL suites `076` and `077`, their Vitest
  contract files, this packet, and `docs/agents/HANDOFF.md`.
- Read-only context: committed migrations `20260830113000` and `20260830154500`,
  application/API code, other SQL suites.
- Must not touch: existing migration contents, production data, Supabase Auth,
  unrelated tenants/locations, or deployment configuration.

## Security and data scope

- Roles in scope: service-role RPC execution on behalf of validated active
  employees; manager/backoffice/admin authorization remains unchanged.
- Tenant/location rules: existing tenant, location, role, qualification,
  availability, and overlap checks are preserved verbatim.
- Sensitive fields allowed in the browser: none added; this packet is SQL-only.
- Schema/RLS impact: `create or replace function` only. Existing grants remain
  service-role-only for RPCs; security-definer search paths stay pinned.

## Verification

- Focused tests: suites `076`/`077` on PostgreSQL 16.13 and the responsibility/
  daily-clarity Vitest files.
- Full gates: 34 Vitest files / 222 tests, delivery and full TypeScript checks,
  227-page Next.js build, 28 Playwright checks, `git diff --check`.
- Browser viewports and authenticated flows: no UI behavior changed; repository
  smoke coverage runs Desktop Chrome and Pixel 5 against a disposable local
  Supabase-protocol fixture.
- Evidence to record: migration chain order, regression markers, 12-hour import
  policy, independent verdict, commit, rollback, and no-deploy state.

## Handoff

- Commit: recorded in `docs/agents/HANDOFF.md` after integration.
- Known risks: the lock-order regression inspects installed function structure;
  a two-session exact interleave remains stronger optional evidence.
- Reviewer required: Claude read-only integrated-diff review — `PASS`, no blocker
  or major; all three original follow-ups closed.
- Rollback: before deployment, revert the implementation commit. After migration,
  restore the prior three function bodies in a new additive migration; do not
  edit migration history or drop operational data.
