# Packet C-C (Codex): Wiederkehrende Aufgaben + Übergaben mit Bestätigung

Read `2026-08-31-coordination.md`, `2026-08-31-owner-order-verbatim.md`
(points 3 and 4) and `2026-08-31-vollausbau-master.md` first.

## Audit first

Tables: `operational_tasks`, `operational_task_templates`,
`operational_task_evidence`, `responsibility_handovers`, shift tables, the
materialization triggers from `20260830113000` / `20260830183000` and the
escalation sweep from `20260830154500` (`/api/cron/operational-escalations`).
UI: `app/(neo)/neo/app/klarheit`, `app/(neo)/neo/app/mitarbeiter` (Schichtabläufe
tab), `app/(neo)/neo/app/ablaeufe/*`, `app/api/operations/*`. List what exists,
what is hidden, what is missing — then build only the gap.

## Part 1 — Wiederkehrende Aufgaben (owner point 3)

Required end state:

- Owner can create a task ONCE or as a recurring rule. Recurrence options
  (all must be selectable without technical knowledge): täglich, bestimmte
  Wochentage, wöchentlich, monatlich (Tag X oder „erster Montag"), pro Schicht,
  bei Öffnung, bei Schließung, individuell (alle N Tage/Wochen).
- Assignment target: Mitarbeiter, Rolle/Position, Bereich, Schicht, Standort.
  Reuse existing template targeting (`operational_task_templates` +
  department/shift binding) — extend, do not duplicate.
- Each task shows: Fälligkeit, Priorität (niedrig/normal/hoch/kritisch),
  Verantwortlich, Status (offen/in Arbeit/erledigt/überfällig), wer erledigt hat
  und wann.
- Overdue reminders: extend the existing escalation sweep so responsible
  persons (and their Vertretung) get an in-app notification and an e-mail
  (use the existing mail sender pattern in the repo; if none is wired for
  operations, write the notification row and document the mail hook as open).
- A single owner-facing management page for recurring rules: list, create,
  edit, pause, delete, „nächste Fälligkeiten" preview. Mobile-friendly.
- Materialization: a deterministic function that creates due task instances
  from rules (idempotent — running twice creates nothing twice). Unit-test it
  thoroughly (each recurrence kind, DST/Berlin timezone, month-end).

## Part 2 — Übergaben (owner point 4)

Required end state:

- Handover form at shift end: offene Aufgaben (auto-listed), besondere
  Vorkommnisse, Bestände, Schäden, Reinigungsprobleme, wichtige Hinweise;
  optional photo evidence via the existing evidence mechanism.
- The following shift must actively acknowledge: „Gelesen" + „Bestätigt" with
  person and timestamp; unconfirmed handovers are prominently visible to the
  incoming shift and to management.
- Management audit view: who created, who read, who confirmed, when. Filter by
  Standort and date range. Export not required.
- Reuse `responsibility_handovers` if it fits; extend with status/ack columns
  rather than creating a second handover table.

## Tests

Unit tests for recurrence + materialization + ack state machine. Playwright
spec for: create recurring rule → preview → task appears; handover create →
next shift confirms → audit shows chain.
