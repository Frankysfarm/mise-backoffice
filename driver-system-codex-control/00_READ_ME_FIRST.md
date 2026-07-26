# Driver-System: kontrollierter Codex-Reparaturplan

## Was der Audit eindeutig zeigt

Das System darf nicht zuerst durch weitere „intelligente“ Dispatch-Regeln erweitert werden. Die aktuelle Hauptursache ist strukturell:

- mehrere Dispatch-Writer und zwei parallele Fahrer-/Batch-Datenwelten;
- nicht-atomare Legacy-Zuweisungen und Merges;
- kritische Statusänderungen direkt aus der Fahrer-Web-App;
- keine zentrale, serverseitig erzwungene State Machine;
- kein reproduzierbares Race-/E2E-/Realgeräte-Release-Gate;
- kein nachgewiesenes natives Hintergrund-GPS;
- eine Fernorder-Hold-Logik, die nur 0/60/180/300 Sekunden vorsieht, nicht persistent gespeichert wird und Küche/echte ETA nicht berücksichtigt.

Der vorhandene Atomic-v1-Entwurf, die reinen Dispatch-Scorer und Teile der Push-/Realtime-Infrastruktur können als Grundlage erhalten bleiben. Sie dürfen aber erst nach einem isolierten Staging-, Datenbank- und Kompatibilitätsnachweis aktiviert werden.

## So wird dieses Paket benutzt

1. Lege dieses Verzeichnis im Haupt-Repository ab, ohne vorhandene Dateien zu überschreiben.
2. Lege auch `DRIVER_SYSTEM_AUDIT.md` und `DRIVER_SYSTEM_FACTS.json` im Repository-Root ab, falls sie dort nicht mehr liegen.
3. Öffne das **Haupt-Repository** in Codex.
4. Kopiere den vollständigen Inhalt von `01_PASTE_THIS_INTO_CODEX.txt` in einen neuen Codex-Thread.
5. Codex muss zuerst Task `T00` ausführen. Noch keine Produktion, keine produktive Migration und kein Feature-Flag aktivieren.
6. Weitere Agenten dürfen nur entsprechend `docs/driver-remediation/EXECUTION_GRAPH.md` gestartet werden.

## Wichtig bei vorhandenen Änderungen

Der Audit nennt bereits uncommitted Änderungen in unter anderem:

- `lib/frank.ts`
- `lib/delivery/intelligent-dispatch.ts`
- `scripts/tests/intelligent-dispatch.test.ts`
- `docs/task-packets/P1-INTELLIGENT-15KM-ELIGIBILITY.md`
- `lib/delivery/long-distance-batching.ts`
- `scripts/tests/long-distance-batching.test.ts`
- `scripts/migrations/275_gps_history_security_retention.sql`

Diese Änderungen dürfen weder zurückgesetzt noch still überschrieben werden. T00 erstellt zuerst einen reproduzierbaren Sicherheits-Snapshot und eine isolierte Remediation-Baseline.

## Ziel

Am Ende existiert nicht nur „Code, der irgendwie läuft“, sondern ein nachweisbar kontrolliertes System mit:

- genau einem serverseitigen Dispatch-Writer je Tenant;
- atomaren, versionierten und idempotenten Zuweisungen;
- serverseitig erzwungenen Order-, Assignment-, Pick-, Pickup- und Delivery-Übergängen;
- technischer Zustellquittierung statt Fahrer-Ablehnungsentscheidung;
- sicheren Ausnahmewegen für Notfall, Fahrzeugproblem, Schichtproblem und GPS-Ausfall;
- sequenziertem GPS-Transport und nativer Hintergrund-Ortung soweit plattformseitig möglich;
- intelligenter Mehrfachbestellungs- und Routinglogik mit echten Zeitfenstern;
- persistenter, überwachten Küchen-/Hold-Entscheidung;
- vollständiger Auditierbarkeit, Simulation, Race-Tests, Device-E2E, Canary und Rollback.
