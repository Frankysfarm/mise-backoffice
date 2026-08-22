/**
 * Use-Case-Presets — Restaurant wählt einen Use-Case,
 * das System aktiviert die richtigen Module und zeigt nur die
 * Setup-Steps, die für dieses Szenario nötig sind.
 */

export type SetupStepId =
  | 'restaurant_basis'   // Name, Adresse, USt-ID
  | 'stripe'             // Stripe Connect für Online-Zahlung
  | 'lieferung'          // Lieferradius, Liefergebühr, Mindestbestellwert
  | 'theme'              // Design-Theme wählen
  | 'menue'              // Kategorien + Artikel anlegen
  | 'email'              // Resend für Kampagnen + Bestätigungen
  | 'zahlungen'          // Matrix Bar/Karte/Online × Liefer/Abhol
  | 'plattformen'        // Lieferando/Uber/Wolt anbinden
  | 'fahrer'             // Fahrer einladen
  | 'mitarbeiter'        // Mitarbeiter/Team anlegen
  | 'kasse'              // Kasse konfigurieren
  | 'gutscheine';        // Welcome-Gutschein anlegen

export type Preset = {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  // Module die aktiv werden
  modules: string[];
  // Steps in Reihenfolge
  steps: SetupStepId[];
  // Empfohlen für wen?
  fuer: string;
};

export type PresetCategory = 'verkauf' | 'team' | 'betrieb' | 'finanzen' | 'komplett';

export const PRESETS: Preset[] = [
  // ============== VERKAUF ==============
  {
    id: 'shop-delivery',
    icon: '🛵',
    name: 'Liefer- & Shop-System',
    tagline: 'Eigener Online-Shop + eigene Fahrer-Flotte, alles in einem.',
    description:
      'Bestellseite mit Stripe-Checkout · Küchen-Display · Fahrer-App mit Live-GPS + Route-Optimierung · Plattform-Anschluss (Lieferando/Uber/Wolt) optional.',
    modules: ['ordering', 'kitchen', 'delivery', 'cash', 'platforms'],
    steps: [
      'restaurant_basis',
      'stripe',
      'lieferung',
      'theme',
      'menue',
      'zahlungen',
      'fahrer',
      'plattformen',
      'email',
      'gutscheine',
    ],
    fuer: 'Pizzerien · Burger · Bowls · Liefer-Konzepte',
  },
  {
    id: 'marketing-loyalty',
    icon: '📣',
    name: 'Marketing & Kundenbindung',
    tagline: 'Wiederkehrer systematisch — Gutscheine, Kampagnen, QR-Rabatte.',
    description:
      'Welcome-Codes + Aktions-Gutscheine · Automatische QR-Gutscheine auf jedem Kassenbon · Email-Kampagnen via Resend · DSGVO-konforme Opt-in-Listen · Segment-Targeting.',
    modules: ['ordering', 'notifications'],
    steps: [
      'restaurant_basis',
      'email',
      'gutscheine',
      'theme',
    ],
    fuer: 'Betriebe die Stammkunden wachsen lassen wollen',
  },

  // ============== TEAM ==============
  {
    id: 'scheduling',
    icon: '📅',
    name: 'Dienstplan-Automatisierung',
    tagline: 'Wochenplan in 10 Min. statt 2 Std. ArbZG-sicher.',
    description:
      'Drag-and-Drop Wochenplan · Verfügbarkeiten fließen live ein · Schichttausch ohne Manager · Krankmeldung → Auto-Ersatz-Vorschlag · QR-Stempel-Uhr am Tresen.',
    modules: ['operations', 'notifications'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
      'email',
    ],
    fuer: 'Alle die ihren Dienstplan fix im Griff haben wollen',
  },
  {
    id: 'team-comms',
    icon: '💬',
    name: 'Mitarbeiter-Kommunikation',
    tagline: 'Ein Ort für Ansagen, Feedback, Übergabe-Notizen.',
    description:
      'Schicht-übergreifende Chat-Kanäle · Ansagen an ganzes Team · Anonymes Feedback · Übergabe-Notizen zwischen Schichten · Push auf Handy.',
    modules: ['notifications', 'operations'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
      'email',
    ],
    fuer: 'Teams die WhatsApp-Chaos abschaffen wollen',
  },
  {
    id: 'teaching',
    icon: '🎓',
    name: 'Teaching-System',
    tagline: 'Neue Mitarbeiter in 2 Tagen produktiv. Wissen nicht im Kopf des Chefs.',
    description:
      'Lernkarten mit Bildern · Quiz mit Sofort-Feedback · Badges + Punkte · AI-Modul-Generator · automatische Pflicht-Module bei Onboarding · Auffrischung nach 6 Monaten.',
    modules: ['training', 'documents'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
    ],
    fuer: 'Wachsende Teams · Schulungs-pflichtige Betriebe',
  },

  // ============== BETRIEB ==============
  {
    id: 'laden-koordination',
    icon: '🎯',
    name: 'Laden-Koordination',
    tagline: 'Jeder weiß, was Sache ist. Ohne 10 Gruppen-Chats.',
    description:
      'Küchen-Display mit Live-Orders · Checkups (Morgen/Mittag/Feierabend mit Foto) · Reinigungsplan mit HACCP-PDF · Schichtleitfäden · Push-Benachrichtigungen bei Abweichung.',
    modules: ['kitchen', 'checkups', 'cleaning', 'notifications', 'operations'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
      'email',
    ],
    fuer: 'Restaurants mit 5+ Mitarbeitern · Multi-Schicht',
  },
  {
    id: 'warehouse',
    icon: '📦',
    name: 'Lagerverwaltung',
    tagline: 'Bestand live. Schwund sichtbar. Reorder auf Knopfdruck.',
    description:
      'Blind-Count-Inventur · FIFO mit MHD-Alert · Par-Level → Auto-Reorder · Lieferanten-Preise historisch · Food-Cost live aus Rezept-Verbrauch · Schwund-Top-5.',
    modules: ['inventory', 'analytics'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
    ],
    fuer: 'Gastronomie mit > 50 Artikeln · Food-Cost-Fokus',
  },
  {
    id: 'haccp-compliance',
    icon: '🧼',
    name: 'HACCP & Compliance',
    tagline: 'Wenn die Kontrolle kommt — ein Klick, alles da.',
    description:
      'Foto-Check pro Zone · Temperatur-Log mit Abweichungs-Alarm · HACCP-PDF auf Knopfdruck · Ablauf-Ampel für Gesundheitszeugnisse · Schulungs-Nachweis pro Mitarbeiter.',
    modules: ['cleaning', 'checkups', 'documents', 'training'],
    steps: [
      'restaurant_basis',
      'mitarbeiter',
    ],
    fuer: 'Kontroll-pflichtige Betriebe · Ketten · HACCP-Zertifizierer',
  },

  // ============== FINANZEN ==============
  {
    id: 'pos-kasse',
    icon: '🧾',
    name: 'POS Kasse',
    tagline: 'Touch-Terminal · Z-Bericht GoBD-sicher · TSE-ready.',
    description:
      'iPad-Kasse mit Produkt-Grid · Pickup-Panel für Online-Orders · Bon-Druck mit QR-Gutschein · Auto-POS bei Fahrer-Kassierung · Z-Bericht mit Ist-Zählung und PDF.',
    modules: ['cash', 'analytics'],
    steps: [
      'restaurant_basis',
      'zahlungen',
      'kasse',
      'menue',
    ],
    fuer: 'Alle Betriebe mit Bar-/Kartenzahlung vor Ort',
  },

  // ============== KOMPLETT ==============
  {
    id: 'alles',
    icon: '✨',
    name: 'Komplett-Setup',
    tagline: 'Alle 12 Module. 14 Tage gratis. Keine Bindung.',
    description:
      'Für alle die das volle Paket wollen und später entscheiden, welche Module bleiben. Alle Features aktiv, alle Einstellungen step-by-step.',
    modules: ['operations','inventory','training','cleaning','checkups','ordering','kitchen','delivery','cash','analytics','documents','notifications'],
    steps: [
      'restaurant_basis',
      'stripe',
      'lieferung',
      'theme',
      'menue',
      'zahlungen',
      'plattformen',
      'fahrer',
      'mitarbeiter',
      'email',
      'gutscheine',
      'kasse',
    ],
    fuer: 'Multi-Channel-Gastro · Chains · Entscheider',
  },
];

// Kategorisierung fürs UI-Grouping
export const PRESET_CATEGORIES: { id: PresetCategory; label: string; desc: string; ids: string[] }[] = [
  { id: 'verkauf',  label: '💰 Verkauf & Lieferung', desc: 'Online, Lieferung, Plattformen', ids: ['shop-delivery', 'marketing-loyalty'] },
  { id: 'team',     label: '👥 Team & Mitarbeiter',   desc: 'Dienstplan, Kommunikation, Training', ids: ['scheduling', 'team-comms', 'teaching'] },
  { id: 'betrieb',  label: '⚙️ Betrieb & Alltag',     desc: 'Küche, Lager, Hygiene', ids: ['laden-koordination', 'warehouse', 'haccp-compliance'] },
  { id: 'finanzen', label: '🧾 Kasse & Finanzen',     desc: 'POS, Gutscheine, Auswertung', ids: ['pos-kasse'] },
  { id: 'komplett', label: '✨ Alles',                 desc: 'Komplett-Setup für Entscheider', ids: ['alles'] },
];

export const STEP_CONFIG: Record<SetupStepId, {
  title: string;
  short: string;
  desc: string;
  icon: string;
  href: string;
  /** Check-Function — prüft ob Step bereits erfüllt ist (serverseitig aus Tenant-Daten) */
  checkField?: string;
  estimatedMin: number;
}> = {
  restaurant_basis: {
    title: 'Restaurant-Stammdaten',
    short: 'Stammdaten',
    desc: 'Name, Adresse, USt-ID, Impressum. Einmalig eintragen.',
    icon: '🏪',
    href: '/settings/restaurant',
    checkField: 'ustid',
    estimatedMin: 3,
  },
  stripe: {
    title: 'Online-Zahlung einrichten',
    short: 'Stripe Connect',
    desc: 'Stripe-Account verbinden → Kunden zahlen online, Geld geht direkt auf dein Konto.',
    icon: '💳',
    href: '/settings/restaurant#zahlung',
    checkField: 'stripe_connect_charges_enabled',
    estimatedMin: 5,
  },
  lieferung: {
    title: 'Lieferzone festlegen',
    short: 'Lieferzone',
    desc: 'Radius, Liefergebühr, Mindestbestellwert. Fahrer-Optimierung nutzt den Radius.',
    icon: '🗺️',
    href: '/settings/restaurant#lieferung',
    checkField: 'lieferradius_km',
    estimatedMin: 2,
  },
  theme: {
    title: 'Design wählen',
    short: 'Design',
    desc: 'Classic, Bold oder Minimal — so sieht deine Bestellseite aus.',
    icon: '🎨',
    href: '/settings/theme',
    checkField: 'storefront_theme_id',
    estimatedMin: 1,
  },
  menue: {
    title: 'Menü anlegen',
    short: 'Menü',
    desc: 'Kategorien und Artikel eintragen, Bilder hochladen.',
    icon: '📖',
    href: '/menu',
    estimatedMin: 15,
  },
  email: {
    title: 'E-Mail-Versand verbinden',
    short: 'Resend',
    desc: 'Resend-Account verbinden für Kampagnen und Bestellbestätigungen.',
    icon: '📧',
    href: '/settings/email',
    checkField: 'resend_verified_at',
    estimatedMin: 5,
  },
  zahlungen: {
    title: 'Zahlungsarten konfigurieren',
    short: 'Zahlungsarten',
    desc: 'Bar / Karte / Online — welche bei welcher Bestellart?',
    icon: '💰',
    href: '/settings/payments',
    estimatedMin: 2,
  },
  plattformen: {
    title: 'Externe Plattformen anbinden',
    short: 'Plattformen',
    desc: 'Lieferando · Uber Eats · Wolt · Webhook-URLs ausgeben.',
    icon: '🔌',
    href: '/settings/platforms',
    estimatedMin: 10,
  },
  fahrer: {
    title: 'Fahrer einladen',
    short: 'Fahrer',
    desc: 'Mitarbeiter anlegen, die ausliefern — Welcome-Email mit App-Link geht automatisch raus.',
    icon: '🛵',
    href: '/drivers',
    estimatedMin: 5,
  },
  mitarbeiter: {
    title: 'Mitarbeiter anlegen',
    short: 'Team',
    desc: 'Kellner, Barista, Küche — Rollen vergeben.',
    icon: '👥',
    href: '/employees',
    estimatedMin: 10,
  },
  kasse: {
    title: 'Kasse konfigurieren',
    short: 'Kasse',
    desc: 'Kassen-ID, Startbestand, TSE-Anbindung vorbereiten.',
    icon: '🧾',
    href: '/pos',
    estimatedMin: 5,
  },
  gutscheine: {
    title: 'Welcome-Gutschein anlegen',
    short: 'Gutschein',
    desc: 'WELCOME10-Code für Marketing + Bon-QR-Auto-Voucher aktivieren.',
    icon: '🎟️',
    href: '/vouchers',
    estimatedMin: 2,
  },
};

export function findPreset(id: string): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Baut ein Ad-hoc-Preset aus einer Liste einzeln gewählter Module.
 * Steps werden aus Modul→Steps-Mapping abgeleitet und dedupliziert.
 */
const MODULE_STEPS: Record<string, SetupStepId[]> = {
  ordering:       ['stripe', 'theme', 'menue', 'zahlungen', 'email'],
  delivery:       ['lieferung', 'fahrer'],
  kitchen:        ['menue'],
  cash:           ['zahlungen', 'kasse', 'menue'],
  operations:     ['mitarbeiter'],
  inventory:      ['mitarbeiter'],
  training:       ['mitarbeiter'],
  cleaning:       ['mitarbeiter'],
  checkups:       ['mitarbeiter'],
  analytics:      [],
  documents:      [],
  notifications:  ['email'],
  platforms:      ['plattformen'],
};

const MODULE_META: Record<string, { icon: string; name: string }> = {
  ordering:       { icon: '🛒',  name: 'Bestellsystem' },
  delivery:       { icon: '🛵',  name: 'Fahrer & Lieferung' },
  kitchen:        { icon: '👨‍🍳', name: 'Küchen-Monitor' },
  cash:           { icon: '💰',  name: 'Kasse' },
  operations:     { icon: '📅',  name: 'Dienstplan' },
  inventory:      { icon: '📦',  name: 'Lager' },
  training:       { icon: '🎓',  name: 'Training' },
  cleaning:       { icon: '✨',  name: 'Reinigung' },
  checkups:       { icon: '📋',  name: 'Check-ups' },
  analytics:      { icon: '📊',  name: 'Analytics' },
  documents:      { icon: '📄',  name: 'Dokumente' },
  notifications:  { icon: '🔔',  name: 'Benachrichtigungen' },
  platforms:      { icon: '🔌',  name: 'Plattformen' },
};

export function buildCustomPreset(moduleIds: string[]): Preset {
  // Unique steps, immer mit restaurant_basis starten
  const stepSet = new Set<SetupStepId>(['restaurant_basis']);
  const validModules: string[] = [];
  const iconList: string[] = [];
  const nameList: string[] = [];

  for (const id of moduleIds) {
    const meta = MODULE_META[id];
    if (!meta) continue;
    validModules.push(id);
    iconList.push(meta.icon);
    nameList.push(meta.name);
    for (const s of MODULE_STEPS[id] ?? []) stepSet.add(s);
  }

  const orderedSteps: SetupStepId[] = [
    'restaurant_basis',
    'stripe',
    'lieferung',
    'theme',
    'menue',
    'zahlungen',
    'plattformen',
    'fahrer',
    'mitarbeiter',
    'email',
    'gutscheine',
    'kasse',
  ].filter((s) => stepSet.has(s as SetupStepId)) as SetupStepId[];

  return {
    id: 'custom',
    icon: iconList.slice(0, 3).join('') || '✨',
    name: nameList.length === 1
      ? nameList[0]
      : `${nameList.length} Module ausgewählt`,
    tagline: nameList.slice(0, 5).join(' · '),
    description:
      `Du hast ${nameList.length} ${nameList.length === 1 ? 'Modul' : 'Module'} zum Testen gewählt. Wir führen dich durch alle nötigen Einstellungen. 14 Tage Trial, danach einzeln kündbar.`,
    modules: validModules,
    steps: orderedSteps,
    fuer: 'Dein individuelles Setup',
  };
}
