# Vollausbau-Migrationen — 2026-08-31

Ausgangspunkt ist Produktionsrelease `87320087`. Die Dateien werden exakt in dieser Reihenfolge angewendet. Alle Dateien sind explizit mit `begin; … commit;` gekapselt und wurden gemeinsam gegen den Produktionsschema-Snapshot geprüft. **Produktions-Precondition:** Vor Datei 1 muss ein verifizierbares Datenbank-Backup mit dokumentiertem Restore-Punkt vorliegen. Vor Datei 8 müssen außerdem die unten stehenden Scope-Abfragen auf Produktion null Zeilen liefern.

1. `20260831100944_application_assessments_training_onboarding.sql` — Bewerbungstests, versionierte Fragen/Ergebnisse, Schulungszuweisung und Onboarding-Verknüpfung; stellt `pgcrypto` auch bei vorhandener Installation verbindlich im Schema `extensions` bereit. **Nicht additiv:** Die Migration dedupliziert `training_progress` per `DELETE` vor dem Unique-Index und überschreibt bei bestehenden `assessment_templates` die Felder `status` und `slug`. Das Backup ist deshalb zwingend. Rollback: Funktionen/Policies deaktivieren und neue Daten erhalten; gelöschte Duplikate sowie vorherige Template-Werte ausschließlich aus dem Pre-Deploy-Backup wiederherstellen; den `pgcrypto`-Schemawechsel nur nach Abhängigkeitsprüfung rückgängig machen; keine Employee-/Training-Spalten entfernen.
2. `20260831115000_employee_avatars.sql` — `employees.avatar_url` und öffentlicher, serverseitig beschriebener Avatar-Bucket; Rollback: Upload-UI deaktivieren, Bucket/Spalte wegen bestehender Referenzen nicht löschen.
3. `20260831120000_recurring_tasks_and_handover_ack.sql` — Wiederholungsregeln, Materialisierung und strukturierte Übergaben mit Lesen/Bestätigen; Rollback: Cron-Aufruf stoppen und neue Regeln deaktivieren, Audit- und Übergabedaten behalten.
4. `20260831120100_recurring_tasks_escalation_enum_fix.sql` — korrigiert die Eskalationsart für wiederkehrende Aufgaben; Rollback: nicht separat zurückrollen, da die vorherige Enum-Verwendung Laufzeitfehler erzeugt.
5. `20260831130000_schedule_planning_loop.sql` — Planungswochen, Verfügbarkeiten, Vorlagen, Vorschläge, Veröffentlichung und Änderungsbenachrichtigungen; Rollback: Planungsaktionen sperren, veröffentlichte Schichten und Benachrichtigungsaudit erhalten.
6. `20260831140000_inventory_warehouse_plan.sql` — hierarchischer Lagerplan, QR-Tokens und Lagerplatz-Aktions-RPCs; Rollback: neue UI/RPCs deaktivieren, Hierarchie- und Token-Spalten wegen gebuchter Bestände behalten.
7. `20260831140100_inventory_warehouse_plan_review_fixes.sql` — sichere Löschung, kanonische Bewegungs-Enums, QR-Inventur und Umlagerungskorrekturen; Rollback: nicht einzeln zurückrollen, da es Produktionsschema-Kompatibilität herstellt.
8. `20260831150000_visual_shift_guide_editor.sql` — visuelle Ablaufstruktur, normalisierte Schritte, Ausführungs-Snapshots und Ablaufkategorie; Rollback: Editor/Ausführung deaktivieren, gespeicherte Definitionen und Ergebnisse behalten.
9. `20260831160000_vollausbau_review_corrections.sql` — korrigiert Assessment-Mengenvergleich, Dienstplan-Kandidatenstatus, Schulungs-Akteurstatus, Template-RLS, Dienstplan-Audit/Benachrichtigungen sowie Inventur-/Umlagerungsaudit; Rollback: betroffene RPC-/Triggerdefinitionen aus dem unmittelbar vor Datei 9 erstellten Schema-Backup wiederherstellen; die neuen RLS-Policies nur gemeinsam mit einer gleichwertigen serverseitigen Sperre entfernen.

## Produktionsprüfung vor dem Deploy

Diese Abfrage muss durch den Operator **auf Produktion vor dem Deploy** ausgeführt werden. Der Deploy darf nur fortgesetzt werden, wenn beide Resultsets leer sind. Treffer müssen vorab anhand von Tenant und Standort eindeutig ergänzt werden; Datei 8 bricht bei Mehrdeutigkeit absichtlich ab.

```sql
with tenant_fallback as (
  select min(id) as tenant_id from public.tenants having count(*)=1
), resolved as (
  select g.id,g.titel,g.department_id,
    coalesce(d.tenant_id,tf.tenant_id) as tenant_id,
    d.location_id
  from public.shift_guides g
  left join public.departments d on d.id=g.department_id
  left join tenant_fallback tf on true
)
select 'shift_guides' as source_table,r.id,r.titel,r.department_id
from resolved r
where r.tenant_id is null
   or coalesce(r.location_id,(
     select min(l.id) from public.locations l
     where l.tenant_id=r.tenant_id having count(*)=1
   )) is null;

with tenant_fallback as (
  select min(id) as tenant_id from public.tenants having count(*)=1
), resolved as (
  select t.id,t.titel,t.department_id,
    coalesce(l.tenant_id,d.tenant_id,tf.tenant_id) as tenant_id,
    coalesce(t.location_id,d.location_id) as location_id
  from public.checkup_templates t
  left join public.locations l on l.id=t.location_id
  left join public.departments d on d.id=t.department_id
  left join tenant_fallback tf on true
)
select 'checkup_templates' as source_table,r.id,r.titel,r.department_id
from resolved r
where r.tenant_id is null
   or coalesce(r.location_id,(
     select min(l.id) from public.locations l
     where l.tenant_id=r.tenant_id having count(*)=1
   )) is null;
```

Für bestehende Abläufe mit einem anderen Legacy-JSON-Format als `categories[]` erfolgt keine massenhafte, verlustbehaftete Umschreibung; die TypeScript-Normalisierung zeigt sie sicher als leere editierbare Struktur. `training_modules.recurrence_months` ist die führende Quelle, `gültig_monate` bleibt vorerst als Legacy-Kompatibilitätsfeld gespiegelt. Englische RPC-Texte werden an den API-Grenzen in begrenzte deutsche Meldungen übersetzt; rohe Datenbankfehler dürfen nicht an Browser gelangen.

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
OK   20260831160000_vollausbau_review_corrections.sql
```

Keine Datei außerhalb dieser Liste ist seit `87320087` neu. Es gibt keine doppelt angelegten Objekte zwischen den Paketen; Korrekturdateien verwenden bewusst `create or replace` mit identischen Funktionssignaturen. Der Snapshot-Dry-Run ersetzt nicht die oben vorgeschriebene Prüfung echter Produktionsdaten.
