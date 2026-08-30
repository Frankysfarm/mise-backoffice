# Task packet: Tagesklarheit page (Kimi)

## Identity

- Task: Build the read-only "Tagesklarheit" page — one screen that answers,
  at a glance: who works today, what is open or overdue, which areas are
  uncovered, what escalated.
- Owner: Kimi (bounded UI packet)
- Worktree: `/Users/eule/mise-neo-kimi-tagesklarheit`, branch
  `kimi/tagesklarheit-ui`, base commit 50b554e9. Work ONLY there.
- Requested by: business owner, 2026-08-30. Codex integrates your branch.

## Outcome

A manager or the owner opens `/neo/app/klarheit`, picks a location (same
pattern as `/neo/app/mitarbeiter`), and sees today's state without clicking
anything else. Mobile-first: this is read standing in the kitchen at 07:30.

## Scope — strictly read-only UI

- New route `app/(neo)/neo/app/klarheit/page.tsx` + client component + CSS
  module. Server component loads data with the existing service-role pattern
  (copy the loader style of `app/(neo)/neo/app/mitarbeiter/page.tsx`,
  including tenant + location scoping and the actor check).
- Sections, in this order:
  1. **Heute im Dienst**: today's shifts (employee, department, time, position),
     grouped by department; empty state if none.
  2. **Aufgaben heute**: open/overdue `operational_tasks` counts per department
     with the overdue ones listed (title, assignee, due time, escalation level).
  3. **Abdeckungslücken**: rows from `v_responsibility_coverage` where
     abdeckungsstatus <> 'abgedeckt', in plain German.
  4. **Abwesend heute**: absences for today.
- Reuse existing German labels/status maps from `responsibility-client.tsx`
  rather than inventing new wording. Times always Europe/Berlin.
- Add a sidebar/navigation entry only if the nav config is data-driven and
  trivial; otherwise leave navigation to Codex and note it in the handoff.

## Hard boundaries

- NO schema changes, NO migrations, NO API mutations, NO new dependencies,
  NO edits outside `app/(neo)/neo/app/klarheit/` except one nav entry if
  trivial. Read-only queries only.
- No private HR fields (no emails, no notes) in the browser payload — names,
  roles, shift and task context only.

## Design bar

Match the existing Neo look (CSS modules like `responsibility.module.css`):
calm, dense, mobile-first, real German microcopy, honest empty states
("Heute keine Schichten geplant" etc.), no generic AI-look cards. Overdue and
uncovered items must be visually unmissable without being noisy.

## Verification

- `npm` unavailable via shell functions on this Mac — use
  `/Users/eule/.nvm/versions/node/v22.23.0/bin/node` directly if needed.
- Typecheck the changed files and run the existing unit suite
  (`node ./node_modules/vitest/vitest.mjs run`) — must stay green.
- Add one rendering test for the page's client component (follow
  `tests/mise-os/responsibility-organization.test.ts` style).
- Finish with a short handoff note in `docs/agents/tasks/` (what you built,
  what you tested, what is open) and commit on your branch. Do not merge,
  do not deploy.
