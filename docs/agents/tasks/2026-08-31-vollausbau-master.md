# Master plan: Mais Gastro Vollausbau (owner order 2026-08-31)

Owner order: complete the full A–Z operations flow (Bewerbung → Test →
Einstellung → Profil → Bereich → Onboarding/Schulung → Verfügbarkeit →
Dienstplan → Aufgaben/Schichtabläufe → Übergaben → Kontrollen → Lager/Inventur),
usable without technical knowledge, desktop + mobile.

Standing rules for every packet (from the owner, binding):

1. AUDIT FIRST: before building, read the existing code/DB for your area and
   list what exists, what is hidden, what is missing. Reuse existing tables,
   routes and UI patterns. NO duplicate/parallel systems.
2. Never regress working areas. Additive migrations only, same RLS/security
   pattern as `save_shift_operational_template` (tenant + location scope in SQL,
   service-role RPCs for privileged writes).
3. German owner-friendly UI, honest empty states, mobile-first where staff use
   it. NEVER show JSON or technical data in normal UI.
4. After each packet: unit tests + typecheck + build green; targeted Playwright
   for the new flows; note evidence in docs/agents/HANDOFF.md; Claude reviews
   before the next wave integrates.
5. Deployment only at the end, only by Codex, per the proven jump-host
   procedure and fixed auto-deploy.sh.

## Waves

- Wave 1 (parallel):
  - C-A (Codex): Bewerbungstests-Verwaltung + Schulungen/Onboarding + Übernahme-
    Wiring (Punkte 1+8) — packet `2026-08-31-c-a-bewerbungstests-schulungen.md`
  - K-B (Kimi, worktree): Organigramm-UX, Profilbilder, Drag&Drop, mobile
    (Punkt 2) — packet `2026-08-31-k-b-organigramm-profil.md`
- Wave 2: C-C recurring tasks + handover confirmations (Punkte 3+4);
  C-D Dienstplan-Vorlagen + Verfügbarkeits-Loop + Publish + Konflikt-Engine
  (Punkt 5).
- Wave 3: C-E Lagerplan + QR-Lagerplätze (Punkt 6); C-F visueller Ablauf-Editor
  statt JSON (Punkt 7).
- Wave 4: Persona-E2E (Bewerber/Mitarbeiter/Schichtleitung/Filialleitung/
  Admin), Doku (was war da / was geändert / DB-Änderungen / was getestet),
  final Claude review, deploy.

Known state 31.08.: production runs release 87320087 on mise-gastro.de; the
responsibility/shift-task/briefing/escalation/suggestion layer is live.
GitHub origin/main is a stale mirror — never rebase onto it.
