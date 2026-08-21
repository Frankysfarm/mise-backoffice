# Mise Gastro / Lieferzentrale — Release-Bericht

Stand: 21.08.2026
Branch: `delivery-hardening-20260811`

## Ergebnis

Der lokale Release-Stand ist buildbar, browserstartfähig und gegen die im Audit
bestätigten Mandantentrennungsfehler gehärtet. Ein Deployment wurde bewusst noch
nicht ausgelöst. „Live fertig“ ist der Stand erst nach einem authentifizierten,
markierten Testauftrag durch Bestellung, Küche, Dispatch, Fahrer und Zustellung
sowie dem anschließenden Smoke-Test in der Zielumgebung.

## Verifizierte Qualitäts-Gates

- Node 22 und pnpm 10 als festgelegte Toolchain
- 16 Vitest-Dateien, 137 Tests bestanden
- Delivery-Typecheck ohne Fehler
- vollständiger Next.js-Produktions-Build, 212/212 Seiten erzeugt
- 8/8 Playwright-Smoke-Tests auf Desktop und Mobile bestanden
- `git diff --check` ohne Whitespace-Fehler
- Lint ohne Fehler; ältere nicht-blockierende Warnungen bleiben sichtbar

## Behobene Release-Defekte

### Lieferfluss

- Öffentlicher Fahrer-Klingelton wird nicht mehr zum Login umgeleitet.
- Der Admin-Lieferstatus ist jetzt eine serverseitige Zustandsmaschine:
  `neu → bestätigt → in_zubereitung → fertig → unterwegs → geliefert`.
- Abholung und Stornierung besitzen getrennte erlaubte Übergänge.
- Ungültige Sprünge und konkurrierende Statusänderungen liefern HTTP 409.
- Erneutes Annehmen oder wiederholte Zustellaktionen sind idempotent bzw.
  werden kontrolliert abgewiesen.

### Mandanten- und Standorttrennung

Standortbezogene Service-Role-Abfragen prüfen nun aktive Admin-Rolle, Mandant
und Standort, bevor Daten gelesen oder verändert werden. Gehärtet wurden unter
anderem:

- Alerts und Alert-Regeln
- Broadcasts und Benachrichtigungskonfiguration
- Fahrerlisten, Fahreränderungen und GPS-Spuren
- Health-Details, Push-Statistik und Performance
- Forecast, Heatmap, Events, SLA und Trends
- Reports und CSV-Exporte
- Webhooks einschließlich Testversand
- Gebühren, Auszahlungen und Abrechnungsperioden
- Kundenzufriedenheit
- Vorbestellungen und fehlgeschlagene Zustellversuche

Globale Admin-Aktionen wie `release_all` und `release_retries` sind für
interaktive Admin-Aufrufe jetzt auf den autorisierten Standort begrenzt. Die
öffentliche Health-Antwort enthält nur noch DB-Erreichbarkeit; Betriebszahlen
erfordern einen autorisierten Standortzugriff.

## Tests mit echter Handler-Ausführung

Zusätzlich zu den bestehenden Vertragsprüfungen rufen Security-Tests die
betroffenen Route-Handler mit fremden Standort-IDs auf. Sie belegen, dass vor
Service-Role-Zugriffen HTTP 403 zurückgegeben und weder Alerts, Webhooks,
Reports noch globale Freigaben ausgeführt werden. Eine reine Logikprüfung führt
den vollständigen erlaubten Bestellstatuspfad aus und prüft verbotene Sprünge.

## Wiederherstellung und Arbeitsbaum

Vor der Härtungsrunde wurden Git-Historie und aktueller Quellstand gesichert:

- `/Users/eule/mise-recovery/mise-delivery-hardening-release-pre-finish-20260821.bundle`
- `/Users/eule/mise-recovery/mise-delivery-hardening-release-pre-finish-20260821.tgz`

Lokale Debug-/Adminskripte und alte Fahrer-Backups wurden aus dem Release-Ordner
nach `/Users/eule/mise-recovery/local-debug-scripts-20260821/` verschoben. Sie
sind nicht Teil des Releases und bleiben mit restriktiven Dateirechten
wiederherstellbar.

## Noch erforderliche Live-Gates

1. Authentifizierten Testauftrag mit Testkennzeichnung vollständig durchspielen.
2. Testdaten ausschließlich soft stornieren/archivieren; keine Produktionsdaten
   hart löschen.
3. Release-Änderungen in einem nachvollziehbaren Commit sichern.
4. Über den vorgesehenen Zero-Downtime-Prozess deployen.
5. Nach Deployment Login, Health, Küche, Dispatch, Fahrer-App und Tracking erneut
   gegen die Zielumgebung prüfen.

Ohne diese fünf Schritte lautet das ehrliche Verdikt: **lokal releasefähig, aber
noch nicht produktiv freigegeben**.
