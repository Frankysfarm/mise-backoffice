# Paket A — Einheitlicher Listen-Builder (Owner-Review 03.09.)

Owner-Wortlaut (aus Review 03.09.): Liste erstellen → koppeln an Schicht /
Mitarbeiter / Rolle (z.B. alle Filialleiter) → pro Schritt Video/Bilder als
Anleitung + Foto-Nachweis Pflicht/optional → Handy Schritt-für-Schritt;
4-Kachel-Seite (Öffnung/Kontrollen/Reinigung/Aufgaben) konsolidieren.

## Bestandsaufnahme (bereits vorhanden, NICHT neu bauen)

- Foto-Nachweis pro Schritt Pflicht/optional: `procedureStepSchema.evidence`
  (`photo`) + `required`, serverseitige Erzwingung in
  `app/api/ablaeufe/executions/route.ts`, Upload über
  `app/api/operations/responsibility/evidence/route.ts` (Bucket `documents`).
- Schritt-für-Schritt am Handy: `…/schichtleitfaeden/[id]/ausfuehren/`.
- Kopplung an Schicht: Materialisierung `materialize_shift_guide_tasks`
  (source_id `shift_guide:<shift>:<guide>:<emp>`), Eskalation, Pflichtkette.

## Spec (Iterations-Modus)

Was ändert sich:

1. Pro Arbeitsschritt können Anleitungs-Medien (Bilder/Video) hinterlegt und
   dem Mitarbeiter in der Ausführung angezeigt werden.
2. Listen lassen sich zusätzlich an eine Rolle (z.B. alle Filialleiter) oder
   konkrete Mitarbeiter koppeln; tägliche Materialisierung als Aufgaben über
   die bestehende operational_tasks-Pipeline.
3. Die Ablaufe-Kachelseite wird zum konsolidierten Listen-Einstieg.

Darf NICHT kaputtgehen: bestehende Schicht-Kopplung + source_id-Schema,
Foto-Nachweis-Erzwingung, Pflichtkette/Eskalation, RLS/Tenant-Scope,
bestehende `procedure_content`-Inhalte (schemaVersion 1, passthrough).

## Scheiben

- [x] S1 Schema: `media` pro Schritt (zod + normalize, max 5, image/video)
      + Upload-API `/api/ablaeufe/guides/media` (manager+, Bucket `documents`,
      `<tenant>/guides/<guide>/…`, Bild ≤10 MB, Video ≤50 MB mp4/webm).
- [x] S2 UI: Editor-Medienverwaltung pro Schritt; Ausführen-Ansicht zeigt
      Medien über `signUrls`.
- [x] S3 Kopplung: Migration `assignment_kind` ('schicht'|'rolle'|'mitarbeiter'),
      `assigned_role`, Tabelle `shift_guide_assignees`; RPC
      `materialize_direct_guide_tasks(p_now)` (source_id
      `shift_guide:direkt:<liste>:<mitarbeiter>:<datum>`, Reconcile,
      Fehler-Isolation), Cron-Aufruf; Dry-Run auf Factory grün (17/17 OK).
- [x] S4 (Stufe 1) Konsolidierung: Listen-Übersicht als Einstieg, Kopplungs-UI im Editor.

## Restpunkte S4 (Owner-Entscheid nötig)

- Volle Konsolidierung von Kontrollen/Reinigung/Aufgaben in den Listen-Builder
  (eigene Datenmodelle checkup_templates/cleaning_tasks) — Stufe 2, erst nach
  Owner-Feedback zur neuen Listen-Übersicht.

## Offene Ideen (nicht in diesem Paket)

- Schulungs-Backoffice (Paket B), Dienstplan-Vorlagen-UX (Paket C, Owner-Details
  fehlen), Organigramm-Fehler (Paket D, Repro fehlt).
