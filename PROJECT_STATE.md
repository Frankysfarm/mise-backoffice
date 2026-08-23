# Mise Gastro+�u���T Projektstatus

Aktualisiert: 23.08.2026, Europe/Berlin

## Arbeitspaket 085 — persistentes Split-Payment

- **Erledigt:** POS-Teilzahlungen werden als persistente Split-Sitzung,
  Zahlungsversuche und Positionszuordnungen ausschließlich in Integer-Cent
  geführt. Unterstützt sind freie Beträge, einzelne Positionen und Sitz/Gast.
- **Erledigt:** Bar, SumUp und Stripe können in beliebiger Reihenfolge
  kombiniert werden. Providerzahlungen bleiben reserviert, bis Betrag,
  Währung, Mandant und Zahlungsreferenz serverseitig verifiziert wurden.
  Unsichere Statusabfragen werden mit demselben Versuch erneut geprüft und
  erzeugen keinen zweiten Checkout.
- **Erledigt:** Mandant, Standort, Kasse, offene Schicht, Mitarbeiter und Tisch
  werden serverseitig gebunden; Menüpreise, Optionen, Steuer und Trinkgeld
  werden neu berechnet. Browserrollen haben weder Tabellen- noch RPC-
  Schreibrechte.
- **Erledigt:** Idempotenzschlüssel und Split-Sitzungen sind mit Advisory- und
  Row-Locks serialisiert. Veränderte Wiederholungsdaten, Doppel-Taps,
  Mehrfachzuordnungen, Nullbeträge und Überzahlungen schlagen geschlossen fehl.
- **Erledigt:** Erst bei exakt bezahlter Gesamtsumme wechseln Bestellung und
  POS-Transaktion atomar auf bezahlt. Dadurch erzeugt der bestehende 084-
  Zahlungstrigger genau einen vollständigen Küchenbon; Teilzahlungen bleiben
  für die Küche unsichtbar. Der finale Verkauf wird einmalig TSE-signiert.
- **Erledigt:** Die Touch-Oberfläche zeigt Gesamt, Restbetrag und bisherige
  Zahlungen, bietet Betrag/Position/Sitz sowie Bar/SumUp/Stripe und funktioniert
  per Touch und Tastatur auf Desktop, Tablet und Mobil.
- **Beweise:** 230/230 Vitest-Tests, vollständiger TypeScript-Typecheck,
  Delivery-Typecheck, gezielter ESLint und Next.js-Produktionsbuild
  (113/113 Seiten) bestanden. Die POS-v5-Browserdatei bestand 8/8 Flows in
  Chromium und Mobile Chromium, inklusive Provider-Netzfehler und sicherem
  Status-Retry. Ein separater 1024×768-Lauf bestätigte Fokus und Enter-
  Bedienung, Bar-Teilzahlung, fehlenden horizontalen Overflow und eine
  fehlerfreie Browserkonsole. Migration, Vertragslauf, echte dblink-Races, Double-Tap,
  exakte Küchenfreigabe und Rollback liefen auf PostgreSQL 16 grün. Der
  Rollback entfernt nur 085-Objekte und erhält den 084-Küchenfluss.
- **Security/Dependencies:** keine Dependency- oder Lockfile-Änderung, keine
  Secret-Funde und keine High-/Critical-Advisories. Zwei bestehende Moderate
  (`@anthropic-ai/sdk`, transitiv `uuid`) bleiben unverändert offen.
- **Umgebungshinweis:** Der globale Playwright-Lauf erreichte 14/40; alle 26
  Smoke-Fehler entstanden vor der Anwendung in der Middleware, weil der
  isolierte Worktree bewusst weder `NEXT_PUBLIC_SUPABASE_URL` noch
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` enthält. Die acht relevanten POS-Flows sind
  vollständig grün. Factory nutzt Node 24 statt der Repo-Vorgabe Node 22.
- **Blocker:** keine Code-Blocker. Migration `085` ist vorbereitet, aber nicht
  produktiv angewendet; reale SumUp-/Stripe-Terminals und TSE-Hardware wurden
  nicht belastet. Ein Browser-/Geräteabbruch während einer laufenden
  Providerzahlung gehört zur separaten Offline-Wiederaufnahme.
  **Restzeit P0:** 0.


## Arbeitspaket 084 — persistenter Küchenbonfluss

- **Erledigt:** `kitchen_tickets`, `kitchen_ticket_items` und
  `kitchen_ticket_events` speichern Küchenbons, Stationspositionen,
  Versionsstände und unveränderliche Statusereignisse.
- **Erledigt:** Unbezahlte Karten-/Tischbestellungen speichern zunächst nur ihre
  Positionen. Erst der providerverifizierte Wechsel auf `bezahlt = true`
  erzeugt genau einen Küchenbon im selben Datenbank-Transaktionskontext.
- **Erledigt:** Stripe bestätigt nur tatsächlich bezahlte Sessions und liefert
  bei fehlgeschlagener Freigabe HTTP 500 für einen Provider-Retry. SumUp- und
  weitere serverseitige Zahlungsfreigaben werden durch denselben Trigger erfasst.
- **Erledigt:** Stationsrouting nutzt Kategoriezuweisungen und fällt
  deterministisch auf die erste aktive Standortstation zurück.
- **Erledigt:** Der 24-Stunden-Backfill übernimmt `offen`, `in_arbeit`, `fertig`
  und `storniert` inklusive Zeitstempeln und aggregiert Ticket-/Bestellstatus.
  Quellen werden deterministisch als `qr_table`, `pos`, `staff` oder `legacy`
  eingeordnet; externe Kanäle wie Wolt/Uber bleiben `legacy`.
- **Erledigt:** Statuswechsel sind atomar begrenzt. Mandant, Standort, Station,
  Mitarbeiter und Idempotenz werden serverseitig gebunden; Browserrollen
  besitzen kein RPC-Schreibrecht.
- **Erledigt:** Beide tokenbasierten KDS-Varianten schreiben über die
  geschützte Kitchen-Route. HTTP-409-Idempotenzkonflikte sowie Fetch-/Netzfehler
  werden sichtbar angezeigt; der Legacy-Status bleibt gespiegelt.
- **Beweise:** 218/218 Vitest-Tests, beide TypeScript-Gates, gezielter ESLint,
  Next.js-Produktionsbuild (113/113 Seiten) und `git diff --check` bestanden.
  Migration, Zahlungsfreigabe, Legacy-Backfill, echte parallele Inserts,
  Idempotenzkollision, Tenant-Abgrenzung und Rollback liefen in PostgreSQL 16
  grün. Der Rollback entfernt 084-eigene Objekte und behält vorbestehende
  Kompatibilitätsspalten bewusst bei.
- **Blocker:** keine Code-Blocker. Migration `084` ist vorbereitet, aber nicht
  produktiv angewendet. Factory nutzt Node 24, während das Repo Node 22 fordert;
  alle Gates liefen trotzdem grün. **Restzeit P0:** 0.

## Aktueller Arbeitsstand+�u���T QR-Tischbestellung und POS

Feature-Branch: `factory/table-order-pos-20260822`

- **Erledigt:** QR-Tischbestellung mit sicherer atomarer Bestellung,
  Idempotenz, Suche, Warenkorb-Fortsetzung, Varianten, Cross-Selling,
  Live-Status und konfigurierbarem kontrastgepr�ftem Branding.
- **Erledigt:** POS-Terminal v5 nutzt echte Men�-, Kassen-, Schicht-, Tisch- und
  Mitarbeiterdaten. Bar- und SumUp-Verk�ufe werden serverseitig bepreist,
  providerseitig verifiziert und �ber Migration `083` atomar gespeichert.
  Bons, Drucklink, Bon-E-Mail und einmalige TSE-Signierung sind angebunden.
- **Qualit�t:** 210/210 Vitest-Tests, vollst�ndiger Typecheck, Next.js-15-
  Produktionsbuild und 10/10 relevante Playwright-Flows auf Desktop und
  Pixel-5-Profil bestanden. Migration `083`, SQL-Vertrag und Rollback liefen
  in isoliertem PostgreSQL 16 gr�n. Der gezielte Lint ist warnungsfrei.
- **Sicherheit:** Preise, Optionen, Steuern, Trinkgeld, Mandant, Standort,
  Kasse, Schicht, Tisch und Mitarbeiter werden serverseitig gepr�ft.
  Unbest�tigte SumUp-Zahlungen schlagen geschlossen fehl. Migrationen `082`
  und `083` sind vorbereitet, aber nicht produktiv angewendet.
- **Audit:** keine High- oder Critical-Funde; zwei Moderate in bestehenden
  Abh�ngigkeiten (`@anthropic-ai/sdk` und transitiv `uuid`) bleiben offen.
- **Aktuell:** n�chstes Paket ist der persistente K�chenfluss mit Bons,
  Stationszuordnung und Status�berg�ngen.
- **Blocker:** keine Code-Blocker. Der vollst�ndige historische Smoke-Lauf
  ben�tigt Supabase-Testzugangsdaten, die im isolierten Factory-Browserprofil
  nicht hinterlegt sind; die neuen QR/POS-E2E-Flows laufen vollst�ndig gr�n.
  Factory nutzt au�erdem Node 24, das Repo gibt Node 22 vor.
- **Restzeit:** dieses POS-Checkout-Paket ist release-f�hig auf dem
  Feature-Branch. F�r K�che, Split-Payment, atomare Stornos/Refunds,
  Tischaktionen, Offline-Wiederaufnahme und Hardwareabnahme werden
  voraussichtlich weitere 3�w^~)�w6 konzentrierte Arbeitstage ben�tigt.
- **N�chster Schritt:** persistenten K�chenbonfluss umsetzen und anschlie�end
  Split-Payment sowie Storno/Refund h�rten.

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
