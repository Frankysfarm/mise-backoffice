# Packet C-A (Codex): Bewerbungstests-Verwaltung + Schulungen/Onboarding

Read `2026-08-31-vollausbau-master.md` first; its standing rules apply.

## Part 1 — Bewerbungstests (owner point 1)

Audit first: `app/(neo)/neo/app/tests/` (incl. `ergebnisse/[id]`),
`app/(neo)/neo/app/bewerbungen/`, related API routes and tables. Much may exist
but be hard to find.

Required end state, owner-operable without technical knowledge:

- A clearly reachable management area for Bewerbungstests (link it from the
  Bewerbungen page header AND the sidebar if it is hidden today).
- CRUD for tests: create/edit/duplicate/delete; per test: questions with
  answer options, correct answers, per-question points; add/remove/reorder
  questions (drag or up/down buttons — mobile friendly).
- Multiple tests per Stelle/Bereich: a test is assignable to job postings or
  departments so the right test reaches the right applicant.
- Scoring: passing threshold (%), optional per-question must-pass.
- Result visible inside the Bewerbung detail page: score, pass/fail, answers.
- Configurable outcome: on pass / on fail choose next step (e.g. move
  application to next stage, auto-reject with friendly text, manual review).
- Applicant-facing test flow must stay simple and mobile-first.

## Part 2 — Schulungen & Onboarding (owner point 8)

Audit first: `app/(neo)/neo/app/schulungen/` (page, `new`, `ai-create`,
`[id]`), training tables (`training_modules`, `training_progress`, attempts,
certMode from mise-os fusion).

Required end state:

- Owner can create/edit trainings with sections: text, images, video links,
  documents, and quiz questions; assign by Position/Bereich/Standort;
  mark Pflicht vs. freiwillig; set passing threshold, deadline (days after
  assignment) and recurrence (e.g. yearly re-certification).
- Onboarding link: when an applicant is hired (Übernahme aus Bewerbung), the
  system offers/creates the employee profile AND auto-assigns the onboarding
  trainings matching the target Position/Bereich/Standort. Existing employees
  can be assigned any training at any time (single or bulk).
- Progress dashboard for owner: per employee open/started/passed/overdue.
- Employee app view: my trainings with clear status (offen/begonnen/bestanden/
  überfällig), mobile-first.
- Overdue trainings feed the existing escalation/briefing layer (reuse it —
  do not build a second reminder system).

## Boundaries

- May edit: tests/bewerbungen/schulungen UI+API, employee-app training views,
  additive migrations, matching tests, agent docs.
- Do not touch: POS/orders, lager, dienstplan, ablaeufe (other packets),
  Supabase Auth users beyond the existing hire flow.
- Node: /Users/eule/.nvm/versions/node/v22.23.0/bin/node directly.

## Done means

Audit summary (existed/hidden/missing) + implementation + green gates
(unit/typecheck/build + targeted Playwright for: owner creates test → assigns
to posting → applicant takes test → result in application → hire → onboarding
auto-assigned → employee sees training) + HANDOFF evidence. Commit; no deploy.
