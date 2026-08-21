# Mise Gastro — System- und Release-Bericht

Stand: 21.08.2026
Branch: `delivery-hardening-20260811`

## Ergebnis

Der lokale Mise-Gastro-Stand ist als zusammenhängender Release Candidate für
Lieferzentrale, Fahrer, Team/Schichten, POS und Lager fertiggestellt. Die
kritischen Abläufe sind nicht nur statisch geprüft, sondern besitzen ausführbare
Verhaltens-, Handler- und Browsertests.

Es wurde bewusst nichts gepusht oder deployed. Produktiv freigegeben ist der
Stand erst, wenn die neuen SQL-Migrationen in der Ziel-Datenbank angewendet, die
benötigten Secrets konfiguriert und der markierte Echtfluss in der Zielumgebung
erfolgreich beendet wurde.

## Module

### Lieferzentrale und Admin

- Delivery-Admin-Routen prüfen aktive Managerrolle, Mandant und Standort.
- Interaktiver Smart-Dispatch ist standortgebunden; globale Cron-Ausführung
  bleibt nur mit internem Token möglich.
- Statuswechsel, Abbruch, Wiederholung und konkurrierende Aktionen liefern
  kontrollierte Ergebnisse statt unzulässiger Sprünge.
- Alte `driver_id`-APIs sind entfernt und antworten explizit mit HTTP 410.
- Delivery-Fenster sowie Bestellstatus verwenden Capability-Tokens.

### Fahrer-App und Dispatch-Algorithmus

- Fahreridentität wird aus der echten Session abgeleitet; Order- und
  Batch-Mutationen prüfen Besitz und Zuordnung.
- Abholung und Zustellung laufen über atomare Datenbankfunktionen.
- QR-Taschenübergabe, Zustellnachweis, Bargeldabschluss und Batch-Abschluss
  werden gemeinsam geprüft.
- Fahrerbewertung berücksichtigt Entfernung, Fahrzeug, Bestellgröße,
  Schicht/GPS-Aktualität, Radius, Kapazität, Auslastung und Tageszeit.
- Ein Claim-Rennen fällt kontrolliert auf den nächsten geeigneten Fahrer zurück.
- Fahrer ohne Kapazität, außerhalb des Radius oder ohne aktuelle Bereitschaft
  werden nicht zugewiesen.

### Team- und Schicht-App

- Geschütztes Mitarbeiterportal mit nächster Schicht, Wochenstunden,
  anstehenden Schichten, Rolle und Standort.
- Berliner Kalenderwochen und Sommer-/Winterzeit werden deterministisch
  berechnet.
- Mitarbeiter sehen zugewiesene Inventuren und können Blindzählungen mobil mit
  großen Touch-Zielen erledigen.
- Team- und Fahrerzugang verwenden eine gemeinsame grün/dunkle Betriebssprache;
  Desktop- und Mobilansichten wurden visuell geprüft.

### Lager und Inventar

- Mandanten- und Standort-RLS für Lieferanten, Artikel, Lagerorte, Wareneingang,
  Ausschuss, Bewegungen, Bestellungen, Inventuren und Zählungen.
- Wareneingang und Inventurabschluss sind atomare Datenbankvorgänge.
- Blindzählung verlangt genau eine Zählung je aktivem Artikel und erzeugt
  nachvollziehbare Bestandsbewegungen.
- Bestellungen an Lieferanten werden lokal, mandantengebunden, idempotent und
  erst nach erfolgreichem E-Mail-Versand als bestellt markiert.

### POS und öffentliche Bestellwege

- POS-Zugriff besitzt keine Pilot-Mandanten-Fallbacks mehr.
- Der QR-Tischweg läuft lokal, validiert QR-Capability, Tisch, Standort,
  verfügbare Artikel, Mengen und Optionspreise serverseitig.
- Der unsichere clientpreisbasierte Cash-Endpunkt ist stillgelegt.
- Eine nie ausgeführte Online-Zahlung wird nicht mehr als bezahlt angezeigt;
  Tischbestellungen bleiben bis zur Kassenbestätigung ausstehend.
- ElevenLabs-Webhooks sind mit HMAC-Signatur und Fünf-Minuten-Replay-Schutz
  fail-closed abgesichert.

## Qualitäts-Gates

Der reproduzierbare Gesamtbefehl lautet:

```bash
pnpm release:gate
```

Verifiziert werden:

- 190/190 Vitest-Unit-, Security-, SQL-Vertrags- und Verhaltenstests,
- Delivery-Typecheck,
- vollständiger Next.js-Produktions-Build mit 214/214 Seiten,
- 24/24 Playwright-Smoke-Tests in Desktop Chrome und mobilem Chromium,
- `git diff --check`.

Der Build enthält weiterhin ältere nicht-blockierende ESLint-Warnungen. Sie
verhindern weder Typecheck noch Produktions-Build; der Bericht behauptet daher
bewusst keinen warnungsfreien Gesamt-Lint.

## Neue Datenbankmigrationen

In dieser Reihenfolge anwenden:

1. `scripts/migrations/072_atomic_driver_delivery_flow.sql`
2. `scripts/migrations/073_inventory_tenant_integrity.sql`

Vorher Datenbank-Snapshot erstellen, danach Funktionsrechte und RLS-Policies in
der Zielumgebung prüfen.

## Konfiguration vor Produktivfreigabe

- `ELEVENLABS_WEBHOOK_SECRET` setzen und den identischen Secret-Wert im
  ElevenLabs-Webhook hinterlegen.
- Resend-Absender pro Mandant verifizieren, wenn Lieferantenbestellungen per
  E-Mail verschickt werden sollen.
- Stripe/SumUp, Push und interne Cron-Tokens in der Zielumgebung kontrollieren.
- Vier klar markierte Testzugänge bereithalten: Manager, Küche/POS, Fahrer,
  Mitarbeiter.

## Letztes Live-Gate

1. Migrationen anwenden.
2. Markierte Testbestellung auslösen.
3. Bestellung durch Küche und Lieferzentrale führen.
4. Fahrerzuweisung, Annahme, Abholung, QR-Handoff, GPS und Zustellung prüfen.
5. Mitarbeiter-Schicht und zugewiesene Blindinventur prüfen.
6. Lieferanten-Testbestellung an eine kontrollierte Empfängeradresse senden.
7. Testdaten soft stornieren/archivieren.
8. Erst danach deployen und dieselben Smoke-Checks erneut ausführen.

## Wiederherstellung

Vor Beginn existieren Recovery-Sicherungen unter `/Users/eule/mise-recovery/`.
Die entfernte alte Fahrer-Login-Sicherung liegt unter
`/Users/eule/mise-recovery/legacy-source-20260821/`.

Verdikt: **lokal releasefähig; Produktivfreigabe wartet auf Migrationen,
Ziel-Secrets und den authentifizierten Echtfluss.**
