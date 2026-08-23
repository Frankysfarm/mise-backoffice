# Tischbestellung & POS — Designbrief

## Produktauftrag

Mise Gastro erweitert den bestehenden operativen Kern, statt ein zweites
Bestellsystem aufzubauen. Gäste scannen den QR-Code ihres Tisches, stellen ihre
Bestellung in wenigen mobilen Schritten zusammen, erhalten passende Ergänzungen
und verfolgen den Status. Service und Kasse übernehmen dieselbe Bestellung ohne
erneute Eingabe in den vorhandenen POS-, Küchen- und Bonfluss.

## Zielgruppen und wichtigste Aufgaben

- **Gast am Tisch:** Tisch eindeutig erkennen, Speisen schnell finden,
  Varianten sicher wählen, Bestellung kontrollieren, Zahlweg auswählen und
  Status verstehen.
- **Service/Kasse:** offene Tischbestellung sofort zuordnen, Zahlung sicher
  übernehmen, Küche auslösen, Bon erzeugen und Doppelbuchungen vermeiden.
- **Filialleitung:** Branding, Menü, Upsells, Tische und QR-Druck pro Standort
  konfigurieren sowie Umsatz und operative Auffälligkeiten auswerten.

## Informationshierarchie

1. Restaurant und sichtbarer Tisch-Kontext
2. Suche und schnelle Kategorien
3. Produkte mit Bild, Preis, Beschreibung und relevanten Kennzeichnungen
4. Varianten und Notiz
5. persistenter Warenkorb mit eindeutiger Summe
6. kontextbezogene Ergänzungen
7. Zahlweg, Bestellnummer und Live-Status

## Gestaltungsrichtung: Counter Culture

Die Oberfläche wirkt wie ein modernes, eigenständiges Restaurantprodukt:
editoriale Food-Fotografie, klare typografische Kontraste, helle warme
Grundfläche und die Farben des jeweiligen Mandanten. Das wiederkehrende
Signature-Element ist der **Table Beacon**: eine kompakte, kontrastreiche
Tischmarke im Hero, Warenkorb, Checkout und Bestellstatus.

Mandanten steuern Logo, Hero-Bild, Primärfarbe, Akzentfarbe, Begrüßung und
CTA-Texte. Sichere Kontrast-Fallbacks verhindern unlesbare Kombinationen.

## Interaktion

- Mobile first für 360–430 px, danach Tablet und Desktop.
- Touchziele mindestens 44 × 44 px, sichtbarer Tastaturfokus.
- Eine Hauptaktion pro Zustand; keine Popup-Kaskaden.
- Cross-Sells sind auf höchstens vier passende Produkte begrenzt und können
  übersprungen werden.
- Warenkorb und laufende Bestellung überleben Reloads.
- Doppelklick, Retry und instabile Verbindung erzeugen keine zweite Order.
- Bewegung unterstützt Orientierung und respektiert
  `prefers-reduced-motion`.

## Zustände

Für Laden, leeres Menü, leere Suche, Validierungsfehler, Requestfehler,
Zahlung offen, bezahlt, in Zubereitung, fertig und unbekannten Status existiert
je ein verständlicher Zustand mit konkreter nächster Handlung.

## Technische Leitplanken

- Bestehendes Next.js-, Supabase-, Tailwind- und POS-System verwenden.
- Preise und Optionen ausschließlich serverseitig gegen den Produktstamm
  auflösen.
- Tisch-QR und Tracking-Token als getrennte Capabilities behandeln.
- Order und Positionen atomar schreiben; Idempotenzschlüssel erzwingen.
- Direkte Browser-Schreibrechte nicht erweitern.
- Keine externe Bestellung, echte Zahlung, Production-Migration oder
  Deployment ohne separate Freigabe.

## Anti-Ziele

- kein McDonald's-Klon und keine fremden Markenbestandteile
- kein generisches SaaS-Dashboard für Gäste
- keine dekorativen Glas-/Gradienteneffekte ohne Funktion
- keine aggressiven Upsell-Popups oder versteckten Kosten
- kein Client-Preisvertrauen und keine stille Fehlerbehandlung
