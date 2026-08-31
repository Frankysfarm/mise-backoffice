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

---

# Re-review round 2

- Branch: `vollausbau/integration`, HEAD `dbd6ea5+`, Basis `3dc87de`
- Datum: 2026-08-31
- Reviewer: Claude (Final Release Reviewer)
- Gegenstand: Verifikation von M1–M4 und der MINORs aus Runde 1 sowie die in
  Runde 1 nicht abgedeckten Prüfbereiche (B2).

## R0. Umgebung — Bash weiterhin ausgefallen

Das Bash-Werkzeug ist in dieser Runde erneut **vollständig funktionsunfähig**:
`echo hello` endet mit Exit 1 ohne Ausgabe, im Vordergrund, mit deaktivierter
Sandbox und ohne Seiteneffekt. Zusätzlich standen in dieser Sitzung **keine
Datei- oder Inhaltssuche** (Glob/Grep) zur Verfügung. Verfügbar waren
ausschließlich lesende Dateizugriffe über exakte Pfade.

Daraus folgt: `git show dbd6ea5` und `git diff 3dc87de..HEAD --name-only` waren
**nicht ausführbar**. Der Auftrag wurde deshalb über zwei Ersatzquellen
erschlossen, die eine vollständige Routen- und Seiteninventur erlauben:

1. `.next/app-path-routes-manifest.json` — das Artefakt des extern verifizierten
   `next build` (242/242 Seiten). Es listet **jede** gebaute App-Route und
   API-Route des gemergten Baums.
2. Die sechs Paketberichte, das Runbook und `docs/agents/HANDOFF.md`, aus denen
   die je Paket zugesagten Dateien namentlich hervorgehen.

Jede so identifizierte Datei wurde anschließend im Quelltext gelesen. Was damit
weiterhin **nicht** beweisbar ist, steht in N3 und n7.

## R1. Gates

Die Gates wurden auftragsgemäß extern durch deterministische Skripte verifiziert
(vitest 42 Dateien/276 Tests, `tsc` Exit 0, `next build` Exit 0 mit 242/242
Seiten, `git diff --check` sauber, Migrationsset zweimal gegen Snapshots der
Produktionsdatenbank — schema-only **und** mit vollen Daten, 27 Mitarbeiter).
**B1 gilt damit als aufgelöst.** Der einzige Fehlschlag betrifft die bereits
deployte `20260830154500`, die nicht Teil des Deploy-Sets ist.

Der Lauf **mit echten Produktionsdaten** ist dabei mehr als eine Gate-Bestätigung:
er ist der in M4 geforderte Beleg (siehe dort).

## R2. Verdikte zu den Befunden aus Runde 1

### BLOCKER

**B1 — AUFGELÖST.** Extern verifizierte Gate-Evidence, siehe R1.

**B2 — GESCHLOSSEN, mit Restposten.** Die vier offenen Prüfbereiche wurden in
dieser Runde bearbeitet: Tenant-/Location-Scoping aller neuen API-Routen
(R3), Navigationserreichbarkeit (R4), Paketvollständigkeit (R5) und doppelte
Helper (R6). Nicht beweisbar bleibt allein die Negativaussage „im Merge ist
nichts enthalten, was in keinem Paketbericht steht" — dafür ist `git diff`
zwingend. Restposten als **n7** geführt.

### MAJOR

**M1 — BEHOBEN (verifiziert).**
`20260831160000_…:75-82` liest `generate_weekly_shift_assignment_suggestions_v1`
per `pg_get_functiondef`, ersetzt `e.status::text='aktiv'` durch
`in ('aktiv','in_training','in_probe')` und bricht ab, wenn das Ergebnis kein
`in_training` enthält. Diese Wächterbedingung ist belastbar: Der Rumpf von `_v1`
(`20260831130000_…:154-198`) enthält `in_training` an **keiner** anderen Stelle,
das Prädikat steht genau einmal in `:178`. Ein nicht greifender `replace` würde
die Migration also tatsächlich abbrechen und nicht still durchlaufen.
Fachlich schließt das die beworbene Kette: Ein Mitarbeiter in Probe/Einarbeitung
kann Verfügbarkeiten melden, und `_v1` bewertet genau die Schichten mit
konkreten Rückmeldungen neu — dort erscheint er jetzt. Einschränkung als
**n8** geführt.

**M2 — BEHOBEN (verifiziert).**
`docs/agents/deploy/2026-08-31-migrations.md:3` fordert nun ein „verifizierbares
Datenbank-Backup mit dokumentiertem Restore-Punkt" vor Datei 1. `:5` bezeichnet
Datei 1 ausdrücklich als **„Nicht additiv"**, benennt den
`training_progress`-`DELETE` und das Überschreiben von
`assessment_templates.status/slug` und verlangt die Wiederherstellung gelöschter
Duplikate ausschließlich aus dem Pre-Deploy-Backup. Die Aussage „Alle Dateien
sind additiv" existiert nicht mehr.

**M3 — BEHOBEN (verifiziert).**
`20260831160000_…:16-24` vergleicht Antwortmengen über zwei
`cross join lateral`-Aggregate mit `array_agg(distinct value order by value)`,
also sortiert und dedupliziert, auf **beiden** Seiten (`selected.ids` und
`correct.ids`). Reihenfolge und Duplikate können weder Punktzahl (`:17`) noch
`must_pass`-Auswertung (`:18`) beeinflussen. Die automatische Ablehnung über
`pass_action='reject'` ist damit nicht mehr ordnungsabhängig auslösbar.
Die Absicherung ist zusätzlich zweiseitig: `app/api/application-assessments/public/[token]/route.ts:32`
dedupliziert und sortiert vor dem Submit, `app/api/application-assessments/route.ts:30`
sortiert die hinterlegten `correctOptionIds` beim Speichern.

**M4 — BEHOBEN (verifiziert, doppelt).**
Erstens dokumentarisch: `migrations.md:15-56` enthält zwei auf dem
Vor-Migrationsschema ausführbare Produktionsabfragen, die die
Singleton-Fallbacks aus `20260831150000_…:26-34,75-84` exakt nachbilden; der
Deploy darf nur fortgesetzt werden, wenn beide Resultsets leer sind (`:3`, `:17`).
Zweitens — und stärker — empirisch: Das Migrationsset wurde extern gegen einen
Snapshot der Produktionsdatenbank **mit vollen Daten** angewendet. Damit sind
die datenabhängigen Abbruchwächter (`:36-40`, `:86-90`) tatsächlich durchlaufen
worden und nicht, wie in Runde 1 beanstandet, prinzipiell unerreichbar geblieben.
Genau dieser Beleg fehlte in Runde 1.

### MINOR aus Runde 1

| Befund | Verdikt | Nachweis |
|---|---|---|
| **m1** Statusprüfung beim Zuweisen von Schulungen | **BEHOBEN** | `20260831160000_…:45` verlangt für den Actor `status in ('aktiv','in_training','in_probe')` zusätzlich zur Rolle. |
| **m2** `checkup_templates` ohne RLS | **TEILWEISE** | `:61-71` aktiviert RLS und legt Lese-/Manage-Policy an. Die Schreibgrenze greift; die Lesegrenze vermutlich nicht — siehe **N2**. |
| **m3** Legacy-Ablaufinhalte nur teilweise normalisiert | **BEWUSST OFFEN, dokumentiert** | `migrations.md:58` schließt eine verlustbehaftete Massenumschreibung aus und beschreibt das tatsächliche Verhalten (leere editierbare Struktur). Die Zusage in `persona-e2e.md:42` bleibt damit für Nicht-`categories[]`-Altbestände unerfüllt, ist aber jetzt ehrlich beschrieben. |
| **m4** Umlagerungsmenge fehlte im Protokoll | **BEHOBEN** | `20260831160000_…:126-128` schreibt wieder `menge=-p_amount` bzw. `+p_amount`; Wächter `:133` erzwingt den Treffer. |
| **m5** jede Statusänderung als `cancelled` | **BEHOBEN** | `:91` setzt `cancelled` nur bei Übergang **nach** `('abgesagt','storniert')` und **nicht von dort**; sonst `time_changed`/`assignment_changed`. Gegenprobe zum Original `20260831130000_…:217` bestätigt die Verengung. |
| **m6** doppelte Ablage `recurrence_months`/`gültig_monate` | **BEWUSST OFFEN, dokumentiert** | `app/api/training/modules/route.ts:16` schreibt weiterhin beide Felder; `migrations.md:58` benennt `recurrence_months` als führende Quelle und `gültig_monate` als Legacy-Spiegel. Führung ist damit definiert. |
| **m7** Veröffentlichung ohne Statusfilter, Mail ohne Body | **BEHOBEN** | `:112-113` filtert Änderungssätze **und** Empfängerschleife auf `('aktiv','in_training','in_probe')`; `:115` liefert einen echten HTML-Body statt `html=''`. |
| **m8** englische Ausnahmetexte an der Nutzergrenze | **AN DER API-GRENZE ABGEDECKT** | In Runde 1 nicht prüfbar, jetzt geprüft: Alle fünf neuen Mutationsgrenzen übersetzen in begrenzte deutsche Meldungen — `application-assessments/*` über `assessmentErrorMessage`, `inventory/warehouse/route.ts:8-20` über `rpcMessage`, `scheduling/planner/route.ts:97-102` über `failure`, `operations/tasks/route.ts:77-80` mit protokolliertem Rohfehler und fester deutscher Antwort, `ablaeufe/*` mit festen deutschen Strings. Rohe PostgreSQL-Texte erreichen den Browser an keiner der geprüften Stellen. |
| **m9** Zählung meldete Wert, ohne ihn zu speichern | **BEHOBEN** | `:129-132` ergänzt `if p_action='count' then update public.inventory_items set letzte_inventur=v_after`; Anzeige und Datenbank laufen nicht mehr auseinander. |

### NOTE aus Runde 1

- **n1** (Rename-Guard `…_core`) — **entschärft.** Das Set wurde extern zweimal
  gegen Snapshots der echten Produktionsdatenbank angewendet; der Pfad ist auf
  der Zielbasis nachweislich lauffähig. Für frische Datenbanken bleibt der
  Hinweis gültig, ist für diesen Deploy aber gegenstandslos.
- **n2** (vorausgesetzte Unique-Indizes) — **teilweise entschärft.** Der
  Full-Data-Lauf beweist die Anwendbarkeit, nicht die Laufzeit-Konflikttreffer.
  Bleibt Beobachtungspunkt nach dem Deploy.
- **n3** (pgcrypto-Schemawechsel im Rollback unerwähnt) — **BEHOBEN.**
  `migrations.md:5` verlangt jetzt ausdrücklich, den `pgcrypto`-Schemawechsel
  „nur nach Abhängigkeitsprüfung" rückgängig zu machen.
- **n4** (öffentlicher Avatar-Bucket) — **unverändert.** Bewusste
  Produktentscheidung, im Runbook weiterhin nicht als Datenschutzpunkt geführt.
  Empfehlung unverändert: einmal explizit vom Eigentümer bestätigen lassen.
- **n5** (Vollständigkeitsaussage der Dateiliste) — **jetzt widersprüchlich.**
  Siehe **N3**.
- **n6** (HANDOFF-Abschnitt „Vollausbau") — **BEHOBEN.**
  `docs/agents/HANDOFF.md:417-431` enthält den Vollausbau-Abschnitt und den
  Fix-round-1-Abschnitt mit Preconditions, Evidence und Rollback.

## R3. Tenant-/Location-Scoping aller neuen API-Routen

Routeninventar aus dem Build-Manifest, abgeglichen mit den Paketberichten. Alle
neuen bzw. im Vollausbau geänderten Mutationsgrenzen wurden im Quelltext gelesen:

| Route | Auth | Tenant | Location | Befund |
|---|---|---|---|---|
| `api/employees/avatar` | `getCurrentEmployee` | `.eq(tenant_id)` | Manager nur eigener Standort, `null` beidseitig abgelehnt (`:47`) | sauber; Selbst-Upload erlaubt |
| `api/application-assessments` (GET/POST) | `requireManagerPlus` | ja | Manager auf `null`/eigenen Standort (`:14`) | sauber |
| `api/application-assessments/[id]` (GET/DELETE) | `requireManagerPlus` | ja | `scopeForManager` (`:6-8`) | sauber |
| `api/application-assessments/assign` | `requireManagerPlus` | ja | RPC-seitig | sauber; 32-Byte-Token, SHA-256 |
| `api/application-assessments/public/[token]` | **öffentlich (gewollt)** | über Token-Hash | — | einzige neue öffentliche Fläche; nur Session-Auflösung per Hash |
| `api/training/modules` | `requireManagerPlus` | ja, Ziele gegen Tenant geprüft (`:12-13`) | — | sauber; Quizschlüssel serverseitig |
| `api/training/assign` | `requireManagerPlus` | ja (`:8`, `:9`) | **keine** | siehe **N6** |
| `api/training/my/[id]` | `requirePosAccess` | ja | eigener Datensatz (`:12`) | sauber |
| `api/ablaeufe/guides/[id]` | Rolle geprüft (`:51`) | ja | Manager an eigenen Standort, Standort+Bereich gegen Tenant validiert (`:73-107`) | sauber |
| `api/ablaeufe/executions` | `getCurrentEmployee` | ja | Guide muss `actor.location_id` entsprechen (`:49`); Task-Lookup `.eq(location_id)` (`:159`) | sauber |
| `api/ablaeufe/checkups/[id]` | Rolle geprüft (`:34`) | ja | `:55-63`, Bereich gegen Template-Standort (`:64-77`) | sauber |
| `api/operations/tasks` | `getCurrentEmployee` | ja | `:29` Standortgleichheit, `:31-32` companywide gegen Tenant validiert | sauber |
| `api/scheduling/planner` | `getCurrentEmployee` | ja | `canAccessLocation` (`:91-96`), Verfügbarkeit nur eigene Location (`:29`) | sauber; Rückmeldung zusätzlich an offene Runde + Frist gebunden |
| `api/inventory/warehouse` | `getCurrentEmployee` | ja | **an die RPC delegiert** | siehe **N4** |
| `api/inventory/warehouse/[token]/qr` | `getCurrentEmployee` | RLS-Client + `.eq(area.location.tenant_id)` (`:22`) | — | sauber, kein Service-Client |
| `api/applications/[id]/review` | `requireManagerPlus` | ja (`:39`, `:93`) | — | sauber; setzt bei Einstellung `in_training` und stößt Onboarding an |

Ergebnis: **Kein Tenant-Übertritt gefunden.** Jede Service-Role-Mutation ist
mindestens an `actor.tenant_id` gebunden; wo Manager auftreten, ist zusätzlich
der Standort geprüft. Zwei Abweichungen als N4/N6 geführt.

Die öffentliche Grenze ist eng gezogen: `lib/supabase/middleware.ts:46-47`
erklärt genau `/bewerbungstest/` und `/api/application-assessments/public/`
als öffentlich — keine breitere Freigabe, keine neue `/api/*`-Wildcard.

## R4. Navigationserreichbarkeit

`app/(neo)/neo/app/shell.tsx:29-34` definiert die einzige Neo-Navigation.
Die Gruppe `TEAM & ABLÄUFE` ist `managerOnly` und enthält
`klarheit, bewerbungen, tests, mitarbeiter, dienstplan, lager, ablaeufe,
schulungen, compliance, rezeptbuch`. `href()` (`:59`) bildet auf
`/neo/app/<key>` ab. **Alle zehn Ziele existieren im Build-Manifest** — keine
tote Navigationszeile, keine gebaute Managementseite ohne Einstieg.

Zwei-Klick-Nachweis für die neuen Oberflächen:

- Bewerbungstests: Sidebar → `/neo/app/tests` (1 Klick, eigener NAV-Eintrag).
- Operative Aufgaben/Übergaben: Sidebar „Listen & Abläufe" →
  `app/(neo)/neo/app/ablaeufe/page.tsx:20` Karte → `/neo/app/ablaeufe/aufgaben`.
- Schichtleitfäden inkl. Ausführung: gleiche Seite `:16` →
  `/neo/app/ablaeufe/schichtleitfaeden` → `[id]`/`[id]/ausfuehren`.
- Kontrolllisten/Reinigung: `:18-19`, rollen-gegated auf Management.
- Lagerplan/QR: Sidebar „Lager" → `app/(admin)/inventory/page.tsx:50`
  (`${basePath}/plan`, basePath aus `operationsBasePath('/inventory','/neo/app/lager')`)
  → `/neo/app/lager/plan` bzw. `/inventory/plan`. Beide Varianten sowie
  `plan/print` und `platz/[token]` sind in beiden Shells gebaut.
- Dienstplan-Vorlagen: Sidebar „Dienstplan" → `/neo/app/dienstplan/templates`
  (gebaut, ebenso der Admin-Spiegel `/schedule/templates`).

`app/(neo)/neo/app/lager/page.tsx` und `…/dienstplan/page.tsx` sind reine
Re-Exports der Admin-Seiten — die Zusage „eine Navigation, kein zweites
Modell" hält an dieser Stelle nachweislich.

Ein kosmetischer Fund: **N5**.

## R5. Paketvollständigkeit (Stichprobe gegen den gemergten Baum)

Für jedes der sechs Pakete wurden die im Bericht namentlich zugesagten
Artefakte im gemergten Baum nachgewiesen (Existenz per Manifest, Inhalt per
Lektüre):

- **K-B:** `app/api/employees/avatar/route.ts` gelesen; `/mitarbeiter/profil`
  gebaut; Migration `20260831115000` im Runbook. Fixes der Runde 1 sichtbar:
  `publicUrl('avatars', …)` (`:63`) und der Statusfilter (`:36`) sind vorhanden.
- **C-A:** `/neo/app/tests`, `/bewerbungstest/[token]`, `/mitarbeiter/schulungen`,
  vier `api/application-assessments/*`, drei `api/training/*` gebaut und gelesen.
  Der in Fix round 3 zugesagte Admin-Alias `/application-tests` ist im Build
  enthalten — die Zusage ist keine Behauptung geblieben.
- **C-F:** `api/ablaeufe/{guides/[id],executions,checkups/[id]}` gelesen;
  `/neo/app/ablaeufe/schichtleitfaeden/[id]/ausfuehren` gebaut. Kein JSON-Editor
  mehr an den geprüften Stellen; `procedureContentSchema` wird serverseitig
  erzwungen.
- **C-C:** `api/operations/tasks` gelesen, `/neo/app/ablaeufe/aufgaben` gebaut,
  `lib/operations/recurrence.ts` und `…/responsibility-scope.ts` vorhanden.
- **C-D:** `api/scheduling/planner` gelesen, `lib/scheduling/berlin-week.ts`
  gelesen, `/neo/app/dienstplan/templates` gebaut.
- **C-E:** `api/inventory/warehouse` und `…/[token]/qr` gelesen; alle sechs
  Plan-/Platz-/Print-Routen in **beiden** Shells gebaut;
  `tests/inventory/inventory-integrity.test.ts` gelesen — es prüft die
  Korrekturmigration inhaltlich (`'transfer',-p_amount`, `letzte_inventur=v_after`).

**Kein zugesagtes Artefakt fehlte.** Die Gegenrichtung — nichts Unerklärtes im
Merge — ist ohne `git diff` nicht beweisbar (**n7**).

## R6. Doppelte Helper

Gezielt auf die Kandidaten geprüft, bei denen sechs parallele Pakete typischerweise
divergieren:

- **Shell-Basispfad:** genau **eine** Implementierung,
  `lib/routing/operations-base-path`, wird von C-A, C-E und C-F verwendet
  (`app/(admin)/inventory/page.tsx:14,18`). Kein zweiter Pfadableiter.
- **Berlin-Zeit:** `lib/scheduling/berlin-week.ts` delegiert an das
  **bestehende** `berlinWeekBounds` aus `lib/workforce/shifts` (`:1,53`) —
  keine Neuimplementierung der Wochengrenzen.
  `lib/operations/responsibility-scope.ts:17` liefert mit `berlinScheduleMoment`
  eine funktional **andere** Größe (Tag/Wochentag/Uhrzeit für
  Verantwortungsfenster), kein Duplikat der Wochenlogik.
- **Statuslabels/Scoring:** die in den C-A-Runden beanstandeten Parallelpfade
  sind laut Bericht auf `trainingStatusLabels` bzw. den SQL-Scorer
  zusammengeführt; die Route `training/my/[id]:18` bewertet ausschließlich über
  `training_quiz_keys`, es existiert kein zweiter TypeScript-Scorer in den
  gelesenen Dateien.

Ergebnis: **keine doppelte Helper-Implementierung gefunden.** Drei Module
rechnen unabhängig mit `Intl`-Zeitzonen (`berlin-week`, `responsibility-scope`,
`recurrence`); das ist Aufgabenteilung, keine Redundanz, verdient aber
mittelfristig eine gemeinsame Zeitzonen-Schicht.

## R7. Neue Befunde dieser Runde

### MINOR

**N1 — Verfügbarkeitserinnerung erreicht die neu Eingestellten nicht.**
`app/api/scheduling/planner/route.ts:61` wählt die Empfänger mit
`.eq('status','aktiv')`. Nach den Fixes dieser Runde ist der Rest der
Dienstplanschleife breiter: `publish_schedule_week`
(`20260831160000_…:112-113`) benachrichtigt `('aktiv','in_training','in_probe')`,
und die M1-Korrektur schlägt genau diese Gruppe für Schichten vor.
`app/api/applications/[id]/review/route.ts:77` setzt eine Einstellung auf
`in_training`. Folge: Ein frisch eingestellter Mitarbeiter wird für Schichten
vorgeschlagen und über Veröffentlichungen informiert, erhält aber die
Aufforderung „Verfügbarkeit eintragen" nie. Er kann sie nur finden, wenn er die
Mitarbeiter-App von sich aus öffnet. Ein Wort in einer Zeile.

**N2 — Die Lesegrenze aus m2 greift vermutlich nicht.**
`20260831160000_…:61-71` aktiviert RLS auf `checkup_templates` und legt
`checkup_templates_read_scoped` an, löscht aber nur die beiden **eigenen**
Policy-Namen (`:62-63`). Die von C-F selbst benannte bestehende Policy
`checkup_templates_read_all` (`2026-08-31-c-f.md:120`, dort ausdrücklich als
Bestandsproblem in ein Folgepaket verschoben) bleibt bestehen. PostgreSQL
verknüpft permissive Policies mit ODER; eine zusätzliche engere SELECT-Policy
**verengt** deshalb nichts. Die Schreibgrenze (`:67-71`) greift, die im
Kommentar `:60` formulierte Lesegrenze aller Wahrscheinlichkeit nach nicht.
*(Unbestätigt — das Basisschema ist in dieser Umgebung nicht einsehbar. Die
Existenz der Policy stammt aus dem C-F-Bericht, nicht aus eigener Anschauung.)*

**N3 — Die dokumentierte Dateiliste und die externe Zählung widersprechen sich.**
Runbook (`migrations.md:5-13`, Dry-Run-Beleg `:62-74`) und
`HANDOFF.md:429` nennen übereinstimmend **neun** Dateien und „9/9 OK". Die
externe Verifikation dieses Auftrags meldet **zehn** neue `20260831*`-Dateien,
alle OK. Genau eine der beiden Zahlen ist falsch. Beide Fälle sind
handlungsrelevant: Existiert eine zehnte Datei, ist die Reihenfolgenliste des
Runbooks unvollständig und ein Operator, der sie abarbeitet, überspringt eine
Migration, auf die der ausgelieferte Code sich verlässt. Zählt die externe
Prüfung falsch, ist das Runbook korrekt und nichts zu tun.
Ohne Verzeichnislisting kann ich das hier nicht entscheiden.
**Verpflichtende Vorbedingung vor dem Deploy:** `ls supabase/migrations/20260831*.sql`
ausführen. Liefert es zehn Dateien, ist das Runbook vor dem Deploy zu korrigieren;
liefert es neun, ist N3 erledigt. Die Freigabe unten steht unter dieser Prüfung.

### NOTE

**N4** — `app/api/inventory/warehouse/route.ts` übernimmt `body.locationId` vom
Client und prüft **selbst** keine Standortzugehörigkeit; die Autorisierung liegt
vollständig in `record_inventory_place_action_as_actor` /
`save_inventory_place_as_actor`, die laut C-E-Bericht Actor, Tenant, Standort und
Platz validieren. Das ist damit nicht ausnutzbar, weicht aber vom Muster der
vier Schwesterrouten ab, die zuerst an der API-Grenze prüfen. Eine Zeile
Vorprüfung würde die Verteidigung in die Tiefe herstellen.

**N5** — `app/(neo)/neo/app/shell.tsx:32` führt den NAV-Eintrag `loyalty`, für
den `ICONS` (`:6-28`) keinen Eintrag hat. `<Svg html={ICONS['loyalty']} />`
(`:94`) erhält damit `undefined` als `dangerouslySetInnerHTML`. Rein kosmetisch
(leeres Icon), vermutlich Bestand — ohne `git diff` nicht als neu oder alt
belegbar.

**N6** — `app/api/training/assign/route.ts:9` filtert Empfänger auf
`('aktiv','in_training')` und hat als einzige der neuen Manager-Routen **keine**
Standortprüfung: Mit `allActive: true` weist ein Filialleiter dem gesamten
Mandanten zu. Tenant-Grenze hält. Der fehlende `in_probe` ist hier fachlich
vertretbar (Probearbeitende sind vor der Einstellung), die fehlende
Standortgrenze ist eine bewusst zu bestätigende Produktentscheidung.

**N7** — Restposten aus B2: Ohne `git diff 3dc87de..HEAD` bleibt unbewiesen,
dass der Merge **nichts** enthält, was in keinem Paketbericht steht. Alles
Zugesagte ist vorhanden (R5); die Gegenrichtung ist offen.

**N8** — Die M1-Korrektur patcht ausschließlich `_v1`. Für Schichten **ohne**
konkrete Verfügbarkeitsrückmeldung bleibt das vorbestehende
`generate_weekly_shift_assignment_suggestions_core`
(`20260831130000_…:150,158`) maßgeblich; dessen Statusprädikat liegt außerhalb
dieses Diffs und war nicht einsehbar. Für die im Report beworbene Kette ist das
unerheblich — sie führt über konkrete Rückmeldungen —, für den stillen
Restpfad nicht abschließend geklärt.

**N9** — `api/operations/tasks` (`:69`) übernimmt `openTaskIds` ohne Prüfung auf
Tenant/Standort. Auswirkung ist neutralisiert, weil die Anzeige die Titel
tenant- und standortgebunden auflöst; fremde IDs bleiben leer. Sauberer wäre
eine Validierung beim Anlegen.

## R8. Bewertung

Die vier MAJORs sind behoben, und zwar nicht kosmetisch: M3 vergleicht jetzt
echte Mengen auf beiden Seiten und ist zusätzlich an der API-Grenze abgesichert;
M1 ist durch einen Wächter geschützt, der nachweislich greift, weil die
Zeichenfolge im Ausgangsrumpf nicht vorkommt; M2 nennt den Datenverlust beim
Namen und macht das Backup zur Vorbedingung; M4 hat mit dem Full-Data-Lauf gegen
die Produktionsdaten genau den Beleg bekommen, dessen Fehlen in Runde 1 der
eigentliche Einwand war. Von den neun MINORs sind sechs behoben, zwei bewusst
und jetzt dokumentiert offen, einer an der API-Grenze abgedeckt.

Die in Runde 1 blinden Flecken sind in dieser Runde gesehen worden. Das
sicherheitskritischste Stück — das Scoping der neuen Routen — ist sauber: 16
Mutationsgrenzen gelesen, kein Tenant-Übertritt, Manager durchgängig an ihren
Standort gebunden, die öffentliche Fläche auf zwei Präfixe begrenzt. Die
Navigation hat keine tote Zeile und keine verwaiste Seite. Doppelte Helper gibt
es nicht; die Pakete haben sich tatsächlich auf gemeinsame Bausteine geeinigt.

Zwei Dinge trage ich als Vorbehalt ein, ohne sie zum Blocker zu machen. N3 ist
eine Zählabweichung, die vor dem Deploy mit einem einzigen `ls` zu klären ist —
sie bedroht nicht die Korrektheit des Codes, wohl aber die Vollständigkeit der
Deploy-Anleitung. N2 ist der einzige Fix dieser Runde, der sein erklärtes Ziel
vermutlich verfehlt; da er eine Verschärfung ist, die nicht greift, und keine
Lockerung, ist der Zustand nicht schlechter als vor der Runde.

Die Freigabe erfolgt unter drei Bedingungen, die alle bereits im Runbook oder
oben stehen: verifiziertes Backup vor Datei 1, beide Scope-Abfragen auf
Produktion leer vor Datei 8, und die `ls`-Gegenprobe aus N3.

## R9. Zählung Runde 2

Verdikte zu Runde 1: M1–M4 **behoben** (4/4); MINOR **6 behoben**, 1 teilweise
(m2 → N2), 2 bewusst offen und dokumentiert (m3, m6), m8 an der API-Grenze
abgedeckt; NOTE n1/n3/n6 erledigt, n2 teilweise, n4 unverändert, n5 → N3.

Neue Befunde:

- BLOCKER: 0
- MAJOR: 0
- MINOR: 3 (N1, N2, N3)
- NOTE: 6 (N4–N9)

GO
