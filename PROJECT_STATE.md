# Mise Gastro — Projektstatus

Aktualisiert: 23.08.2026, Europe/Berlin

## Aktueller Arbeitsstand — QR-Tischbestellung und POS

Feature-Branch: `factory/table-order-pos-20260822`

- **Erledigt:** QR-Tischbestellung mit sicherer atomarer Bestellung, Idempotenz,
  Suche, Warenkorb-Fortsetzung, Varianten, Cross-Selling, Live-Status und
  konfigurierbarem kontrastgeprüftem Branding. QR-Design kann pro Mandant mit
  Primär-/Akzentfarbe, Begrüßung und CTA angepasst werden.
- **Qualität:** 202/202 Vitest-Tests, vollständiger Typecheck, Next.js-15-
  Produktionsbuild, 4/4 Playwright-Flows auf Desktop und Pixel-5-Profil,
  SQL-Migration/Vertrag/Rollback in isoliertem PostgreSQL 16 sowie
  `git diff --check` bestanden. Dependency-Audit: keine High- oder Critical-
  Findings; zwei Moderate verbleiben.
- **Sicherheit:** Preise, Optionen, Mandant, Standort und Tisch werden serverseitig
  geprüft; Bestellerstellung läuft atomar über eine service-role-geschützte RPC.
  Migration `082` ist vorbereitet, aber noch nicht produktiv angewendet.
- **Aktuell:** nächstes Paket ist die POS-Härtung mit Schicht/Kassenlade,
  Tischtransfer, Split-Payment, Storno/Refund, Bon/Küche und Restaurant-E2E.
- **Blocker:** keine Code-Blocker. Factory nutzt derzeit Node 24, während das Repo
  Node 22 vorgibt; die Gates laufen grün, die Release-Umgebung soll vor Deployment
  dennoch auf Node 22 vereinheitlicht werden.
- **Restzeit:** QR-Paket ist release-fähig auf dem Feature-Branch. Für vollständige
  POS-Härtung und realistische Betriebsabnahme werden voraussichtlich 4–7
  konzentrierte Arbeitstage benötigt.
- **Nächster Schritt:** Feature-Branch pushen, anschließend POS-Lückenmatrix und
  ersten durchgängigen Kassen-/Tisch-/Küchenfluss umsetzen.

## Release-Status

Der operative Kern von Mise Gastro ist produktiv einsatzbereit:

- Lieferzentrale/KDS und abgesicherte Manager-Aktionen
- Fahrer-App, Dienststatus, GPS-/Push-Vertrag, Frank-Dispatch und Touren
- Küche, signierte Beutel-QR-Übergabe, Abholung und Zustellung
- Mitarbeiterportal mit Schichten und mobiler Blindinventur
- Lagerverwaltung mit Artikeln, Inventuren und eindeutigem Bewegungsprotokoll
- POS, Tisch-QR und öffentliche Tracking-Wege mit Capability-Schutz
- Owner-PWA und Fahrer-PWA mit getrennten Service-Worker-Scopes

Produktiv:

- URL: `https://mise-gastro.de`
- aktiver Container: `mise_backoffice_3310`
- Containerstatus: `running`, 0 Restarts
- ausgelieferter App-Commit: `8a7ee903a05eea1157b1b0b50d61e6e5eb5de3d4`
- vollständiger Release-Quellstand: `10dc29a72`
- Branch: `delivery-hardening-20260811`
- Datenbankmigrationen produktiv: `072`, `073`, `074`, `075`, `076`

Der App-Container und der Quellstand unterscheiden sich nur durch die bereits
produktiv angewendeten SQL-Migrationen, ihre Tests und das reproduzierbare
Live-E2E-Skript. Es gibt keine noch nicht deployte App-Laufzeitänderung.

## Abgenommene Live-Abläufe

### Lieferung und Fahrer

Der komplette markierte Trainingsfluss lief gegen Produktion erfolgreich:

1. Bestellung `neu` angelegt.
2. Lieferzentrale bestätigte die Bestellung.
3. Küche wechselte auf `in_zubereitung` und `fertig`.
4. Frank wählte ausschließlich den verfügbaren QA-Fahrer und erzeugte die Tour.
5. Fahrer scannte den signierten Beutel-QR-Code.
6. Custody, Pickup-Stopp, Bestellung `unterwegs`, Tour und Fahrerstatus wurden
   gemeinsam committed.
7. Zustellung setzte Order, Lieferzeitpunkt, Drop-off und Batch atomar fertig.
8. Eine identische zweite Zustellbestätigung war ein erfolgreicher No-op.

Finale Evidenz:

- Trainingsorder: `a492d088-b193-4ad8-b044-79bafaa2acbe`
- Batch: `de7b8c9e-d9b2-4d89-b9e0-e2512ea1f28a`
- Order: `geliefert`, `geliefert_am` gesetzt
- Batch: `completed`, `handoff_state=committed`
- Pickup- und Drop-off-Stopp: abgeschlossen
- Fahrer: `returning`, Kapazität `0`
- E2E-Skript: `scripts/qa/release-delivery-e2e.mjs`

Der erweiterte Algorithmus-Lasttest mit 40 Trainingsbestellungen bestand
ebenfalls: 20 Touren, keine Überkapazität, Verteilung 10/12/9/9 auf vier Fahrer,
Dispatch-p95 707 ms. Geprüft wurden außerdem Richtungsbundling,
Gegenrichtungs-Sperre, pausierte/veraltete/pushlose Fahrer, Ablaufzeiten,
Claim-Rennen und Berliner Tageswechsel.

### Mitarbeiter und Lager

- Mobile Mitarbeiteransicht zeigte nächste Schicht, Wochenstunden und Aufgaben.
- Eine zugewiesene Blindinventur wurde auf 390 px vollständig durchgeführt.
- Zwei Artikel erzeugten nach Migration `074` exakt zwei Bestandsbewegungen.
- Temporäre Schicht-, Rollen- und Lagerfixtures wurden nach der Abnahme gelöscht.
- Alle vier QA-Fahrer wurden wieder `off_duty`/`offline` gesetzt.

### Oberfläche

Visuell geprüft wurden Lieferzentrale, Mitarbeiter-Start, mobile Blindzählung,
Lager-Dashboard, Produktbestand und Inventur-Sessions.

- Desktop 1440 × 900 und Mobil 390 × 844
- kein horizontaler Überlauf
- keine Page Errors, Console Errors oder fehlgeschlagenen Laufzeit-Requests
- Mindest-Touchziel im Mitarbeiterportal: 44 × 44 px
- Creative-Design-Release-Rubrik: 25/30, kein Kriterium mit 0

## Release-Gates

Am finalen Quellstand bestanden:

- 193/193 Vitest-Unit-, Security-, SQL-Vertrags- und Verhaltenstests
- vollständiger TypeScript-Typecheck
- Delivery-Typecheck
- Next.js-Produktionsbuild, 214/214 Seiten
- 28/28 Playwright-Smokes in Desktop Chrome und Mobile Chromium
- produktiver Delivery-Healthcheck: HTTP 200, Datenbank `ok`
- Owner-Service-Worker: HTTP 200, JavaScript, keine Auth-Weiterleitung
- `git diff --check`

Der Build enthält ältere, nicht blockierende ESLint-Warnungen. Der Release ist
type- und build-sauber, aber nicht als global warnungsfreier Lint-Stand deklariert.

## Wiederherstellung

Produktive Datenbanksicherungen:

- `/opt/mise/backups/mise-pre-074-20260821T234230Z.dump`
- `/opt/mise/backups/mise-pre-075-20260822T003100Z.dump`
  - SHA-256: `63e4dcc57401e2f578c7b50ab9f48b018168e406ab6acc09fbafdf8f4e2e65f2`
- `/opt/mise/backups/mise-pre-076-20260822T003600Z.dump`
  - SHA-256: `b8f8e1fc6bde2e640823f22c8d1e9fe4cf7dd152d2063100406d85cbc12a9170`

Lokale Recovery-Daten liegen unter `/Users/eule/mise-recovery/`.
Das Blue/Green-Deployment kann auf den vorherigen Container/Port zurückgeschaltet
werden; Datenbank-Rollback erfolgt aus dem jeweils unmittelbar davor erzeugten Dump.

## Bewusst nicht aktivierte externe Module

Folgende Integrationen sind ohne kundenseitige Zugangsdaten weiterhin deaktiviert
oder fail-closed. Sie blockieren Lieferzentrale, Fahrer, Team, Lager und lokale
POS-Abläufe nicht:

- Stripe-Onlinezahlungen und Stripe-Webhooks
- ElevenLabs-Sprachbestellungen
- Resend-Lieferantenmails
- Fiskaly/TSE-Cloudbereitstellung
- AWS-WORM-Archiv
- Twilio-Kommunikation
- optionale OpenAI-/Anthropic-Funktionen im Produkt

Bereits produktiv vorhanden sind Datenbank-/interne Tokens, Web-Push/VAPID,
APNS und Google Maps. Secrets werden nicht in diesem Dokument gespeichert.

## Nächste kontrollierte Arbeit

Nur noch Produkt-/Provider-Entscheidungen sind offen: gewünschte externe Module
auswählen, Zugangsdaten sicher hinterlegen und je Integration einen Sandbox- und
Produktionscheck ausführen. Der gastronomische Kernbetrieb ist davon unabhängig
einsatzbereit.
