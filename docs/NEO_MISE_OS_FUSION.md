# Neo + Mise OS: abgeschlossene Fusion

## Verbindliches Zielbild

Mise Gastro Neo ist der einzige Einstieg, die einzige Anmeldung und die
einzige schreibende Datenbasis. Die fachlich fertigen Mise-OS-Funktionen laufen
nativ auf den vorhandenen Neo-Mandanten, Standorten, Mitarbeitern, Rollen und
Benachrichtigungen. Ein externer SSO-Start oder ein zweites Mitarbeiterkonto
ist nicht mehr Teil der Architektur.

## Native Modulzuordnung

| Frühere Mise-OS-Funktion | Verbindliche Neo-Route |
| --- | --- |
| Dashboard | `/neo` |
| Listen & Abläufe | `/neo/app/ablaeufe` |
| Schulungen | `/neo/app/schulungen` |
| Mitarbeiter & Bereiche | `/neo/app/mitarbeiter` |
| Dienstplan | `/neo/app/dienstplan` |
| Rezeptbuch | `/neo/app/rezeptbuch` |
| Lager | `/neo/app/lager` |
| Team & Compliance | `/neo/app/compliance` |

Historische Links unter `/neo/os/[screen]` werden ausschließlich auf diese
nativen Routen umgeleitet. `/api/mise-os/sso` ist stillgelegt und antwortet
mit HTTP 410; es wird kein zweites Sitzungstoken mehr ausgestellt.

## Datenübernahme und Stilllegung

Der idempotente Importer `mise-os/backend/scripts/migrate-to-neo.mjs` überträgt
Legacy-Datensätze anhand stabiler IDs in das zentrale Neo-Schema. Vor dem
Produktionsimport werden beide Datenbanken gesichert. Der Import wird zweimal
ausgeführt: Der zweite Lauf darf keine neuen Datensätze erzeugen.

Nach Mengenabgleich, Fremdschlüsselprüfung und RLS-Test wird der alte
Mise-OS-Schreibdienst gestoppt. Die bisherige Datenbank und das Backend bleiben
als Archiv erhalten, sind aber öffentlich nicht mehr erreichbar. Alte
Browserpfade führen zur gemeinsamen Neo-Mitarbeiteroberfläche; alte API-Pfade
antworten mit HTTP 410 und können deshalb keine getrennten Datenbestände mehr
erzeugen.

## Sicherheitsgrenzen

- Supabase Auth ist die einzige Identitätsquelle.
- Rollen und Sichtbereiche werden serverseitig aus `employees`, Tenant,
  Standort, Schicht und Verantwortung bestimmt.
- Browserwerte dürfen Tenant, Standort oder Mitarbeiter nicht vorgeben.
- Schreibende APIs prüfen Rolle und fachlichen Scope; RLS bleibt aktiv.
- Service-Role- und Cron-Secrets werden ausschließlich serverseitig verwendet.
- Verantwortungs-, Aufgaben-, Kontroll- und Bestelländerungen werden
  revisionsfähig protokolliert.

## Abnahme

- Alle früheren Mise-OS-Module öffnen nativ in Neo.
- Es gibt keine zweite Anmeldung, kein SSO-Token und keinen öffentlichen
  Legacy-Schreibpfad.
- Importierte Datensätze sind gezählt, mandantenrein und ohne Duplikate.
- Der alte Datenstand ist gesichert und wiederherstellbar archiviert.
- Desktop-, Mobil-, Rollen-, RLS-, Build- und Regressionstests sind grün.
