/**
 * Zentrale Modul-Daten für die Marketing-Seite.
 * Keine Spielereien — jedes Automations-Bullet ist im Produkt umgesetzt oder geplant.
 */

export type ModuleContent = {
  slug: string;
  id: string;
  icon: string;
  badge: string;
  title: string;               // H1 auf Detail-Page
  tagline: string;             // Kurz, 1 Satz, steht auf Main-Seite
  headline: string;            // Große Section-Headline auf Main
  subline: string;             // Ergänzung dazu
  demo: 'schedule' | 'inventory' | 'ordering' | 'kitchen' | 'delivery' | 'pos' | 'analytics' | 'platforms' | 'cleaning' | 'checkup' | 'training' | 'notifications';
  /** 3-5 konkrete Automations-Features — das Herz der Deep-Dive-Seite */
  automations: { title: string; body: string }[];
  /** Was man als Restaurant davon konkret hat — in € und Zeit */
  roi: { metric: string; value: string; note: string }[];
  /** Alle Features in Liste-Form */
  features: string[];
  /** Vergleich: was hattest du vorher, was hast du jetzt */
  comparison: { before: string; after: string }[];
  /** Kurze FAQ 3-4 Fragen */
  faq: { q: string; a: string }[];
  /** Wichtigster ROI-Claim fürs Main-Stat-Chip */
  stat: { value: number; prefix?: string; suffix?: string; label: string };
};

export const MODULES: ModuleContent[] = [
  /* ======================= DELIVERY — GOLD STANDARD ======================= */
  {
    slug: 'lieferung',
    id: 'delivery',
    icon: '🛵',
    badge: 'Lieferung',
    title: 'Jede Fahrt optimiert. Automatisch.',
    tagline: 'Route-Clustering, Retour-Erkennung, Live-GPS — spart Sprit und Zeit.',
    headline: 'Deine Fahrer wissen, wohin. Dein System weiß, wann.',
    subline:
      'Fahrer-App mit GPS-Tracking, Auto-Clustering nach Strecke, Retour-Erkennung — deine Küche plant den nächsten Auftrag perfekt getaktet.',
    demo: 'delivery',
    automations: [
      {
        title: '🧠 Mixed-Fleet-KI: richtige Tour an richtiges Fahrzeug',
        body:
          'Dein System weiß, welcher Fahrer welches Gefährt hat — Fuß, Fahrrad, E-Bike, Roller, Auto. Eine Bestellung 2 km entfernt geht automatisch ans E-Bike (kein Sprit, keine Parkplatz-Suche). Eine 12 km entfernte Tour ans Auto. Die KI entscheidet in Echtzeit — niemand braucht mehr zu telefonieren oder zu disponieren.',
      },
      {
        title: '🚲 Fahrer ohne Führerschein & ohne eigenes Auto',
        body:
          'Der Gastro-Arbeitsmarkt ist leer — Auto-Fahrer mit Klasse B sind rar und teuer. Mit E-Bikes + Fahrrädern im Mix stellst du Studenten, junge Leute, Quereinsteiger ein. Keine Führerschein-Prüfung, keine Versicherungs-Dramen, keine Firmenwagen-Kosten. Der Bewerber-Pool wird 5× größer.',
      },
      {
        title: '⛽ 0 € Sprit für kurze Touren',
        body:
          'Bestellungen < 6 km schickt das System automatisch an E-Bikes — null Treibstoff-Kosten, null CO₂, weniger Verschleiß am Firmenwagen. Bei 50 Orders/Tag im Stadtradius sparst du im Schnitt 80 € Sprit pro Woche.',
      },
      {
        title: 'Auto-Routen-Optimierung',
        body:
          'Sobald 2 oder mehr Bestellungen in < 600 m Luftlinie bereitstehen, werden sie automatisch zu einer Tour zusammengefasst. Der Algorithmus berechnet die kürzeste Route (Nearest-Neighbor) und sortiert die Stops. Ergebnis: 20–30 % weniger Kilometer bei gleicher Order-Zahl — und damit spürbar weniger Sprit.',
      },
      {
        title: 'Retour-Erkennung für Küche',
        body:
          'Das System erkennt per GPS wann ein Fahrer sich der Filiale nähert (< 200 m). Die Küche bekommt eine Benachrichtigung: „Mira in 3 Min zurück" — dann wird das nächste Ticket getimed angestoßen. Nie wieder kalte Speisen durch Doppel-Runden oder Leerlauf-Fahrer.',
      },
      {
        title: 'Live-Tracking für Kunden',
        body:
          'Jeder Kunde bekommt einen Tracking-Link mit der Bestellnummer. Live-Karte, Fahrer-Position, ETA, Chat-Funktion. 40 % weniger „Wo ist mein Essen?"-Anrufe.',
      },
      {
        title: 'Auto-Kassierung bei Bar/Karte',
        body:
          'Wenn der Fahrer „Kassiert & übergeben" drückt, wird automatisch ein POS-Bon mit order_id gebucht. Bei Bar-Zahlung landet das Geld im Tages-Z-Bericht. Keine manuelle Nacherfassung.',
      },
      {
        title: 'Bezahlmethoden im Blick',
        body:
          'Fahrer sieht vor der Fahrt schon: „Sofia Rossi · online bezahlt" vs. „Tim Wagner · 18,30 € Bar fällig". Keine Überraschung an der Tür, immer genug Wechselgeld dabei.',
      },
    ],
    roi: [
      { metric: '−23%', value: 'Kilometer', note: 'dank Route-Clustering bei ≥3 Fahrten/Stunde' },
      { metric: '+20%', value: 'Orders/Fahrer', note: 'bei gleichbleibender Lieferzeit' },
      { metric: '5×', value: 'Bewerber-Pool', note: 'mit E-Bikes statt nur Auto-Fahrern' },
      { metric: '−100%', value: 'Sprit < 6 km', note: 'E-Bike-Touren fahren ohne Benzin' },
      { metric: '−40%', value: 'Rückfragen', note: 'durch Live-Tracking-Link statt Anruf' },
      { metric: '0 €', value: 'Mehrkosten', note: 'keine separate Dispatch-Software wie Urbantz' },
    ],
    features: [
      'Fahrer-App: Adresse · Etage · Türcode · Zahlungsart in einem Blick',
      '🧠 KI-Dispatch: Fahrzeug-Matching nach Distanz (Fuß / Fahrrad / E-Bike / Roller / Auto)',
      'Fahrer ohne Führerschein einstellbar — Studenten, Quereinsteiger',
      'Konfigurierbare Reichweiten pro Fahrzeug (z.B. E-Bike bis 6 km, Auto ab 10 km)',
      'Auto-Batching nach Luftlinie < 600 m',
      'Nearest-Neighbor-Routenplanung ab Filiale',
      'GPS-Push alle 15 Sekunden (Battery-Saver)',
      'Chat: Fahrer ↔ Kunde ↔ Küche',
      'Kunden-Tracking-Seite (öffentlich, keine App)',
      'Bei Bar-Zahlung: Auto-POS-Bon mit order_id',
      'Retour-Detection ≤ 200 m zur Filiale',
      'Dispatch-Board im Backoffice (manueller Override)',
    ],
    comparison: [
      { before: 'Nur Auto-Fahrer → Bewerber-Mangel, Führerschein-Prüfung, Versicherung', after: 'E-Bike-Fahrer ohne Führerschein — 5× größerer Bewerber-Pool' },
      { before: 'Alle Lieferungen mit Firmenwagen → voller Sprit-Tank pro Woche', after: 'Kurze Touren per E-Bike, weite per Auto — 0 € Sprit im Stadtradius' },
      { before: 'Papierliste mit Adressen, Wechselgeld raten', after: 'Smartphone mit Auto-Route, Zahlungsart pro Stop' },
      { before: 'Fahrer ruft an: „Bin gleich zurück"', after: 'Küche sieht automatisch: „Mira in 3 Min zurück"' },
      { before: 'Kunde ruft 3× an: „Wann kommt die Bestellung?"', after: 'Kunde klickt den Link im Bestätigungs-SMS' },
      { before: 'Fahrer kassiert bar → vergisst es → fehlt im Z-Bericht', after: 'Auto-POS-Bon, sofort im Kassen-Tagesabschluss' },
    ],
    faq: [
      { q: 'Kann ich Fahrer ohne Führerschein einstellen?', a: 'Ja — genau das ist der Trick. Für E-Bike / Fahrrad brauchst du keinen Führerschein. Du stellst Studenten, Schüler (ab 15, zweckgebunden), Quereinsteiger ein. Das macht den Bewerber-Pool 5× größer.' },
      { q: 'Wie entscheidet die KI, welches Fahrzeug welche Tour macht?', a: 'Pro Tenant legst du Reichweiten fest (z.B. E-Bike ≤ 6 km, Auto ab 10 km). Das System berechnet die Luftlinie Restaurant → Kunde per Haversine, filtert passende Fahrzeuge und wählt den nächstgelegenen freien Fahrer mit dem richtigen Gefährt.' },
      { q: 'Was spare ich an Sprit im Schnitt?', a: 'Bei 50 Orders/Tag im 6-km-Radius: ca. 80 € Sprit pro Woche, wenn E-Bikes die Kurzstrecken übernehmen. Plus weniger Verschleiß, weniger Versicherungen, weniger Werkstatt-Termine am Firmenwagen.' },
      { q: 'Brauche ich spezielle Hardware für die Fahrer?', a: 'Nein. Android- oder iPhone-App, GPS + Datenplan reicht. Funktioniert auch auf älteren Geräten.' },
      { q: 'Wie sicher ist das GPS-Tracking für den Fahrer?', a: 'GPS läuft nur während aktiver Tour. Wenn der Fahrer offline ist, wird nichts erfasst. Alle Daten sind pro Tour gruppiert und nach 30 Tagen anonymisiert.' },
      { q: 'Was passiert, wenn nur 1 Bestellung fertig ist?', a: 'Normale Einzel-Lieferung. Auto-Batching greift erst ab 2 parallelen Orders im Radius.' },
      { q: 'Kann ich die Route manuell anpassen?', a: 'Ja, im Backoffice-Dispatch kannst du Stops umordnen oder dem Fahrer direkt zuweisen.' },
    ],
    stat: { value: 23, prefix: '−', suffix: '%', label: 'weniger Kilometer pro Tag' },
  },

  /* ======================= DIENSTPLAN ======================= */
  {
    slug: 'dienstplan',
    id: 'operations',
    icon: '📅',
    badge: 'Team',
    title: 'Dienstplan, der das Arbeitsrecht kennt.',
    tagline: 'Drag-and-Drop, Verfügbarkeiten verschmelzen automatisch, ArbZG-Check im Hintergrund.',
    headline: 'Dienstplan in 10 Minuten. Statt 2 Stunden.',
    subline:
      'Wünsche deiner Mitarbeiter, Verfügbarkeiten, Krank- und Urlaubsmeldungen — alles fliesst live in den Wochenplan. Arbeitszeitgesetz wird automatisch geprüft.',
    demo: 'schedule',
    automations: [
      {
        title: 'Verfügbarkeit wird live eingeblendet',
        body:
          'Jeder Mitarbeiter trägt einmal seine Verfügbarkeit ein (morgens, Wochenende, etc.). Beim Planen siehst du sofort: wer kann Freitag 18 Uhr? Wer nicht? Kein Excel, kein Zurückrufen.',
      },
      {
        title: 'ArbZG-Validator live',
        body:
          'Bei jedem Drag-and-Drop prüft das System: 11 h Ruhezeit zwischen Schichten? Max. 10 h/Tag? Max. 48 h/Woche? Warnung erscheint direkt im Slot. Kein Risiko, bei Kontrollen erwischt zu werden.',
      },
      {
        title: 'Schichttausch ohne Manager',
        body:
          'Mira kann in der App Ihre Schicht zum Tausch anbieten. Jamal nimmt sie an → Plan wird automatisch aktualisiert. Manager bekommt Info-Mail, muss aber nicht eingreifen.',
      },
      {
        title: 'Urlaub & Krank fließt ein',
        body:
          'Urlaubsantrag genehmigt → die Tage sind im Plan als „nicht verfügbar" gesperrt. Krankmeldung morgens → System schlägt direkt Ersatz aus verfügbarer Reserve vor.',
      },
    ],
    roi: [
      { metric: '−82%', value: 'Planungszeit', note: 'Wochenplan statt 2 h nur noch 10 Min' },
      { metric: '0 Kontrollstrafen', value: '', note: 'dank ArbZG-Validator' },
      { metric: '+30%', value: 'Zufriedenheit', note: 'Mitarbeiter-NPS steigt durch Mitbestimmung' },
    ],
    features: [
      'Drag-and-Drop Wochenplan',
      'ArbZG § 3 und § 5 Validator',
      'Verfügbarkeits-Overlay',
      'Wunschstunden (Mitarbeiter trägt selbst ein)',
      'Schichttausch mit Auto-Approval',
      'Bewerbungs-Wizard integriert',
      'Probe-Bewertung nach 3 Schichten',
      'PDF-Export zum Aushang',
      'iCal-Export für Mitarbeiter',
      'Stempel-Erfassung via QR am Tresen',
    ],
    comparison: [
      { before: 'Excel-Tabelle, die keiner aktuell hat', after: 'Live-Plan, den jeder sieht' },
      { before: 'WhatsApp-Chaos beim Tausch', after: 'In-App-Tausch mit einem Klick' },
      { before: '2 Stunden pro Woche für Schichtplanung', after: '10 Minuten' },
      { before: 'Arbeitszeitgesetz? Hoffen, dass es passt', after: 'Live-Validator zeigt jeden Verstoß' },
    ],
    faq: [
      { q: 'Können meine Mitarbeiter die App auch als Stempeluhr nutzen?', a: 'Ja. QR-Code am Tresen, Smartphone scannt, Stempel drin. Geofence-Check verhindert Home-Stempeln.' },
      { q: 'Ist der ArbZG-Validator auch für Minijobber?', a: 'Ja, für alle Beschäftigungstypen. Minijob-Grenzen (520 €/Monat) werden zusätzlich geprüft.' },
      { q: 'Was wenn ich komplexere Regeln brauche?', a: 'Über die Rollen (mitarbeiter/teamleiter/manager) und Departments sind 95 % der Szenarien abgedeckt. Custom-Regeln auf Anfrage.' },
    ],
    stat: { value: 82, prefix: '−', suffix: '%', label: 'weniger Planungszeit pro Woche' },
  },

  /* ======================= LAGER ======================= */
  {
    slug: 'lager',
    id: 'inventory',
    icon: '📦',
    badge: 'Lager',
    title: 'Lager-Engpässe? Vorbei.',
    tagline: 'Par-Level-Alerts, FIFO-Chargen, Schwund-Erkennung pro Artikel.',
    headline: '24h vor Mangel: Alarm. Bestell-Vorschlag inklusive.',
    subline:
      'Bestand pro Zone, Blind-Count für präzise Inventur, automatische Nachbestellvorschläge bei Unterschreiten des Mindestbestands.',
    demo: 'inventory',
    automations: [
      {
        title: 'Par-Level-Alert & Auto-Reorder',
        body:
          'Jedes Produkt hat einen Mindestbestand (Par-Level). Fällt der Bestand drunter, erscheint automatisch ein Reorder-Vorschlag. Ein Klick → Bestellung geht an den Lieferanten (via E-Mail oder API bei Metro).',
      },
      {
        title: 'FIFO-Chargen-Tracking',
        body:
          'Beim Wareneingang wird eine Charge mit MHD angelegt. Das System berechnet automatisch, welche Charge zuerst raus muss. Waste durch abgelaufene Ware sinkt drastisch.',
      },
      {
        title: 'Schwund wird sichtbar',
        body:
          'Jeder Bruch, jede Entsorgung wird erfasst (1 Klick aus Tablet). Am Monatsende: Top-5-Schwund pro Produkt. „Ach, wir werfen jeden Monat 200 € Banane weg?" → Mengen anpassen, Problem gelöst.',
      },
      {
        title: 'Preis-Historie & Lieferanten-Vergleich',
        body:
          'Jeder Wareneingang speichert den Preis. Drei Lieferanten für Matcha-Pulver? Du siehst auf einen Blick wer dieses Jahr günstiger war. Verhandeln wird Fakten-basiert.',
      },
    ],
    roi: [
      { metric: '−37%', value: 'Schwund', note: 'durch Sichtbarkeit + FIFO' },
      { metric: '−8%', value: 'Food-Cost', note: 'durch bessere Lieferanten-Verhandlungen' },
      { metric: '+15 Min', value: 'am Abend', note: 'keine Last-Minute-Bestellung mehr' },
    ],
    features: [
      'Fach-basierte Inventur',
      'Blind Count (keine Vorgabe beim Zählen — verhindert Schätzen)',
      'Karton + Lose-Erfassung',
      'Lieferanten-CRUD + Preise historisch',
      'Schwund-Erfassung mit Grund',
      'Auto-Reorder-Vorschläge',
      'Wareneingang mit Rechnungs-Scan',
      'Stock-Movements für Auditing',
      'MHD-Alert 3 Tage vorher',
    ],
    comparison: [
      { before: 'Zettel an der Kühltür, den keiner liest', after: 'Push-Alert im Handy bei Unterschreitung' },
      { before: 'Inventur 3 Stunden, jedes Mal Streit über Mengen', after: 'Blind-Count in 15 Min pro Zone' },
      { before: 'Schwund ist ein Gefühl', after: 'Schwund ist eine Zahl mit Top-5-Liste' },
    ],
    faq: [
      { q: 'Kann ich Metro, Transgourmet und Chefs Culinar anbinden?', a: 'Metro: direkte API-Integration (in Beta). Andere: über E-Mail-Bestellung aus dem System.' },
      { q: 'Wie funktioniert Blind-Count?', a: 'Der Zähler sieht den Soll-Bestand NICHT. Erst nach Erfassung wird die Differenz gezeigt. Verhindert "abschreiben aus dem System".' },
    ],
    stat: { value: 37, prefix: '−', suffix: '%', label: 'weniger Schwund im ersten Quartal' },
  },

  /* ======================= BESTELLSEITE ======================= */
  {
    slug: 'bestellseite',
    id: 'ordering',
    icon: '🛒',
    badge: 'Umsatz',
    title: 'Deine eigene Bestellseite. Ohne 30 % Provision.',
    tagline: 'Kunden bestellen direkt bei dir — online oder per QR am Tisch.',
    headline: 'Die Hälfte deiner Marge wieder bei dir.',
    subline:
      'Lieferando nimmt 14 %. Uber 30 %. Wolt 25 %. Deine eigene Seite: 2 % Stripe-Fee. Den Rest behältst du.',
    demo: 'ordering',
    automations: [
      {
        title: 'Eigene URL, dein Branding',
        body:
          'Kunden sehen mise.app/order/dein-laden. Deine Farben, dein Logo, deine Geschichte. Kein Uber-Branding darüber. Wiedererkennung zählt.',
      },
      {
        title: 'Stripe-Connect in 3 Minuten',
        body:
          'Klicke „Stripe verbinden", mache KYC in 3 Minuten, ab sofort landen Zahlungen direkt auf deinem Konto. Kreditkarte, PayPal, Apple Pay, Sofort — alle drin.',
      },
      {
        title: 'Adress-Autocomplete + Liefer-Check',
        body:
          'Kunde tippt „Pontstr" — sieht echte Straßen-Vorschläge. Bei Eingabe wird automatisch die Entfernung berechnet. Außer Lieferradius? Sanfte Meldung: „Probier Abholung, ist 3 Min entfernt."',
      },
      {
        title: 'Gutschein-Codes direkt einlösbar',
        body:
          'WELCOME10 im Checkout → 10 % Rabatt wird sofort gezogen. Nutzungs-Limits, Mindestbestellwert, pro-Kunde-Limit — alles vom System bewacht.',
      },
    ],
    roi: [
      { metric: '+28%', value: 'Marge', note: 'gegenüber Lieferando auf eigene Orders' },
      { metric: '2%', value: 'Stripe-Fee', note: 'statt 14-30% Drittanbieter-Provision' },
      { metric: '0 €', value: 'Setup', note: 'Shop-Seite ist in Module inklusive' },
    ],
    features: [
      'Eigene URL mit Wunsch-Slug',
      'Hero mit Theme-Farben aus deinen Settings',
      'Kategorien, Warenkorb, Checkout',
      'Stripe Connect (Express)',
      'Adress-Autocomplete (Photon/OSM)',
      'Lieferradius-Check per Haversine',
      'Gutschein-Einlösung',
      'Live-Tracking-Link nach Bestellung',
      'Abholung + Lieferung + Vor Ort',
      'Stammkunden-Login optional',
    ],
    comparison: [
      { before: '14-30% Provision pro Order an Dritte', after: '2% Stripe-Fee, Rest bleibt bei dir' },
      { before: 'Dein Name steht klein unter "Lieferando"', after: 'Deine Marke ist der Star' },
      { before: 'Kundendaten gehören der Plattform', after: 'Kunden gehören dir, Wiederbestellung direkt' },
    ],
    faq: [
      { q: 'Muss ich Stripe nutzen?', a: 'Nein — für Bar-/Karte-bei-Lieferung funktioniert die Seite auch ohne Stripe. Aber Online-Zahlung ist Conversion-Gold.' },
      { q: 'Kann ich Stammkunden belohnen?', a: 'Ja, mit Gutschein-Codes und automatischen Bon-QRs. Richtiges Loyalty-Programm kommt in Q3.' },
    ],
    stat: { value: 28, prefix: '+', suffix: '%', label: 'Marge gegenüber Lieferando gespart' },
  },

  /* ======================= KÜCHE ======================= */
  {
    slug: 'kueche',
    id: 'kitchen',
    icon: '👨‍🍳',
    badge: 'Küche',
    title: 'Die Küche hat alles im Blick. Ohne Zettel.',
    tagline: 'Live-Tickets mit Timer, Allergen-Warnung rot, Audio-Alert bei neuer Order.',
    headline: 'Jedes Ticket. Jede Sekunde. Eine Farbe sagt alles.',
    subline:
      'Küchen-Display-System (KDS): eingehende Orders aus Shop + Lieferando + Kasse in einem Board. Timer pro Bestellung, Sound-Alert, rote Allergen-Warnung.',
    demo: 'kitchen',
    automations: [
      {
        title: 'Live-Ticker aus allen Quellen',
        body:
          'Shop, Lieferando, Uber Eats, Wolt, Kasse — alle Orders landen im selben Küchen-Display. Nie wieder zwischen 5 Tablets wechseln.',
      },
      {
        title: 'Timer mit Auto-Eskalation',
        body:
          'Jedes Ticket hat einen Zubereitungs-Timer. Bei Überschreitung (10+ Min bei Kaffee, 20+ Min bei Speisen) fängt es an zu blinken, Sound-Alert. Keine vergessenen Orders mehr.',
      },
      {
        title: 'Allergene rot markiert',
        body:
          'Enthält die Bestellung „gluten" oder „nuss"? Der Name wird rot. Hinweise wie „Laktose-Intoleranz" vom Kunden werden prominent eingeblendet.',
      },
      {
        title: 'Retour-Timing für Lieferorder',
        body:
          'Das System weiß, wann dein Fahrer zurück ist (GPS). Bei aktiver Tour wird die nächste Lieferorder erst dann gestartet, wenn der Fahrer in ≤5 Min zurück ist. Keine kalten Speisen mehr.',
      },
    ],
    roi: [
      { metric: '−43%', value: 'Ticket-Zeit', note: 'durch klare Priorisierung + Timer' },
      { metric: '0 vergessene', value: 'Allergen-Hinweise', note: 'durch rote Markierung' },
      { metric: '+18%', value: 'Gästebewertung', note: 'durch warme Speisen bei Lieferung' },
    ],
    features: [
      '4-Spalten-Board: Neu → Bestätigt → Zubereitung → Fertig',
      'Swipe/Tap zum Durchstufen',
      'Sound-Alert bei neuer Order',
      'Rote Allergen-Badges',
      'Timer pro Ticket',
      'Kundenhinweise prominent',
      'Bestellquelle-Badge (Shop / Lieferando / etc.)',
      'Retour-Koordination mit Fahrer-GPS',
      'Touch-optimiert für iPad am Pass',
    ],
    comparison: [
      { before: '5 Tablets am Pass, jedes piept anders', after: 'Ein iPad, alle Orders, ein Sound-Scheme' },
      { before: 'Kellner liest Allergen aus Bon ab', after: 'Allergen ist rot im Ticket' },
      { before: 'Küche fragt: „Ist Mira schon zurück?"', after: 'Das System sagt: „In 3 Min"' },
    ],
    faq: [
      { q: 'Läuft der KDS offline?', a: 'Kurzzeitig ja — bei Ausfall werden Tickets lokal gecached und synchronisiert sobald online.' },
      { q: 'Was wenn ich mehrere Stationen habe (Bar + Küche)?', a: 'Pro Department ein eigenes Display. Barista sieht nur Getränke, Küche nur Speisen.' },
    ],
    stat: { value: 43, prefix: '−', suffix: '%', label: 'schnellere Ticket-Time im Schnitt' },
  },

  /* ======================= KASSE ======================= */
  {
    slug: 'kasse',
    id: 'cash',
    icon: '💰',
    badge: 'Kasse',
    title: 'Eine Kasse, die alles kann. GoBD-sicher.',
    tagline: 'Touch-Terminal, Online-Orders kassieren, Z-Bericht auf Knopfdruck.',
    headline: 'Kasse + Online-Shop + Fahrer → ein Tagesabschluss.',
    subline:
      'Touch-Terminal auf iPad. Pickup-Panel für Online-Orders. Storno-Flow. Z-Bericht nach GoBD druckbar. TSE-ready für KassSichV.',
    demo: 'pos',
    automations: [
      {
        title: 'Online-Orders direkt kassieren',
        body:
          'Kunde kommt zur Abholung. Mitarbeiter öffnet Abholung-Panel, klickt auf seinen Namen → Items laden in Kasse. Zahlung abwickeln, Bon drucken. Der Online-Status wird automatisch auf „abgeholt" gesetzt.',
      },
      {
        title: 'Auto-Bon bei Fahrer-Zahlung',
        body:
          'Bar-/Karte-Lieferung durch Fahrer → automatisch POS-Bon mit order_id. Erscheint im Z-Bericht. Keine manuelle Nacherfassung mehr.',
      },
      {
        title: 'QR-Bon als Folgegutschein',
        body:
          'Ab 10 € Einkauf wird automatisch ein 10 %-Rabatt-Code auf den Bon gedruckt (QR). Kunde scannt → landet direkt im Shop. 15–20 % Wiederkehrer.',
      },
      {
        title: 'Z-Bericht mit Ist-Zählung',
        body:
          'Abends: Bargeld zählen, eintragen. System berechnet Soll-Bestand (Anfang + Bar + Einlagen + Trinkgeld − Entnahmen), zeigt Differenz. Druck als PDF, GoBD-konform archiviert.',
      },
    ],
    roi: [
      { metric: '−8 Min', value: 'Tagesabschluss', note: 'gegenüber Tillhub oder Lightspeed' },
      { metric: '100%', value: 'Erfassung', note: 'Bar-Lieferungen landen automatisch im Z-Bericht' },
      { metric: '+15%', value: 'Wiederkehrer', note: 'durch QR-Rabatt-Codes auf jedem Bon' },
    ],
    features: [
      'Touch-Produkt-Grid mit Beliebt-Sektion',
      'Tastatur-Shortcuts für Geübte',
      'Pickup-Panel für Online-Orders',
      'Einlagen / Entnahmen / Trinkgeld buchen',
      'Storno-Flow mit Gegen-Bon',
      'Bon-Historie mit Nachdruck',
      'Z-Bericht mit automatischer Ist/Soll-Abgleich',
      'GoBD-konforme Archivierung',
      'TSE-ready (Fiskaly/Swissbit)',
      'MwSt-Aufteilung 7/19/0 automatisch',
    ],
    comparison: [
      { before: 'Bar-Lieferungen werden abends händisch nachgetragen', after: 'Automatisch im Z-Bericht' },
      { before: 'Kassensystem weiß nichts vom Online-Shop', after: 'Abholungen tauchen als Ein-Klick-Bon auf' },
      { before: 'Z-Bericht in Excel, Archiv im Ordner', after: 'Z-Bericht als PDF, GoBD-sicher gespeichert' },
    ],
    faq: [
      { q: 'Ist das TSE-zertifiziert für die deutsche Kassensicherungsverordnung?', a: 'Wir sind TSE-ready. Du schließt eine Fiskaly- oder Swissbit-Box an (einmalig ~70 €), wir signieren jeden Bon. Für Österreich: RKSV via Fiskaltrust.' },
      { q: 'Funktioniert das mit meinem vorhandenen Bon-Drucker?', a: 'Ja — jeder ESC/POS-kompatible Drucker. Epson TM-m30, Star TSP 100/650, Metapace T-3.' },
    ],
    stat: { value: 8, prefix: '−', suffix: ' Min', label: 'schnellerer Tagesabschluss' },
  },

  /* ======================= ANALYTICS ======================= */
  {
    slug: 'analytics',
    id: 'analytics',
    icon: '📊',
    badge: 'Zahlen',
    title: 'Zahlen die zählen. Statt Bauchgefühl.',
    tagline: 'Umsatz · Food-Cost · Personalkosten — live und automatisch.',
    headline: 'Am Monatsende weißt du, was los war. Und warum.',
    subline:
      'Umsatz aus Shop + Kasse + Lieferung. Food-Cost aus Lager-Ausgang vs. Menü-Preis. Personalkosten aus Dienstplan. Alles automatisch.',
    demo: 'analytics',
    automations: [
      {
        title: 'Food-Cost aus echten Zahlen',
        body:
          'Jedes Rezept hat eine Zutatenliste. Bei jedem Verkauf werden die Rohstoffe automatisch „verbraucht". Vergleich mit Menü-Preis → echter Food-Cost-Anteil. Meist 3–5 % niedriger als geschätzt.',
      },
      {
        title: 'Labor-Cost-Ratio live',
        body:
          'Das System kennt deine Stundenlöhne (aus Employees) und geplante Schichten. Umsatz / Personalkosten = deine Labor-Ratio. Warnt wenn über 35 %.',
      },
      {
        title: 'Top & Flop automatisch',
        body:
          'Welche 5 Produkte bringen 60 % des Umsatzes? Welche 5 sind Ladenhüter? Wöchentliche Liste per E-Mail.',
      },
      {
        title: 'Wetter-Korrelation',
        body:
          'Das System zieht Wetterdaten (OpenWeather API). Regen → +15 % Liefer-Orders? Wir zeigen dir, wie stark Wetter deinen Umsatz beeinflusst — hilft bei Personalplanung.',
      },
    ],
    roi: [
      { metric: '+3 Std', value: 'pro Woche', note: 'keine Excel-Auswertungen mehr' },
      { metric: '−5%', value: 'Food-Cost', note: 'durch Sichtbarkeit der Zahlen' },
      { metric: '100%', value: 'Durchblick', note: 'Umsatz pro Kanal live' },
    ],
    features: [
      'Tagesumsatz live (alle Kanäle zusammen)',
      'Monatsvergleich auf einen Blick',
      'Food-Cost-Tracker pro Produkt',
      'Labor-Cost-Ratio',
      'Top/Flop 5-Listen',
      'Trinkgeld-Verteilung',
      'Wetter-Korrelation',
      'Export als CSV / Excel',
    ],
    comparison: [
      { before: 'Monatsende: DATEV-Export + 2h Pivot-Tabelle', after: 'Dashboard offen, Zahl ist da' },
      { before: 'Food-Cost ist ein Schätzwert', after: 'Food-Cost ist eine Linie im Chart' },
    ],
    faq: [
      { q: 'Kann ich die Zahlen an meinen Steuerberater schicken?', a: 'CSV-Export nach DATEV-Format ist drin. DATEV Unternehmen Online + SKR03/SKR04 werden unterstützt.' },
    ],
    stat: { value: 3, prefix: '+', suffix: ' Std', label: 'pro Woche für echte Management-Arbeit' },
  },

  /* ======================= PLATTFORMEN ======================= */
  {
    slug: 'plattformen',
    id: 'platforms',
    icon: '🔌',
    badge: 'Integrationen',
    title: 'Lieferando, Uber Eats, Wolt — alles in einem Posteingang.',
    tagline: 'Ein Webhook, alle Plattformen. Kein Tablet-Hopping mehr.',
    headline: '4 Tablets weg. Ein Display.',
    subline:
      'Bestellungen aus Lieferando/Uber Eats/Wolt kommen direkt in dein Küchen-Display. Menü-Sync in eine Richtung. Test-Ping per Klick.',
    demo: 'platforms',
    automations: [
      {
        title: 'Ein Webhook, alle Formate',
        body:
          'Unser Endpoint akzeptiert native Lieferando-, Uber Eats- und Wolt-Formate. Wenn du Deliverect/Otter als Middleware nutzt: auch kompatibel. Ein Anschluss, alle Plattformen.',
      },
      {
        title: 'Menü-Sync (geplant Q3)',
        body:
          'Änderst du einen Preis in Mise → synchronisiert zu allen Plattformen. Keine 4-fache Pflege mehr. Aktuell: Manager-Dashboard zeigt Sync-Warnungen bei Diskrepanzen.',
      },
      {
        title: 'Pro-Tenant Webhook-Secrets',
        body:
          'Jedes Restaurant hat eigenes Secret pro Plattform. Re-Generierung per Klick. Test-Ping-Button bestätigt: „Alles ok."',
      },
    ],
    roi: [
      { metric: '4 → 1', value: 'Tablets weg', note: 'alle Plattformen in einem Display' },
      { metric: '0 vergessene', value: 'Orders', note: 'durch zentralen Eingang' },
      { metric: '−15 Min/Tag', value: '', note: 'kein Tablet-Hopping mehr' },
    ],
    features: [
      'Webhook-URL + Secret pro Plattform',
      'Auto-Erkennung des Formats',
      'Staging-Tabelle als Audit-Log',
      'X-Source-Header zur Quelle-Erkennung',
      'Test-Ping-Button',
      'Letzter-Eingang-Timestamp',
      'Manuelles Secret-Regenerieren',
    ],
    comparison: [
      { before: '4 Tablets, 4 Passwörter, 4 Ladekabel', after: 'Ein iPad am Pass' },
      { before: 'Bei Uber-Eats-Order schnell rüber und annehmen', after: 'Erscheint live im KDS' },
    ],
    faq: [
      { q: 'Brauche ich einen Partner-Vertrag bei Lieferando?', a: 'Für die direkte API-Integration: ja. Alternative: Deliverect als Middleware (ein Vertrag, alle Plattformen).' },
    ],
    stat: { value: 4, suffix: ' Tablets', label: 'weniger auf deinem Tresen' },
  },

  /* ======================= REINIGUNG ======================= */
  {
    slug: 'reinigung',
    id: 'cleaning',
    icon: '✨',
    badge: 'Hygiene',
    title: 'HACCP ohne Stift und Klemmbrett.',
    tagline: 'Foto-Nachweis pro Zone, automatische PDF-Dokumentation.',
    headline: 'Wenn die Kontrolle kommt — ein Klick.',
    subline:
      '6 Zonen × 3 Tagesphasen. Jede Task mit Foto-Pflicht. HACCP-PDF generiert sich selbst, inkl. Zeitstempel, Mitarbeiter, GPS-Filiale.',
    demo: 'cleaning',
    automations: [
      {
        title: 'Foto-Pflicht pro Zone',
        body:
          'Damit eine Task als erledigt gilt, muss ein Foto hochgeladen sein. Verhindert „abhaken ohne machen". Zufalls-Audit durch Manager möglich.',
      },
      {
        title: 'Auto-HACCP-PDF',
        body:
          'Am Monatsende per Klick: PDF mit allen Reinigungen, Fotos, Mitarbeiter-Name, Zeitstempel. Kontroll-ready.',
      },
      {
        title: 'Reminder wenn Zone offen',
        body:
          'Zone „Sanitär 20 Uhr" nicht abgehakt? Um 20:30 Push-Notification an Schicht-Leiter. Keine vergessenen Bereiche.',
      },
    ],
    roi: [
      { metric: '0 Beanstandungen', value: 'in 6 Monaten', note: 'seit systematischer Erfassung' },
      { metric: '−2h', value: 'pro Monat', note: 'gegenüber manueller HACCP-Dokumentation' },
    ],
    features: [
      '6 Zonen, 3 Phasen',
      'Aufgaben-Templates pro Zone',
      'Foto-Nachweis Pflicht',
      'HACCP-PDF-Export',
      'Reminder-System',
      'Zufalls-Audit durch Manager',
    ],
    comparison: [
      { before: 'Klemmbrett mit Haken, nie vollständig', after: 'Foto-Nachweis, nie fraglich' },
      { before: 'HACCP-Ordner im Büro, verstaubt', after: 'PDF auf Knopfdruck, always ready' },
    ],
    faq: [
      { q: 'Was wenn ein Mitarbeiter schummelt mit altem Foto?', a: 'Fotos bekommen Timestamp + GPS + Geräte-ID. Manager kann stichprobenartig prüfen.' },
    ],
    stat: { value: 100, suffix: '%', label: 'Hygiene-Check-Quote seit Einführung' },
  },

  /* ======================= CHECK-UPS ======================= */
  {
    slug: 'check-ups',
    id: 'checkups',
    icon: '📋',
    badge: 'Daily',
    title: 'Der Morgen-Check. In 3 Minuten durch.',
    tagline: 'Foto-Checklisten für Standard-Routine, Auto-Eskalation bei Abweichung.',
    headline: 'Jeder Tag startet gleich. Das ist gut so.',
    subline:
      'Templates für Morgen, Mittag, Feierabend. Kühltemperaturen, Seife, Sauberkeit — Foto-Checklisten, die jeder versteht.',
    demo: 'checkup',
    automations: [
      {
        title: 'Session-Locking',
        body:
          'Sobald du einen Check-up beginnst, ist die Session offen. Du musst alle Punkte abhaken (oder Grund eingeben), bevor du abschließt. Keine halb-fertigen Checks.',
      },
      {
        title: 'Auto-Eskalation',
        body:
          'Kühltemperatur zu hoch gemeldet? Sofort E-Mail + Push an Schicht-Leiter. Mit Foto. Technik kann kommen, bevor die Ware schlecht wird.',
      },
    ],
    roi: [
      { metric: '−73%', value: 'Beanstandungen', note: 'bei Lebensmittelkontrolle' },
      { metric: '3 Min', value: '/Tag', note: 'kompletter Morgen-Check' },
    ],
    features: [
      'Template-Editor',
      'Morgen / Mittag / Feierabend',
      'Foto-Pflicht für kritische Punkte',
      'Session-Locking',
      'Reminder + Eskalation',
      'Verlauf pro Mitarbeiter',
    ],
    comparison: [
      { before: 'Zettel auf Klemmbrett, nach einer Woche verbummelt', after: 'App, Historie 24 Monate' },
    ],
    faq: [],
    stat: { value: 73, prefix: '−', suffix: '%', label: 'weniger Beanstandungen' },
  },

  /* ======================= TRAINING ======================= */
  {
    slug: 'training',
    id: 'training',
    icon: '🎓',
    badge: 'Onboarding',
    title: 'Neue Leute sind am Tag 2 produktiv.',
    tagline: 'Lernkarten, Quiz, Badges. AI-Generator für neue Module.',
    headline: 'Onboarding in der Hand — nicht im Kopf des Chefs.',
    subline:
      'Jeder neue Mitarbeiter bekommt automatisch Pflichtmodule. Lernkarten, Quiz mit sofortigem Feedback, Auffrischung nach 6 Monaten.',
    demo: 'training',
    automations: [
      {
        title: 'Pflichtmodule beim Onboarding',
        body:
          'Rolle „Barista" → Matcha-Kunde, Maschine, Allergene werden automatisch zugewiesen. Rolle „Fahrer" → StVO-Basics, App-Bedienung, Hygiene.',
      },
      {
        title: 'AI-Modul-Generator',
        body:
          'Gib ein Thema („Umgang mit Allergiker-Kunde") und 3 Bullet-Points ein. Claude/GPT-4 erzeugt Lernkarten + Quiz-Fragen + Antwort-Erklärungen. In 10 Sekunden.',
      },
      {
        title: 'Auffrischungs-Reminder',
        body:
          'Nach 6 Monaten: das wichtigste Modul (z.B. Allergene) wird erneut zugewiesen. Pflicht-Quiz. Mitarbeiter behält Wissen, du bleibst Kontroll-ready.',
      },
    ],
    roi: [
      { metric: '−50%', value: 'Einarbeitung', note: 'neue Mitarbeiter produktiv ab Tag 2' },
      { metric: '+30 Pkt', value: 'NPS', note: 'Mitarbeiter-Zufriedenheit' },
    ],
    features: [
      'Lernkarten mit Bildern',
      'Quiz mit Multiple-Choice',
      'Badges & Punkte',
      'AI-Modul-Generator',
      'Auto-Zuweisung nach Rolle',
      'Auffrischungs-Reminder',
    ],
    comparison: [
      { before: 'Chef erklärt alles mündlich, vergisst Details', after: 'Standardisierte Module, jeder lernt gleich' },
    ],
    faq: [],
    stat: { value: 50, prefix: '−', suffix: '%', label: 'kürzere Einarbeitung neuer Mitarbeiter' },
  },

  /* ======================= NOTIFICATIONS ======================= */
  {
    slug: 'benachrichtigungen',
    id: 'notifications',
    icon: '🔔',
    badge: 'Alerts',
    title: 'Nichts geht mehr unter.',
    tagline: '15 Event-Typen, Rollen-basiert, Push an Mobile-App.',
    headline: 'Wichtige Events. Direkt aufs Phone.',
    subline:
      'Zeugnis läuft ab? Push. Neue Lieferorder fertig? Push an Fahrer. Kassenabschluss-Differenz > 10 €? Push an Admin.',
    demo: 'notifications',
    automations: [
      {
        title: '15 vordefinierte Events',
        body:
          'Dokument-Ablauf, Schicht-fehlt, neue Order, Z-Bericht-Differenz, Schwund > 50 €, Check-up-Verstoß, etc. Alle sofort einsetzbar.',
      },
      {
        title: 'Rollen-basiert',
        body:
          'Manager bekommt andere Benachrichtigungen als Fahrer. Dein Backoffice-Team sieht Finanz-Alerts, die der Koch nicht braucht.',
      },
      {
        title: 'Regel-Editor',
        body:
          'Eigene Alerts bauen: „Wenn ein Artikel mit Gewinn > 50 % in 3 Tagen nicht verkauft wurde — Info an Marketing."',
      },
    ],
    roi: [
      { metric: '0', value: 'vergessene Dokumente', note: 'seit Aktivierung' },
    ],
    features: [
      '15 Event-Typen',
      'Push-Notifications auf Expo-Mobile-App',
      'Rollen-basierte Zustellung',
      'Cooldown pro Event',
      'Rule-Editor (in Beta)',
    ],
    comparison: [
      { before: 'Excel mit „Ablauf-Termine" — nie geöffnet', after: 'Push „in 14 Tagen abgelaufen"' },
    ],
    faq: [],
    stat: { value: 0, suffix: '', label: 'vergessene Dokumente seit Aktivierung' },
  },
];

export function findModule(slug: string): ModuleContent | null {
  return MODULES.find((m) => m.slug === slug) ?? null;
}
