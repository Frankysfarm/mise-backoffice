# Packet C-F (Codex): Visueller Ablauf-/Listen-Editor statt JSON + geführte Checkliste

Read `2026-08-31-coordination.md`, `2026-08-31-owner-order-verbatim.md`
(point 7) and `2026-08-31-vollausbau-master.md` first.

## Audit first

UI: `app/(neo)/neo/app/ablaeufe/*` (page, kontrollen, reinigung,
schichtleitfaeden) — find the „Barista – Öffnung" flow that currently opens as
raw JSON. Also `app/(neo)/neo/app/mitarbeiter` Schichtabläufe tab and
`operational_task_templates` (steps live in a JSON column?). Identify the
canonical storage for Abläufe/Listen and reuse it; the editor must write the
SAME structure the runtime already consumes, so existing data keeps working.

## Required end state

### Editor (owner, no technical knowledge)

- Types selectable: Öffnung, Schließung, Reinigung, Kontrolle, Produktion,
  Übergabe, Hygiene/Temperatur, Sonstiges.
- Steps: title, optional description/Hinweis, required (Pflicht) toggle,
  evidence requirement: none / Foto / Bestätigung („Ich habe …") / Wert
  (number with unit + optional min/max for Temperatur), assignee hint
  (Rolle/Bereich).
- Add, edit, delete, reorder steps (up/down buttons + drag on desktop);
  duplicate a whole Ablauf; bind to Bereich/Schicht/Standort like existing
  templates.
- Never show JSON. The JSON column stays the storage format; the editor is the
  only owner-facing surface. Add a Zod schema for the step structure and
  validate on save (server side).

### Runtime (employee)

- A step-by-step guided checklist: one clear list, progress, required steps
  block completion, evidence inputs inline (photo upload via existing evidence
  mechanism, value input with range validation and warning text), completion
  timestamp + person. Mobile-first.
- Replace every place where raw JSON is rendered in the normal UI with the
  guided view (grep for JSON.stringify / <pre> in the ablaeufe area).

### Seed

- Migrate the existing seeded Pontstraße templates only if their JSON does not
  validate against the new schema — write an additive, idempotent migration
  that normalizes them; otherwise no data change.

## Tests

Unit: step schema validation, reorder logic, required-step gating, value range
check. Playwright: owner creates Ablauf with 3 steps (one Pflicht with Foto,
one Temperatur with range) → employee runs it → cannot finish until Pflicht
done → finishes → completion recorded.
