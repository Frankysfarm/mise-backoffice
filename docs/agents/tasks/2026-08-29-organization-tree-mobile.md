# Task packet: Verantwortungslinie und Mitarbeiter-PWA

## Identity

- Owner: Codex
- Role: integration
- Base commit: `2b09cfcc`
- Branch: `codex/neo-module-integration-20260826`
- Independent review: repository reviewer; Claude CLI attempted read-only but not authenticated

## Outcome

Managers receive a responsive, actively editable responsibility tree. Employees
see only their personal leadership path, own responsibilities, counterpart and
direct team inside the same mobile PWA as their schedule.

## Acceptance criteria

- [x] Desktop tree has explicit levels, connectors, responsibility/task signals,
  unassigned lines, collapse controls and touch-friendly manager assignment.
- [x] Mobile tree is vertical, clipped nowhere at 390 px, and has 44 px controls.
- [x] Employee PWA shows leadership chain, self, direct reports, responsibilities,
  primary/deputy counterpart and tasks without receiving the full team dataset.
- [x] Non-company-wide roles cannot mutate another location.
- [x] Department/task/handover references cannot cross locations.
- [x] Responsibility authorization and coverage respect Europe/Berlin weekday,
  shift time and overnight continuation.
- [x] Reporting-line cycles terminate safely and are rejected at API and DB level.
- [x] Organization changes are atomically audit logged with actor and before/after.
- [x] Mise OS remains fused into Neo; no parallel hierarchy source is introduced.

## Exclusive file boundary

- Organization UI: `app/(neo)/neo/app/mitarbeiter/**`
- Employee PWA: `app/mitarbeiter/page.tsx`, `app/mitarbeiter/my-operations.tsx`
- Operations API/scope: `app/api/operations/responsibility/**`,
  `lib/operations/responsibility-scope.ts`
- Database/test/docs: migration `20260829204500`, test `075`, this agent contract
- No production secrets or unrelated product files

## Verification

- Focused Vitest: 10 passed across fusion/responsibility suites.
- Changed-source TypeScript and warning-free ESLint: passed.
- Isolated PostgreSQL: migration plus `075_responsibility_organization_hardening.sql`
  passed for overnight time, cross-location rejection, audit actor and cycles.
- Full Vitest: 31 files / 210 tests passed; Next.js production build passed.
- Independent re-review: `PASS`, no remaining blocker or major finding.
- Authenticated production desktop/mobile: required after deployment.

## Rollback

Application rollback may return to the previous release. The database migration
is additive/backward-compatible and should remain applied: it only strengthens
scope validation, corrects the coverage read model, adds organization guards and
adds an RPC unused by the prior release.
