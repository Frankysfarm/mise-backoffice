# Mise Gastro Neo: gemeinsame Betriebsplattform

## Verbindliches Zielbild

Neo ist Anwendung, Identitätsgrenze und zentrale Datenbasis. Die produktiven
Mise-OS-Ideen für Bereiche, Abläufe, Schulungen und Betriebsübersicht werden in
Neo auf den bestehenden Mandanten, Standorten, Mitarbeitern und Rollen
weitergeführt. Neue Funktionen dürfen keine zweite Mitarbeiter-, Standort-,
Tisch-, Bestell- oder Benachrichtigungsverwaltung anlegen.

## Bestandsaufnahme (Produktion, 29. August 2026)

| Fachbereich | Wiederverwendete Neo-Struktur | Noch zu schließen |
| --- | --- | --- |
| Identität | Supabase Auth, `employees`, serverseitige Sitzung | Hierarchische Sichtrechte und sichere Mitarbeiterverzeichnisse |
| Unternehmen | `tenants`, `locations`, `departments` | Mehrere Hierarchieebenen, Verantwortliche, Stellvertretungen, Pflichtabdeckung |
| Personal | `employees`, `shifts`, Verfügbarkeit, Urlaub | Organigramm, fachliche Zuordnung, aktive Vertretung |
| Kontrollen | `checkup_*`, `cleaning_*`, `shift_guides`, `documents` | Ein gemeinsamer Arbeitsauftrag mit Ausführung, Kontrolle, Nachweis und Eskalation |
| Meldungen | `notifications`, `notification_rules`, Zustellprotokoll | Verantwortungsspezifische Eskalationskette |
| Revision | `audit_log`, Bestell-Audit | Durchgängige Protokollierung aller Verantwortungsänderungen und Freigaben |
| Tische | `restaurant_tables`, Raumplan, sichere UUID-QR-Tokens | Tischstatus, Tokenwechsel, zeitlich begrenzte Sitzung, Servicebereich |
| Gastbestellung | mobile Tischansicht, Menü, Varianten, Allergene, Warenkorb | Serviceanfragen, Live-Status und Kartenbezahlung im sicheren Tischfluss |
| Produktion | `kitchen_stations`, Artikel-/Kategorierouting, `order_items.station_*` | Routing beim Anlegen und vollständige Teilstatuskette |
| Bestellungen | `customer_orders`, POS, Küche, Drucker, Audit | Tischspezifische Statuskette und Serviceübergabe |

Mise OS besitzt zusätzlich fachlich wertvolle Abläufe, Schulungen, Zertifikate,
Bereichszuteilungen und Rezepte in einer separaten Prisma-Datenbank. Diese
Daten werden über stabile Legacy-IDs in die Neo-Tabellen migriert. Erst nach
Zähl- und Stichprobenabgleich wird der schreibende Mise-OS-Datenpfad beendet.

Der read-only Produktionsabgleich ergab für den operativ befüllten
Mise-OS-Mandanten: 3 Bereiche, 5 Lagerartikel, 15 Ablaufvorlagen, 3 Schichten
und 1 Schulung. Ablauf-Ausführungen, Zertifikate, Rezepte, Zeiterfassungen,
Wareneingänge und alte Online-Bestellungen enthalten aktuell keine Datensätze.

## Zentrales Datenmodell

### Organisation und Verantwortung

- `departments` bleibt der verbindliche Unternehmensbereich und erhält
  Pflichtabdeckung, Priorität, Aktivstatus, Aufgabenbeschreibung und
  Geltungsregeln.
- `organization_positions` bildet besetzbare Hierarchieknoten ab. Ein Knoten
  kann auch unbesetzt sein und hängt an Unternehmen, Standort oder Bereich.
- `organization_position_assignments` ordnet Mitarbeiter als Inhaber,
  Stellvertretung oder Mitglied zu.
- `department_responsibility_assignments` legt Hauptverantwortung und
  Stellvertretung zeit-, wochentag- und schichtbezogen fest.
- Die Coverage-View meldet Pflichtbereiche ohne Verantwortlichen oder
  Stellvertretung unmittelbar.

### Einheitliche Aufgaben und Kontrollen

- `operational_task_templates` ist die gemeinsame Vorlage für Ablauf,
  Checkliste, Kontrolle, Hygiene, Lager und Schulungsnachweis.
- `operational_tasks` enthält Ausführenden, weiterhin verantwortliche Person,
  Prüfer, Frist, Status, Freigabe und Eskalationsstufe.
- Delegation ändert den Ausführenden, niemals automatisch die accountable
  Person. Übergaben und Nachweise sind eigene, revisionsfähige Datensätze.
- Bestehende Checkup-, Reinigungs- und Shift-Guide-Datensätze werden über
  `source_type`/`source_id` angebunden und schrittweise auf denselben
  Arbeitsauftrag synchronisiert.

### Tischbestellung

- `restaurant_tables` bleibt die einzige Tischverwaltung.
- Der dauerhafte, nicht erratbare QR-Token kann deaktiviert oder neu erzeugt
  werden. Beim Scan entsteht eine kurzlebige, nur gehasht gespeicherte
  `table_session`.
- Gastbestellungen referenzieren diese Sitzung. Artikel werden über
  `menu_items.kds_station_id` beziehungsweise `station_category_routing` an
  Küche, Bar oder weitere Produktionsstationen geleitet.
- `table_service_requests` bündelt Service rufen, Rechnung, Bezahlen, Besteck
  und Problemmeldung mit Zuweisung, Status und Eskalation.
- Bestell- und Serviceänderungen werden append-only protokolliert.

## Berechtigungsmodell

1. Der aktuelle Mitarbeiter und Mandant kommen ausschließlich aus der
   serverseitig verifizierten Supabase-Sitzung.
2. Mitarbeiter sehen eigene Arbeitsaufträge.
3. Verantwortliche sehen Aufgaben ihres Bereichs, bleiben bei Delegation
   kontrollpflichtig und sehen keine fremden sensiblen Personaldaten.
4. Schicht- und Filialleitung werden auf Standort und Schicht eingeschränkt.
5. Betriebsleitung und Geschäftsführung erhalten tenantweite bzw.
   unternehmensweite Sichten.
6. Jede schreibende API prüft Tenant, Standort, Rolle und fachlichen Scope;
   Browserwerte dürfen diese Grenzen nicht setzen.
7. `service_role` und gemeinsame Secrets werden nie an den Browser geliefert.

## Datenmigration ohne Verlust

1. Neo-Schema additiv ausrollen; keine vorhandene Tabelle oder Spalte löschen.
2. Legacy-IDs direkt und eindeutig an den wiederverwendeten Neo-Zieldatensätzen
   ablegen; es entsteht kein paralleles Fachmodell.
3. Tenants über `neoTenantId`, Mitarbeiter über `neoEmployeeId`, danach nur
   innerhalb desselben Mandanten per E-Mail zuordnen.
4. Bereiche, Zuteilungen, Abläufe, Schulungen, Zertifikate, Lager und Rezepte
   in dieser Reihenfolge importieren.
5. Pro Entität Quell-/Zielanzahl, verwaiste Fremdschlüssel und Stichproben
   prüfen; den Import idempotent wiederholbar halten.
6. Für eine Übergangszeit Mise OS nur lesend betreiben.
7. Nach fachlicher Abnahme SSO-Weiterleitungen durch native Neo-Routen ersetzen
   und die separate Schreibdatenbank archivieren.

Der Importer liegt in `mise-os/backend/scripts/migrate-to-neo.mjs`, läuft
standardmäßig nur als Vorschau und bricht bei nicht abgebildeten Datentypen,
uneindeutigem Standort oder fehlendem Zielschema ab. Der Schreibmodus erfordert
explizit `--apply --confirm=IMPORT-MISE-OS`. Vorher werden Quell- und Zielsystem
gesichert; anschließend wird derselbe Import ein zweites Mal ausgeführt und
muss ausschließlich Updates derselben Legacy-IDs statt Duplikate melden.

## Abnahme

- Kein Pflichtbereich ist unbemerkt ohne Hauptverantwortlichen oder
  Stellvertretung.
- Organigrammänderungen, Delegationen, Nachweise und Freigaben sind auditierbar.
- Abwesenheit aktiviert die gültige Vertretung; offene Punkte können übergeben
  werden.
- Ein Gast kann nur mit aktivem QR und gültiger Tischsitzung bestellen.
- Artikel landen an der richtigen Station und bleiben Teil derselben
  Tischbestellung.
- Leitung sieht Serviceanfragen, Teilstatus, offene Kontrollen und Eskalationen.
- Rollen-, Tenant-, Standort-, Mobil-, Tastatur- und Fehlerfalltests sind grün.
