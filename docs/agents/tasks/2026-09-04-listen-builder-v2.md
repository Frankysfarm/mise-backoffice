# Listen-Builder v2 — „Eine Liste" (Owner-Auftrag 04.09. abends)

Owner-Wortlaut: Die Aufteilung Listen/Checklisten/Reinigung/Operatives bringt
durcheinander. Ein besseres Konzept: perfekte Listen erstellen, zuteilbar an
zuständigen Mitarbeiter, Schicht, Gruppe oder sonstiges, **nach Zeit**.
Design/Strategie/Psychologie müssen passen.

Owner-Entscheid (04.09., abgefragt): **Nur Builder heute perfektionieren;
Migration der Altbereiche (Checklisten/Reinigung → Listen) als separates
Folge-Release.** Operative Aufgaben bleiben dauerhaft eigener Bereich
(Einzelaufgaben, keine Listen).

## Konzept

Eine mentale Einheit „Liste": Schritte (mit Bild/Video-Anleitung und
Nachweis) + genau eine Zuweisung + ein Zeitplan. Der Typ (Öffnung, Reinigung,
Kontrolle …) ist nur ein farbiges Etikett, kein eigener Bereich.

## Scope heute (Release „Builder v2")

- [x] S1 Migration `20260904190000_listen_zeitplan.sql`:
      - `shift_guides.schedule_weekdays smallint[]` (ISO 1=Mo…7=So, NULL=täglich)
      - `shift_guides.due_time time` (NULL ⇒ 18:00)
      - `shift_guides.assigned_department_id uuid` + assignment_kind `'bereich'`
        (Gruppe = alle aktiven Mitarbeiter des Bereichs, standortgebunden)
      - `materialize_direct_guide_tasks` v2: nur an gewählten Wochentagen,
        Fälligkeit = Tag + due_time (Europe/Berlin), Bereichs-Zweig,
        Reconcile entsprechend. Dry-Run + Verhaltenstest Pflicht.
- [x] S2 Anlegen: `POST /api/ablaeufe/guides` (Neu-Erstellen mit Vorlage),
      Vorlagen in `lib/ablaeufe/list-templates.ts` (Leer, Öffnung, Schließung,
      Reinigung, Kontrolle — je 3–6 sinnvolle Starter-Schritte).
      Save-Schema: `assignmentKind` +`'bereich'`, `assignedDepartmentId`,
      `scheduleWeekdays` (1–7, unique), `dueTime` (HH:MM).
- [x] S3 UI:
      - Listen-Seite: großer „+ Neue Liste"-Dialog (Name, Typ, Vorlage),
        Filter-Chips nach Typ, Zuweisungs-/Zeitplan-Spalte.
      - Editor: Zuweisung „An einen Bereich" + Zeitplan-Block
        (Wochentags-Toggles Mo–So + Uhrzeit) für Rolle/Bereich/Mitarbeiter.

Darf NICHT kaputtgehen: Schicht-Kopplung/Phasen, deployte v1-Kopplung
(Rolle/Mitarbeiter, bisher täglich 18:00 — bleibt Default), Eskalation,
Medien-Pfadschutz, RLS.

## Folge-Release (nicht heute)

Migration checkup_templates + cleaning_tasks/zones → Listen; alte Menüpunkte
leiten auf „Listen" um; Historie bleibt lesbar.
