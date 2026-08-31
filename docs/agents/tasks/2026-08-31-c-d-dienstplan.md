# Packet C-D (Codex): Dienstplan-Vorlagen, Verfügbarkeits-Loop, KI-Vorschlag, Veröffentlichung, Konflikt-Engine

Read `2026-08-31-coordination.md`, `2026-08-31-owner-order-verbatim.md`
(point 5) and `2026-08-31-vollausbau-master.md` first.

## Audit first

UI: `app/(neo)/neo/app/dienstplan/` (page, `templates`, `swap-requests`),
employee app views of shifts. API: `app/api/operations/schedule-suggestions`,
table `weekly_shift_assignment_suggestions`, shift/availability/absence tables
from the mise-os fusion, the Wochen-Dienstplan-Assistent with Begründungen from
`20260830154500`. List what exists, what is hidden, what is missing.

## Required end state

### Vorlagen (owner-operable)

- Create / edit / copy / delete Dienstplanvorlagen. A template defines shifts
  (name, Bereich, start/end, break) and required positions with headcount per
  weekday and time window (Personalbedarf pro Tag, Uhrzeit, Bereich).
- „Vorlage auf Woche anwenden": one click creates the week's open shifts;
  re-applying does not duplicate (idempotent, warns on existing plan).

### Verfügbarkeits-Loop

1. Owner opens the week (from template or manually) and sets an
   Eintragungsfrist.
2. Employees are reminded in-app AND by e-mail to enter availability (reuse
   the repo's existing mail/notification mechanism; if none exists for this,
   write the notification rows and document the e-mail hook as open — never
   fake sending).
3. Employee app: see offered shifts/times, mark availability („kann", „möchte",
   „kann nicht"), apply for concrete shifts.
4. After the deadline: owner button „Dienstplan vorschlagen".
5. Proposal engine: deterministic, testable scoring using Verfügbarkeit,
   Qualifikation/Position, Bereich, Arbeitszeiten, Vertragsstunden, Pausen-/
   Ruhezeitregeln, Verantwortlichkeiten (Hauptverantwortung/Stellvertretung).
   Reuse/extend the existing suggestion engine — do not build a second one.
   Every assignment carries a short German reason. An LLM may be used only
   as an optional explainer, never as the source of truth for assignments.
6. Open or problematic shifts are clearly flagged (unbesetzt, Konflikt,
   Unterbesetzung) with the reason.
7. Owner edits manually (drag or select), conflicts re-evaluate live.
8. „Dienstplan veröffentlichen": only then binding. Status draft → published.
9. On publish, every affected employee gets an in-app notification (+ e-mail
   hook as above); employee app shows own shifts.
10. Later changes to a published plan create a change record and notify only
    affected employees; employees can see „geändert seit Veröffentlichung".

### Konflikt-Engine (must exist as a pure, unit-tested function)

Detect: Doppelbelegung, fehlende Qualifikation/Position, Ruhezeit < 11 h,
Urlaub/Abwesenheit, Krankheit, Überschreitung Vertrags-/Planstunden (Woche),
Minderjährige/Nachtarbeit only if data exists (otherwise skip, don't invent).
Return structured conflicts with severity and German text.

## Tests

Unit: template apply idempotency, availability state, proposal scoring,
conflict engine (one test per conflict kind), publish/change notifications.
Playwright: owner template → week → (mock availability) → propose → publish →
employee sees shift.
