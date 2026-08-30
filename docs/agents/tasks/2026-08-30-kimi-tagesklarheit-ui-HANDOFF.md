# Handoff: Tagesklarheit UI (Kimi)

## Built

- `app/(neo)/neo/app/klarheit/page.tsx` – server page that loads today's state
  for a location, scoped to the actor's tenant + location (manager-plus),
  with the same location-picker pattern as `/neo/app/mitarbeiter`.
- `app/(neo)/neo/app/klarheit/klarheit-client.tsx` – read-only client component
  with the four required sections:
  1. Heute im Dienst (shifts grouped by department)
  2. Aufgaben heute (counts per department + overdue list)
  3. Abdeckungslücken (`v_responsibility_coverage` rows)
  4. Abwesend heute (today's absences)
- `app/(neo)/neo/app/klarheit/klarheit.module.css` – mobile-first CSS module
  matching the existing Neo density and color system.
- Added trivial nav entries for `/neo/app/klarheit` in:
  - `app/(neo)/neo/app/shell.tsx` (Neo app shell)
  - `components/layout/sidebar.tsx` (module sidebar)
- `tests/mise-os/tagesklarheit.test.ts` – source + rendering tests for the page.

## Security / scope notes

- No schema changes, no mutations, no new dependencies.
- Absences are now loaded through the location's employee IDs (same pattern as
  `/neo/app/mitarbeiter`) so the payload stays location-scoped.
- Browser payload excludes private HR fields (no e-mails, no notes).

## Tested

- Focused rendering test: `tests/mise-os/tagesklarheit.test.ts` – passes.
- Full unit suite: 212 tests across 32 files – passes.
- Typecheck: `NODE_OPTIONS='--max-old-space-size=4096' node ./node_modules/typescript/bin/tsc --noEmit` – clean.
- `git diff --check` – clean.

## Open / for integration

- E2E/browser evidence is not included (out of scope for this bounded UI packet).
- The page is read-only; task status changes remain in `/neo/app/mitarbeiter`.

## Commit

Branch: `kimi/tagesklarheit-ui` (tip).
- `ae352a8f` – Tagesklarheit page, styles, tests and Neo shell nav entry.
- `bec97195` – Add Tagesklarheit to the operations module sidebar.
