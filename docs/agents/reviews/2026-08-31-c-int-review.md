# Final Release Review (CEO Sign-off) — Vollausbau-Integration

- Worktree: `/home/openclaw/factory/workspaces/codex-builder/runs/mise-neo/vollausbau-20260831`
- Branch: `vollausbau/integration`, HEAD `4d09038`, Basis `3dc87de`
- Datum: 2026-08-31
- Reviewer: Claude (Final Release Reviewer)

## 0. Umfang dieses Reviews — Einschränkung vorab

Die Review-Umgebung konnte **keine Kommandos ausführen**. Jeder Aufruf des
Bash-Werkzeugs endete sofort mit Exit-Code 1, ohne Ausgabe und ohne
Seiteneffekt — im Vordergrund, im Hintergrund und mit deaktivierter Sandbox.
Kontrollprobe: `echo probe2 > /tmp/probe2.txt` endete mit Exit 1, und
`/tmp/probe2.txt` wurde nicht angelegt. Es standen ausschließlich lesende
Dateizugriffe über exakte Pfade zur Verfügung; `git`, Verzeichnislisten sowie
Datei- und Inhaltssuche waren nicht verfügbar.

Daraus folgt für den Prüfauftrag:

| Prüfbereich | Status |
|---|---|
| Merge-Korrektheit, Paket-Stichproben gegen Reports | **nicht geprüft** (kein `git diff`) |
| Cross-Modul-Kohärenz und Navigation, deutsche Labels | **nicht geprüft** (keine Seitenliste) |
| Doppelte Helper | **nicht geprüft** (keine Suche) |
| Tenant-/Location-Scoping ALLER neuen API-Routen | **nicht geprüft** (keine Routenliste) |
| Migrationsset-Konsistenz | **geprüft** (alle 8 Dateien vollständig gelesen) |
| Gates (vitest, tsc, Migration-Dry-Run) | **nicht verifiziert** (nicht ausführbar) |

Vier der fünf beauftragten Schwerpunkte und alle drei Gates sind damit
ungeprüft. Die nachfolgenden Befunde stammen ausschließlich aus der Lektüre der
acht Migrationsdateien und der drei Berichtsdokumente. Sie sind bewusst als
Teilergebnis zu lesen und ersetzen die beauftragte Prüfung nicht.

Weil das Basisschema (`87320087`) nicht einsehbar war, sind Befunde, die von
vorbestehenden Objekten abhängen, als *unbestätigt* markiert.

## 1. Gate-Ergebnisse

| Gate | Kommando | Ergebnis |
|---|---|---|
| Unit-Tests | `./node_modules/.bin/vitest run` | **NICHT AUSGEFÜHRT** — Bash nicht funktionsfähig |
| Typecheck | `./node_modules/.bin/tsc --noEmit -p .` | **NICHT AUSGEFÜHRT** — Bash nicht funktionsfähig |
| Migration-Dry-Run | `bash …/migration-dryrun.sh supabase/migrations/2026083*.sql` | **NICHT AUSGEFÜHRT** — Bash nicht funktionsfähig |

Der Integrator meldet in `docs/agents/reports/2026-08-31-c-int.md` 271 Tests in
42 Dateien, Typecheck ohne Diagnosen und 8/8 `OK` im Dry-Run. Diese Angaben
sind **nicht unabhängig bestätigt**. Für eine CEO-Freigabe ist die
Eigenmeldung des Erstellers allein keine ausreichende Grundlage.

## 2. Befunde

### BLOCKER

**B1 — Alle drei Freigabe-Gates sind unverifiziert.**
Keines der drei beauftragten Gates konnte ausgeführt werden (siehe Abschnitt 1).
Eine Freigabe würde ausschließlich auf der Selbstauskunft des Integrators
beruhen.

**B2 — Vier der fünf beauftragten Prüfbereiche wurden nicht abgedeckt.**
Ohne `git diff 3dc87de..HEAD` konnten Paketvollständigkeit (K-B, C-A, C-F, C-C,
C-D, C-E), Navigationserreichbarkeit, doppelte Helper und insbesondere das
**Tenant-/Location-Scoping der neuen API-Routen** nicht beurteilt werden.
Gerade das Routen-Scoping ist der sicherheitskritischste Punkt des Auftrags:
sämtliche neuen RPCs sind `security definer` und ausschließlich an
`service_role` vergeben (korrekt), womit die gesamte Autorisierungslast auf den
ungeprüften Next.js-Routen liegt.

### MAJOR

**M1 — Mitarbeiter in Probe/Einarbeitung werden nie für Schichten vorgeschlagen.**
`supabase/migrations/20260831130000_schedule_planning_loop.sql:178` filtert
Kandidaten mit `e.status::text='aktiv'`. Alle übrigen RPCs dieses Vollausbaus
akzeptieren durchgängig `('aktiv','in_training','in_probe')` (z. B.
`20260831130000_…:74`, `:98`, `:113`, `:132`;
`20260831140000_…:49`, `:81`). Zugleich setzt
`20260831100944_…:735` einen bestandenen Bewerber genau auf `in_probe`.
Folge: Ein frisch eingestellter Mitarbeiter kann Verfügbarkeiten melden
(`shift_availability_responses` kennt keine Statusgrenze), erscheint aber in
keinem Vorschlag. Die im Report (`c-int.md:19`) und in der Persona-Abnahme
(`persona-e2e.md:40,43`) zugesicherte Kette Einstellung → Profil → Dienstplan
bricht damit genau für die Zielgruppe, für die sie gebaut wurde.

**M2 — Das Runbook bezeichnet die Migrationen als additiv; eine Datei löscht
unwiderruflich Produktionsdaten.**
`docs/agents/deploy/2026-08-31-migrations.md:3` sagt „Alle Dateien sind
additiv". Tatsächlich löscht
`20260831100944_…:400-416` per `DELETE` doppelte `training_progress`-Zeilen
(Deduplizierung vor dem Unique-Index `:418`) und
`20260831100944_…:48-58` überschreibt `status` und `slug` bestehender
`assessment_templates`. Die Rollback-Notiz zu Datei 1
(`migrations.md:5`) erwähnt weder den Datenverlust noch eine
Backup-Vorbedingung. Für einen Produktions-Deploy fehlt damit die
Wiederherstellungsgrundlage.

**M3 — Mehrfachauswahl-Fragen werden ordnungsabhängig bewertet.**
`20260831100944_…:725-726` vergleicht
`response.response_json->'optionIds'` mit
`item.server_scoring_snapshot_json->'correctOptionIds'` per `=`.
jsonb-Array-Gleichheit ist reihenfolge- und duplikatsensitiv. Multi-Select ist
ein ausdrücklich unterstützter Fall (`:670` setzt `'multiple'` bei mehr als
einer richtigen Option). Ein Bewerber, der dieselben richtigen Optionen in
anderer Reihenfolge übermittelt, erhält 0 Punkte und löst zusätzlich über
`:726` fälschlich `must_pass_failed` aus — bei
`pass_action='reject'` (`:736`) führt das zur automatischen Ablehnung.
Ein Mengenvergleich (sortiert/dedupliziert) ist erforderlich.

**M4 — Der Dry-Run kann die datenabhängigen Abbruchwächter nicht erreichen.**
`20260831150000_…:36-40` und `:86-90` brechen die Migration mit
`raise exception` ab, wenn Alt-Datensätze in `shift_guides` bzw.
`checkup_templates` keinen eindeutigen Tenant-/Location-Bezug haben. Die
Auflösung davor (`:26-34`, `:75-84`) funktioniert nur bei genau einem Tenant
bzw. genau einer Location je Tenant. Der Beleg im Runbook
(`migrations.md:16-27`) zeigt einen Schema-Restore („tables=243",
Extension-/Duplikat-Rauschen) — also keine Produktionsdaten. Damit belegt
„8/8 OK" nicht, dass der Deploy auf der echten Datenbank durchläuft. Bei mehr
als einem Mandanten mit Alt-Guides ohne Abteilung schlägt Datei 8 fehl und
rollt die gesamte Transaktion zurück.

### MINOR

**m1 — Fehlende Statusprüfung beim Zuweisen von Schulungen.**
`20260831100944_…:747` prüft nur Tenant und Rolle, nicht den
Mitarbeiterstatus, während alle Schwesterfunktionen zusätzlich
`status in ('aktiv','in_training','in_probe')` verlangen (`:500`, `:561`,
`:808`). Ein ausgeschiedener Manager behält damit die Zuweisungsberechtigung.

**m2 — `checkup_templates` erhält Scope-Spalten, aber keine RLS.**
`20260831150000_…:59-61` ergänzt `tenant_id`/`location_id` und
`:92-93` einen Index; anders als `shift_guides` (`:49`, `:97-104`) folgen
weder `enable row level security` noch Policies. Die im Kommentar
(`:57-58`) formulierte Absicht wird ausschließlich in der Anwendungsschicht
durchgesetzt — die hier nicht geprüft werden konnte.

**m3 — Legacy-Ablaufinhalte werden nur teilweise normalisiert.**
`20260831150000_…:108-138` greift nur, wenn `inhalt->'categories'` bereits ein
JSON-Array ist. Alt-Guides in jeder anderen Form behalten weder
`schemaVersion` noch normalisierte Schritte. `persona-e2e.md:42` sagt für den
Editor ausdrücklich „Legacy-Inhalt erscheint als verständliche Schritte" zu.

**m4 — Regression: Umlagerungsmenge verschwindet aus dem Bewegungsprotokoll.**
`20260831140000_…:98-99` schrieb `menge=-p_amount` bzw. `+p_amount`. Die
Korrekturdatei `20260831140100_…:38-39` schreibt beide Zeilen mit `menge=0`
und `vorher=nachher=v_before`. Die bewegte Menge ist danach aus
`stock_movements` nicht mehr rekonstruierbar. Der Report (`c-int.md:18`)
begründet die Korrektur nur mit Enum-Kanonisierung.

**m5 — Jede Statusänderung einer Schicht wird als `cancelled` protokolliert.**
`20260831130000_…:217` setzt `v_change_type` auf `'cancelled'`, sobald sich
`status` ändert — unabhängig vom Zielstatus. Betroffene Mitarbeiter erhalten
dabei die Benachrichtigung „Dienstplan geändert" (`:221`).

**m6 — Doppelte Ablage derselben Angabe.**
`20260831100944_…:503-504` schreibt `recurrence_months` gleichzeitig in
`recurrence_months` und in das Legacy-Feld `gültig_monate`. Zwei Quellen ohne
definierte Führung.

**m7 — Veröffentlichungs-Benachrichtigung ohne Statusfilter, E-Mail ohne Body.**
`20260831130000_…:139` benachrichtigt jeden Mitarbeiter mit Schicht in der
Woche ohne Statusprüfung; `:141` legt `email_outbox` mit `html=''` an und
verlässt sich vollständig auf `template`/`template_data`. Der Versandworker
wurde nicht geprüft (`c-int.md:43` führt ihn als offenen Punkt).

**m8 — Englische Ausnahmetexte an der Nutzergrenze.**
RPCs werfen durchgängig englische Meldungen, z. B.
`20260831130000_…:207` `'availability deadline has not passed'`,
`20260831140100_…:33` `'the complete place stock must be transferred'`.
`persona-e2e.md:20,50` verlangt deutsche, begrenzte Fehlermeldungen. Ob die
API-Schicht übersetzt, war nicht prüfbar.

**m9 — Zählung verändert den Bestand nicht, meldet aber den gezählten Wert
zurück.** `20260831140100_…:35` schließt `count` von der Aktualisierung von
`inventory_items.letzte_inventur` aus, `:52` gibt jedoch `v_after` (= gezählte
Menge) zurück. Zeigt die Oberfläche diesen Rückgabewert als neuen Bestand an,
weichen Anzeige und Datenbank auseinander; die nächste Zählung differenziert
weiterhin gegen den alten Wert (`:26`).

### NOTE

**n1** — `20260831130000_…:149-152` benennt die Alt-Funktion nur um, wenn
`…_core` fehlt; existiert die Ausgangsfunktion nicht, bricht `alter function`
ab. Auf der Produktionsbasis vermutlich unkritisch, auf frischen Datenbanken
nicht. *(unbestätigt — Basisschema nicht einsehbar)*

**n2** — `on conflict(tenant_id,source_type,source_id) where …`
(`20260831100944_…:772-773`) und `on conflict(shift_id)`
(`20260831130000_…:192`) setzen Unique-Indizes voraus, die in keiner der acht
Dateien angelegt werden. Fehlen sie, scheitert erst die Laufzeit, nicht der
Dry-Run — plpgsql-Rümpfe werden bei `create function` nicht aufgelöst.
*(unbestätigt)*

**n3** — `alter extension pgcrypto set schema extensions`
(`20260831100944_…:19`) kann an Abhängigkeiten scheitern und bricht
vorbestehende Aufrufer, die `digest`/`crypt` unqualifiziert oder als
`public.digest` referenzieren. `gen_random_uuid()` ist ab PG13 eingebaut und
nicht betroffen. Die Rollback-Notiz (`migrations.md:5`) erwähnt den
Schemawechsel nicht. *(unbestätigt)*

**n4** — Der Avatar-Bucket ist `public=true` (`20260831115000_…:11`) und die
Lese-Policies werden entfernt (`:19-20`); Mitarbeiterfotos sind damit für jeden
mit der URL abrufbar. Der Report nennt das bewusst so (`c-int.md:14`), das
Runbook führt es nicht als datenschutzrelevanten Punkt.

**n5** — Die Aussage „Keine Datei außerhalb dieser Liste ist seit `87320087`
neu" (`migrations.md:29`) konnte nicht überprüft werden; ein
Verzeichnislisting war nicht möglich.

**n6** — Der beauftragte Abschnitt „Vollausbau" der HANDOFF-Datei wurde **nicht
geprüft**: Weder `HANDOFF.md` im Wurzelverzeichnis noch `docs/HANDOFF.md`
waren unter diesen Pfaden lesbar, und ohne Suche ließ sich der tatsächliche
Ablageort nicht bestimmen.

## 3. Positiv bestätigt

Innerhalb des geprüften Migrationsumfangs hielten folgende Zusagen stand:

- Alle acht Dateien beginnen mit `begin;` und enden mit `commit;` — wie in
  `c-int.md:25` behauptet.
- Die Korrekturdateien nutzen `create or replace` mit **identischen**
  Signaturen: `record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid)`
  und `delete_inventory_place_as_actor(uuid,uuid,uuid,uuid)` stimmen zwischen
  `20260831140000_…:64,77` und `20260831140100_…:3,17` überein
  (`migrations.md:29` bestätigt).
- Alle neuen RPCs sind `security definer` mit
  `set search_path=public,pg_temp` und werden konsequent von
  `public,anon,authenticated` entzogen und nur an `service_role` vergeben
  (`20260831100944_…:778-783,950-957`; `20260831130000_…:239-253`;
  `20260831140000_…:115-121`; `20260831140100_…:55-58`).
  Die rohe Data-API-Oberfläche ist für Assessment- und Quiz-Schlüsseltabellen
  zusätzlich entzogen (`20260831100944_…:457-476`).
- `pgcrypto` wird auch bei vorhandener Fremdschema-Installation nach
  `extensions` verschoben (`20260831100944_…:11-21`) — die in `c-int.md:9`
  genannte MINOR-Behebung ist vorhanden.
- Die Legacy-Ablauftypen werden tatsächlich nur aus dem Defaultwert
  normalisiert (`20260831150000_…:17-22`, `where g.ablauf_typ='other'`) — die
  zweite in `c-int.md:9` genannte Behebung ist vorhanden.
- `qr_token uuid not null default gen_random_uuid()`
  (`20260831140000_…:6`) ist volatil, erzwingt daher einen Tabellen-Rewrite mit
  Auswertung je Zeile und kollidiert nicht mit dem Unique-Index (`:10`).
- Die Hierarchieprüfung für Lagerplätze deckt die im Save-RPC fehlende
  Validierung von `p_parent_id` ab, weil der Trigger `area_id`-Gleichheit und
  `place_kind='unit'` erzwingt (`20260831140000_…:34-38`).
- Der in `20260831120100_…:60-62` auf `trigger_type='manual'` gefilterte
  Scope entspricht der in `20260831120000_…:89` gesetzten Konvention und dem
  Materialisierer (`:124`) — kein Widerspruch.

## 4. Bewertung

Die geprüfte Teilmenge ist handwerklich sorgfältig: Scoping der RPCs,
Grant-Hygiene und Idempotenz sind auf einem guten Stand, und beide im Report
genannten Nachbesserungen sind tatsächlich enthalten. Dennoch ist eine
Freigabe aus zwei unabhängigen Gründen nicht vertretbar.

Erstens verfahrensseitig: Kein Gate wurde verifiziert, und der
sicherheitskritischste Auftragsteil — das Tenant-/Location-Scoping der neuen
API-Routen — wurde überhaupt nicht betrachtet. Eine Unterschrift hierauf wäre
eine Unterschrift auf ungelesenen Code.

Zweitens inhaltlich: Bereits die eine prüfbare Dimension liefert vier MAJORs,
darunter mit M1 einen funktionalen Bruch der beworbenen Kernkette und mit M3
einen Bewertungsfehler, der Bewerber automatisch ablehnen kann. M2 und M4
betreffen die Deploy-Sicherheit unmittelbar: eine als additiv deklarierte
Migration löscht Daten, und der vorgelegte Dry-Run-Beleg kann die
datenabhängigen Abbruchbedingungen prinzipiell nicht erreicht haben.

Empfohlenes Vorgehen: M1–M4 beheben, das Runbook um Backup-Vorbedingung und
den pgcrypto-Schemawechsel ergänzen, den Dry-Run gegen eine Staging-Instanz
**mit Produktionsdaten** wiederholen und den Review in einer Umgebung mit
funktionsfähiger Kommandoausführung vollständig — insbesondere über
`git diff 3dc87de..HEAD` und die API-Routen — nachholen.

## 5. Zählung

- BLOCKER: 2
- MAJOR: 4
- MINOR: 9
- NOTE: 6

NO-GO
