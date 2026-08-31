# Packet C-INT (Codex Integrator): merge all Vollausbau packets, fix review findings, full gate

Read `2026-08-31-coordination.md`, `2026-08-31-owner-order-verbatim.md`,
`2026-08-31-vollausbau-master.md` first. You work in the base clone
`/home/openclaw/factory/workspaces/codex-builder/runs/mise-neo/vollausbau-20260831`
on a NEW branch `vollausbau/integration` created from
`codex/neo-module-integration-20260826` (HEAD). node_modules here is
writable (it is the real directory, not a symlink).

## Inputs

Branches (each has a report in `docs/agents/reports/` and a Claude review in
`docs/agents/reviews/`): `vollausbau/k-b` (Kimi, based on 86689d1c),
`vollausbau/c-a`, `vollausbau/c-c`, `vollausbau/c-d`, `vollausbau/c-e`,
`vollausbau/c-f` (all based on e401d12).

## Steps

1. Merge in this order, one merge commit each, resolving conflicts by hand
   with the owner order as tie-breaker: k-b, c-a, c-f, c-c, c-d, c-e.
   Never drop a feature to make a conflict go away. After EACH merge run
   `./node_modules/.bin/tsc --noEmit -p .` and fix before the next merge.
2. Read all six reviews. Fix every BLOCKER and MAJOR. Fix MINORs unless the
   fix is risky; list skipped MINORs with reason in your report.
3. Coherence pass (owner point 9 — one connected process):
   - ONE navigation for Neo: Bewerbungen (+Bewerbungstests), Mitarbeiter
     (Organigramm, Profil), Schulungen, Dienstplan, Aufgaben (einmalig +
     wiederkehrend), Abläufe (Editor + Ausführen), Übergaben, Lager
     (Lagerplan + QR). Every new page reachable within 2 clicks from the Neo
     shell on desktop and mobile; no orphan routes; consistent German labels.
   - Cross-links where the process flows: passed Bewerbungstest → Einstellung
     → Profil → Onboarding-Schulung; Dienstplan-Schicht → Schichtablauf →
     Übergabe → nächste Schicht bestätigt; Lagerplatz → Inventur-Abweichung →
     Bestellvorschlag. Data entered once must be reused, not re-entered.
   - Remove any duplicated helper/component that two packets created
     independently (e.g. two notification helpers, two avatar components);
     keep one, update imports.
4. Migrations: list all new files in `supabase/migrations/2026083*` in
   filename order; check every one is wrapped in an explicit transaction,
   additive, idempotent, and that no two files create the same object. Fix
   ordering dependencies (e.g. a later file must not depend on an object a
   later-named file creates). Write `docs/agents/deploy/2026-08-31-migrations.md`
   with the ordered list and one line per file: what it creates, rollback note.
5. Full gate on the integration branch (all must be green, record exact
   output counts in the report): `./node_modules/.bin/vitest run`,
   `./node_modules/.bin/tsc --noEmit -p .`, `./node_modules/.bin/next build`,
   `git diff --check`. Playwright: run every spec that can run without a DB
   (mocked); list the ones gated on `E2E_AUTH_STATE` as ready-not-run.
6. Persona walkthrough document `docs/agents/reports/2026-08-31-persona-e2e.md`:
   for Bewerber, Mitarbeiter, Schichtleitung, Filialleitung, Admin — the exact
   click path through the whole A–Z process on desktop and mobile, what they
   should see at every step, which empty states and error messages exist.
   This is the owner's manual test plan after deployment; be concrete.
7. Append a section to `docs/agents/HANDOFF.md`: „Vollausbau 2026-08-31 —
   was war da / was geändert / DB-Änderungen / was getestet / offen".
8. Report `docs/agents/reports/2026-08-31-c-int.md` (same structure as the
   packets) and commit everything on `vollausbau/integration`.

Do not deploy. Do not touch production. No questions; decide and document.
