import { getActiveModules } from '@/lib/modules';
import { SidebarClient, type SidebarModule, type SidebarItem } from './sidebar-client';

/**
 * Definition aller Sidebar-Module mit ihren Nav-Items.
 *
 * Eine `moduleId` matched eine `tenant_modules.module_id` (siehe DB) und steuert
 * ob die Sektion sichtbar ist. Mehrere Sektionen können dieselbe `moduleId` haben
 * — nützlich um z.B. das `ordering`-Modul in mehrere visuelle Hauptbereiche zu
 * splitten (Lieferung, QR-Tisch, Speisekarte, Marketing — alle 4 abhängig vom
 * gleichen Modul, aber visuell getrennt).
 *
 * Innerhalb eines Moduls werden Items über `group` in Untersektionen gruppiert
 * mit Headlines.
 */
const MODULE_DEFS: SidebarModule[] = [
  // ═══════════════════════════════════════════════════════════════════
  // 💳 KASSE & FINANZEN (POS)
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'cash',
    label: 'Kasse & Finanzen',
    icon: 'Calculator',
    items: [
      // Loslegen — was als erstes anpacken
      { group: 'Loslegen', href: '/setup-wizard',  icon: 'Sparkles',   label: '🧙 Setup-Wizard' },
      { group: 'Loslegen', href: '/pos/setup',     icon: 'LayoutDashboard', label: 'POS-Übersicht (Hub)' },
      { group: 'Loslegen', href: '/pos/terminal',  icon: 'Calculator', label: 'Kassen-Terminal öffnen' },
      { group: 'Loslegen', href: '/pos',           icon: 'Receipt',    label: 'Bon-Historie' },

      // Reservierungen
      { group: 'Reservierungen', href: '/reservierungen', icon: 'CalendarDays', label: 'Tisch-Reservierungen' },

      // Start-Hub — Modus-Auswahl beim App-Start
      { group: 'Start', href: '/pos/start', icon: 'LayoutGrid', label: 'POS Start (Modus wählen)' },

      // Bestelleingang — Live-Annahme mit Ton + Push
      { group: 'Bestelleingang', href: '/pos/inbox', icon: 'Bell', label: 'Bestelleingang (Live + Ton)' },

      // Tische & Layout — endlich prominent
      { group: 'Tische & Layout',  href: '/pos/tables',         icon: 'Grid',     label: 'Tische verwalten' },
      { group: 'Tische & Layout',  href: '/pos/tables/layout',  icon: 'LayoutGrid', label: 'Tischplan zeichnen (Floor-Plan)' },
      { group: 'Tische & Layout',  href: '/pos/tables/print',   icon: 'Printer',  label: 'Alle QR-Codes drucken' },

      // Konfiguration — Kassen, Stationen, Drucker, PIN
      { group: 'Konfiguration', href: '/pos/registers',        icon: 'Monitor', label: 'Kassen / Terminals' },
      { group: 'Konfiguration', href: '/pos/stations',         icon: 'ChefHat', label: 'Küchen-Stationen' },
      { group: 'Konfiguration', href: '/pos/printers', icon: 'Printer', label: 'Bondrucker verwalten' },
      { group: 'Konfiguration', href: '/pos/stations/devices', icon: 'Plug',    label: 'KDS-Drucker verbinden' },
      { group: 'Konfiguration', href: '/pos/settings',         icon: 'Settings', label: 'POS-Einstellungen (Bon, Trinkgeld, …)' },
      { group: 'Konfiguration', href: '/settings/manager-pin', icon: 'Lock',    label: 'Manager-PIN' },
      { group: 'Konfiguration', href: '/settings/training-mode', icon: 'GraduationCap', label: 'Schulungsmodus' },
      { group: 'Konfiguration', href: '/settings/coursing',       icon: 'ChefHat',  label: 'Gänge / Coursing' },
      { group: 'Konfiguration', href: '/settings/order-profiles', icon: 'Layers',   label: 'Bestell-Profile (Dine-in/Takeaway/Delivery)' },
      { group: 'Konfiguration', href: '/settings/price-lists',    icon: 'Tag',      label: 'Preislisten (Happy Hour, Lunch-Menu)' },

      // Zahlung
      { group: 'Zahlung', href: '/settings/sumup',  icon: 'CreditCard', label: 'SumUp (Karte vorne)' },
      // /shop/payments wird im Online-Bestellsystem-Modul verwaltet — hier kein Duplikat,
      // sonst springt der Owner zwischen Modulen hin und her.

      // Tagesabschluss
      { group: 'Tagesabschluss', href: '/cash',         icon: 'Banknote', label: 'Tagesabschluss / Kassenbuch' },
      { group: 'Tagesabschluss', href: '/pos/z-report', icon: 'Receipt',  label: 'Z-Bericht' },

      // Compliance
      { group: 'Compliance', href: '/settings/tse',            icon: 'Shield',   label: 'TSE (Fiskaly)' },
      { group: 'Compliance', href: '/settings/kassenpruefung', icon: 'Shield',   label: 'Kassen-Nachschau / DSFinV-K' },
      { group: 'Compliance', href: '/settings/legal',          icon: 'FileText', label: 'Rechtskonformität' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🪑 QR-TISCH-BESTELLUNG (eigenes System, KEINE Verbindung zur Lieferung)
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'table_ordering',
    label: 'QR-Tisch-Bestellung',
    icon: 'QrCode',
    items: [
      // Loslegen
      { group: 'Loslegen', href: '/qr-bestellsystem',   icon: 'QrCode',  label: 'QR-System Übersicht (Hub)' },

      // Tische & QR-Codes
      { group: 'Tische & QR-Codes', href: '/pos/tables',         icon: 'Grid',     label: 'Tische verwalten' },
      { group: 'Tische & QR-Codes', href: '/pos/tables/layout',  icon: 'LayoutGrid', label: 'Tischplan zeichnen' },
      { group: 'Tische & QR-Codes', href: '/pos/tables/print',   icon: 'Printer',  label: 'Alle QR-Codes drucken' },
      { group: 'Tische & QR-Codes', href: '/api/pos/universal-qr', icon: 'QrCode', label: 'Universal-QR drucken (Aufsteller)' },

      // Design der QR-Bestellseite
      { group: 'Design QR-Bestellseite', href: '/shop/qr-design', icon: 'Palette', label: 'Logo, Banner, Farben (QR)' },

      // Vorschau für Owner
      { group: 'Vorschau', href: '/qr-bestellsystem',  icon: 'Eye', label: 'QR-Bestellseite ansehen' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🍕 ONLINE-BESTELLSYSTEM — eine Sektion für ALLE ordering-Routen
  // (Liefer-Cockpit + Speisekarte + Marketing zusammen, damit der Owner
  //  immer alle Optionen sieht, egal auf welcher Sub-Seite er ist)
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'ordering',
    label: 'Online-Bestellsystem',
    icon: 'ShoppingBag',
    items: [
      // Loslegen
      { group: 'Loslegen', href: '/shop',                            icon: 'LayoutDashboard', label: 'Liefer-Cockpit' },
      { group: 'Loslegen', href: '/shop/setup-wizard/lieferservice', icon: 'Sparkles',        label: 'Setup-Wizard (8 Schritte)' },

      // Speisekarte (gilt für alle Bestellsysteme, aber Owner sucht es hier)
      { group: 'Speisekarte', href: '/menu',              icon: 'UtensilsCrossed', label: 'Artikel & Preise' },
      { group: 'Speisekarte', href: '/menu/import',       icon: 'Upload',          label: 'Per CSV / Foto importieren' },
      { group: 'Speisekarte', href: '/menu/upsells',      icon: 'Sparkles',        label: 'Upsells & Cross-Sells' },
      { group: 'Speisekarte', href: '/settings/tax-rates', icon: 'Percent',        label: 'Steuersätze' },

      // Lieferseite gestalten
      { group: 'Bestellseite', href: '/shop/design',  icon: 'Palette', label: 'Logo, Banner, Farben' },
      { group: 'Bestellseite', href: '/shop/domain',  icon: 'Globe',   label: 'Eigene Domain' },
      { group: 'Bestellseite', href: '/shop/hours',   icon: 'Clock',   label: 'Öffnungszeiten' },

      // Fahrer (technisch im delivery-Modul, aber Owner-Mental-Model: gehört zum Bestellsystem)
      { group: 'Fahrer', href: '/shop/drivers', icon: 'Bike', label: 'Fahrer einladen · Driver-App' },

      // Liefer-Konfiguration
      { group: 'Lieferung', href: '/shop/delivery',  icon: 'MapPin', label: 'Lieferradius & Zonen' },

      // Zahlung
      { group: 'Zahlung', href: '/shop/payments',  icon: 'CreditCard', label: 'Zahlungsmethoden online' },
      { group: 'Zahlung', href: '/settings/stripe', icon: 'Wallet',    label: 'Stripe-Konto verbinden' },

      // Marketing
      { group: 'Marketing', href: '/vouchers',   icon: 'Ticket', label: 'Rabatt-Gutscheine' },
      { group: 'Marketing', href: '/gift-cards', icon: 'Gift',   label: 'Geschenkgutscheine' },
      { group: 'Marketing', href: '/campaigns',  icon: 'Bell',   label: 'Kampagnen' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🚚 LIEFERDIENST (Fahrer-Operations)
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'delivery',
    label: 'Lieferdienst',
    icon: 'Bike',
    items: [
      { group: 'Loslegen', href: '/delivery',     icon: 'LayoutDashboard', label: 'Übersicht' },
      { group: 'Loslegen', href: '/dispatch',     icon: 'MapPin',          label: 'Touren & Live-Karte' },

      { group: 'Fahrer', href: '/drivers',                    icon: 'Users',     label: 'Fahrer (Dispatch-Ansicht)' },
      { group: 'Fahrer', href: '/drivers/payouts',          icon: 'Banknote',  label: 'Fahrer-Abrechnung' },
      { group: 'Fahrer', href: '/drivers/bewerbungen',      icon: 'ClipboardList', label: 'Fahrer-Bewerbungen' },
      // /shop/drivers (Owner-Invite + Driver-App-Setup) wird im Online-Bestellsystem-Modul
      // verwaltet — hier kein Duplikat.

      { group: 'Konfiguration', href: '/delivery/zone',       icon: 'MapPin',   label: 'Liefergebiet zeichnen' },
      { group: 'Konfiguration', href: '/delivery/conditions', icon: 'Banknote', label: 'Konditionen & Gebühren' },
      { group: 'Konfiguration', href: '/delivery/platforms',  icon: 'Plug',     label: 'Lieferando, Wolt, Uber Eats…' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 👨‍🍳 KÜCHE (KDS)
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'kitchen',
    label: 'Küche (KDS)',
    icon: 'ChefHat',
    items: [
      { href: '/kitchen', icon: 'ChefHat', label: 'Küchen-Monitor öffnen' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🏆 LOYALTY & COUPONS
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'loyalty',
    label: 'Loyalty & Coupons',
    icon: 'Award',
    items: [
      { group: 'Stempelkarte', href: '/loyalty',                icon: 'Star',     label: 'Übersicht' },
      { group: 'Stempelkarte', href: '/loyalty?tab=settings',   icon: 'Settings', label: 'Stempelkarte konfigurieren' },
      { group: 'Coupons',      href: '/loyalty?tab=coupons',    icon: 'Ticket',   label: 'Coupon-Codes' },
      { group: 'Stammkunden',  href: '/loyalty?tab=customers',  icon: 'Users',    label: 'Stammkunden-Datenbank' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ☎️ TELEFON-KI
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'voice_orders',
    label: 'Telefon-KI',
    icon: 'Phone',
    items: [
      { href: '/voice-orders',       icon: 'Phone',   label: 'Einrichtung' },
      { href: '/voice-orders/calls', icon: 'History', label: 'Anrufe-Verlauf' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 👥 DIENSTPLAN & TEAM
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'operations',
    label: 'Dienstplan & Team',
    icon: 'Users',
    items: [
      { group: 'Mitarbeiter', href: '/employees',    icon: 'Users',    label: 'Alle Mitarbeiter' },
      { group: 'Mitarbeiter', href: '/applications', icon: 'Users',    label: 'Bewerbungen' },

      { group: 'Schicht',     href: '/schedule',     icon: 'Calendar', label: 'Dienstplan' },
      { group: 'Schicht',     href: '/shift-guides', icon: 'BookOpen', label: 'Schichtleitfäden' },

      { group: 'Inventar',    href: '/equipment',    icon: 'Wrench',   label: 'Geräte verwalten' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🎓 TRAINING & SCHULUNG
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'training',
    label: 'Training & Schulung',
    icon: 'GraduationCap',
    items: [
      { href: '/training', icon: 'GraduationCap', label: 'Schulungen' },
      { href: '/badges',   icon: 'Award',         label: 'Badges & Auszeichnungen' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🧹 REINIGUNG & HYGIENE
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'cleaning',
    label: 'Reinigung & Hygiene',
    icon: 'Sparkles',
    items: [
      { href: '/cleaning',        icon: 'Sparkles', label: 'Reinigungsplan' },
      { href: '/cleaning/plan',   icon: 'Sparkles', label: 'Plan bearbeiten' },
      { href: '/cleaning/photos', icon: 'Sparkles', label: 'Foto-Nachweise' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ✅ CHECK-UPS
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'checkups',
    label: 'Check-ups',
    icon: 'CheckSquare',
    items: [
      { href: '/checkups', icon: 'CheckSquare', label: 'Check-ups' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 📦 LAGER & INVENTAR
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'inventory',
    label: 'Lager & Inventar',
    icon: 'Package',
    items: [
      { group: 'Bestand', href: '/inventory',          icon: 'Package', label: 'Aktueller Bestand' },
      { group: 'Bestand', href: '/inventory/sessions', icon: 'Package', label: 'Inventuren' },
      { group: 'Bestand', href: '/inventory/waste',    icon: 'Package', label: 'Abschriften / Verlust' },

      { group: 'Bestellungen', href: '/inventory/orders',    icon: 'Package', label: 'Bestellungen' },
      { group: 'Bestellungen', href: '/inventory/products',  icon: 'Package', label: 'Produkte' },
      { group: 'Bestellungen', href: '/inventory/suppliers', icon: 'Package', label: 'Lieferanten' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 📊 ANALYTICS & REPORTS
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'analytics',
    label: 'Analytics & Reports',
    icon: 'LayoutDashboard',
    items: [
      { href: '/analytics', icon: 'LayoutDashboard', label: 'Auswertungen' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 📄 DOKUMENTE
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'documents',
    label: 'Dokumente & Verträge',
    icon: 'FileText',
    items: [
      { href: '/documents', icon: 'FileText', label: 'Alle Dokumente' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🔔 BENACHRICHTIGUNGEN
  // ═══════════════════════════════════════════════════════════════════
  {
    moduleId: 'notifications',
    label: 'Benachrichtigungen',
    icon: 'Bell',
    items: [
      { href: '/notifications',       icon: 'Bell', label: 'Feed' },
      { href: '/notifications/rules', icon: 'Bell', label: 'Regeln' },
    ],
  },
];

/** Übersichts-Seiten — immer zugänglich, kein Modul-Kontext. */
const OVERVIEW: SidebarModule = {
  moduleId: '__overview__',
  label: 'Übersicht',
  icon: 'Home',
  items: [
    { href: '/',          icon: 'Home',            label: 'Start (Dashboard)' },
    { href: '/setup-wizard', icon: 'Sparkles',     label: '🧙 Setup-Wizard' },
    { href: '/dashboard', icon: 'LayoutDashboard', label: 'Live-Stats' },
    { href: '/help',      icon: 'HelpCircle',      label: 'Hilfe & Docs' },
  ],
};

/** Admin — immer zugänglich. */
const ADMIN: SidebarModule = {
  moduleId: '__admin__',
  label: 'Admin & Stammdaten',
  icon: 'Settings',
  items: [
    { group: 'Mein Restaurant', href: '/settings/restaurant', icon: 'Building2',  label: 'Stammdaten' },
    { group: 'Mein Restaurant', href: '/locations',           icon: 'MapPin',     label: 'Standorte / Filialen' },
    { group: 'Mein Restaurant', href: '/departments',         icon: 'Building2',  label: 'Abteilungen' },

    { group: 'Globale Einstellungen', href: '/settings/theme-v3', icon: 'Sparkles',   label: 'Brand-Studio (alle Bestellseiten)' },
    { group: 'Globale Einstellungen', href: '/settings/email',    icon: 'Mail',       label: 'E-Mail-Versand' },
    { group: 'Globale Einstellungen', href: '/settings/payments', icon: 'CreditCard', label: 'Zahlungsmethoden (global)' },
    { group: 'Globale Einstellungen', href: '/settings',          icon: 'Settings',   label: 'System-Einstellungen' },

    { group: 'Module & Abos', href: '/modules', icon: 'Boxes', label: 'Module verwalten' },
  ],
};

export async function Sidebar() {
  const active = await getActiveModules();
  const availableModules = MODULE_DEFS.filter((m) => active.has(m.moduleId));

  return (
    <SidebarClient
      modules={availableModules}
      overview={OVERVIEW}
      admin={ADMIN}
    />
  );
}

// Re-export types for use elsewhere
export type { SidebarItem, SidebarModule };
