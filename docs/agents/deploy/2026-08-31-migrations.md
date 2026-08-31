# Vollausbau-Migrationen — 2026-08-31

Ausgangspunkt ist Produktionsrelease `87320087`. Die Dateien werden exakt in dieser Reihenfolge angewendet. Alle Dateien sind additiv, explizit mit `begin; … commit;` gekapselt und wurden gemeinsam gegen den Produktionsschema-Snapshot geprüft.

1. `20260831100944_application_assessments_training_onboarding.sql` — Bewerbungstests, versionierte Fragen/Ergebnisse, Schulungszuweisung und Onboarding-Verknüpfung; stellt `pgcrypto` auch bei vorhandener Installation verbindlich im Schema `extensions` bereit; Rollback: Funktionen/Policies deaktivieren, neue Daten erhalten, keine Employee-/Training-Spalten entfernen.
2. `20260831115000_employee_avatars.sql` — `employees.avatar_url` und öffentlicher, serverseitig beschriebener Avatar-Bucket; Rollback: Upload-UI deaktivieren, Bucket/Spalte wegen bestehender Referenzen nicht löschen.
3. `20260831120000_recurring_tasks_and_handover_ack.sql` — Wiederholungsregeln, Materialisierung und strukturierte Übergaben mit Lesen/Bestätigen; Rollback: Cron-Aufruf stoppen und neue Regeln deaktivieren, Audit- und Übergabedaten behalten.
4. `20260831120100_recurring_tasks_escalation_enum_fix.sql` — korrigiert die Eskalationsart für wiederkehrende Aufgaben; Rollback: nicht separat zurückrollen, da die vorherige Enum-Verwendung Laufzeitfehler erzeugt.
5. `20260831130000_schedule_planning_loop.sql` — Planungswochen, Verfügbarkeiten, Vorlagen, Vorschläge, Veröffentlichung und Änderungsbenachrichtigungen; Rollback: Planungsaktionen sperren, veröffentlichte Schichten und Benachrichtigungsaudit erhalten.
6. `20260831140000_inventory_warehouse_plan.sql` — hierarchischer Lagerplan, QR-Tokens und Lagerplatz-Aktions-RPCs; Rollback: neue UI/RPCs deaktivieren, Hierarchie- und Token-Spalten wegen gebuchter Bestände behalten.
7. `20260831140100_inventory_warehouse_plan_review_fixes.sql` — sichere Löschung, kanonische Bewegungs-Enums, QR-Inventur und Umlagerungskorrekturen; Rollback: nicht einzeln zurückrollen, da es Produktionsschema-Kompatibilität herstellt.
8. `20260831150000_visual_shift_guide_editor.sql` — visuelle Ablaufstruktur, normalisierte Schritte, Ausführungs-Snapshots und Ablaufkategorie; Rollback: Editor/Ausführung deaktivieren, gespeicherte Definitionen und Ergebnisse behalten.

## Dry-Run-Beleg

```text
NOTICE:  database "dryrun_2" does not exist, skipping
restore: 0 errors (extension/duplicate noise expected), tables=243
OK   20260831100944_application_assessments_training_onboarding.sql
OK   20260831115000_employee_avatars.sql
OK   20260831120000_recurring_tasks_and_handover_ack.sql
OK   20260831120100_recurring_tasks_escalation_enum_fix.sql
OK   20260831130000_schedule_planning_loop.sql
OK   20260831140000_inventory_warehouse_plan.sql
OK   20260831140100_inventory_warehouse_plan_review_fixes.sql
OK   20260831150000_visual_shift_guide_editor.sql
```

Keine Datei außerhalb dieser Liste ist seit `87320087` neu. Es gibt keine doppelt angelegten Objekte zwischen den Paketen; Korrekturdateien verwenden bewusst `create or replace` mit identischen Funktionssignaturen.
