# Packet K-B (Kimi): Organigramm-UX, Profilbilder, Mobile (owner point 2)

Read `2026-08-31-vollausbau-master.md` in the Codex worktree
(/Users/eule/mise-neo-module-integration-20260826/docs/agents/tasks/) — its
standing rules apply. Work ONLY in your own worktree.

## Audit first

`app/(neo)/neo/app/mitarbeiter/` (page, responsibility-client, CSS module) —
the Organigramm tab, drag&drop (dnd-kit) and Bereiche already exist. List what
exists, what is confusing, what is missing before changing anything.

## Required end state

1. **Organigramm readability**: at a glance, who reports to whom and who is
   responsible for which Bereich. Show per person: Avatar, Name, Positionstitel,
   Bereich chip, and badges for Hauptverantwortung/Stellvertretung. Clear
   visual hierarchy lines. Unassigned employees in a clearly labeled group with
   a hint how to assign them.
2. **Profilbild**: employees get an avatar. Upload UI in the Mitarbeiter area
   (owner/manager can set it; employee app can set their own on their profile
   page if one exists). Store via ONE new small API route + Supabase storage
   bucket `avatars` (public read, authenticated scoped write) — this is your
   single allowed mutation surface; keep it minimal and tenant-scoped, follow
   the existing route auth pattern in app/api/operations/responsibility/route.ts.
   Fallback: initials avatar (already common in the codebase).
3. **Zuordnung per Auswahl UND Drag&Drop**: keep dnd-kit drag; add an equally
   capable select-based fallback (works on mobile): choose employee → choose
   Vorgesetzte(r) → choose Bereich → save.
4. **Vertretungen verständlich**: where a Stellvertretung exists, show it in
   plain German on the Bereich card and in the Organigramm.
5. **Mobile**: the whole Mitarbeiter area must be genuinely usable on a phone
   (no horizontal page scroll; org chart gets a mobile list/accordion view).

## Boundaries

- Worktree: /Users/eule/mise-neo-kimi-organigramm (branch kimi/organigramm-ux),
  created for you from the current codex branch HEAD.
- May edit: mitarbeiter UI (neo + employee app profile view), the ONE avatar
  upload route, one additive migration ONLY if an avatar_url column is missing
  on employees, matching tests, a handoff note in docs/agents/tasks/.
- NO other schema changes, NO other API mutations, NO edits outside these.
- German microcopy, honest empty states, no JSON in UI.
- Node: /Users/eule/.nvm/versions/node/v22.23.0/bin/node directly.

## Done means

Audit summary + implementation + green gates (full unit suite + typecheck;
add rendering tests for org chart and avatar fallback) + handoff note with
what you decided. Commit on your branch; no merge, no deploy.
