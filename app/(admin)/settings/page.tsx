import Link from 'next/link';
import {
  Award, Banknote, Beaker, Bell, Building2, ClipboardCheck, CreditCard,
  FileText, Globe, Key, ListChecks, ListOrdered, Mail, MapPin, Palette,
  Shield, ShoppingBag, Smartphone, Tags, Truck, Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveModules } from '@/lib/modules';

type SettingsItem = {
  href: string;
  icon: typeof MapPin;
  title: string;
  desc: string;
  /** Wenn gesetzt: Eintrag ist gesperrt wenn dieses Modul nicht aktiv ist. */
  requiresModule?: string;
};

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

const SECTIONS: SettingsSection[] = [
  {
    title: 'Marke & Erscheinung',
    items: [
      { href: '/settings/restaurant', icon: ShoppingBag, title: 'Restaurant-Daten',     desc: 'Name, Adresse, Öffnungszeiten, Kontakt.' },
      { href: '/settings/theme-v3',   icon: Palette,     title: 'Bestellseite-Design',  desc: 'Theme, Farben, Schrift. Wirkt auf alle Bestellseiten.', requiresModule: 'ordering' },
      { href: '/settings/domain',     icon: Globe,       title: 'Eigene Domain',        desc: 'CNAME einrichten, eigene Bestell-URL.' },
    ],
  },
  {
    title: 'Zahlung',
    items: [
      { href: '/settings/stripe',   icon: CreditCard, title: 'Stripe Connect', desc: 'Online-Zahlung, Trinkgeld, Karten am Kunden-Checkout.' },
      { href: '/settings/sumup',    icon: Smartphone, title: 'SumUp',          desc: 'Karten-Reader für Theken-Zahlung via Deep-Link.', requiresModule: 'cash' },
      { href: '/settings/payments', icon: Banknote,   title: 'Zahlmethoden',   desc: 'Welche Zahlarten dem Gast angeboten werden.' },
    ],
  },
  {
    title: 'Kasse & Compliance',
    items: [
      { href: '/settings/tse',            icon: Shield,         title: 'TSE',            desc: 'Technische Sicherheitseinrichtung pro Kasse aktivieren.',     requiresModule: 'cash' },
      { href: '/settings/legal',          icon: FileText,       title: 'Impressum / AGB', desc: 'Pflicht-Texte für Bestellseite und Bons.',                    requiresModule: 'cash' },
      { href: '/settings/kassenpruefung', icon: ClipboardCheck, title: 'Kassenprüfung',  desc: 'Vorbereitung Finanzamt-Außenprüfung (GoBD, DSFinV-K).',        requiresModule: 'cash' },
      { href: '/settings/manager-pin',    icon: Key,            title: 'Manager-PIN',    desc: 'PIN für Storno, Rabatt, Schubladen-Öffnung.',                  requiresModule: 'cash' },
      { href: '/settings/training-mode',  icon: Beaker,         title: 'Schulungsmodus', desc: 'Übungs-Bons ohne TSE-Signatur (kein DSFinV-K-Export).',        requiresModule: 'cash' },
    ],
  },
  {
    title: 'Speisekarte & Preise',
    items: [
      { href: '/settings/coursing',       icon: ListOrdered, title: 'Gänge / Coursing', desc: 'Mehrere Gänge pro Bestellung, gestaffelte Küchen-Freigabe.' },
      { href: '/settings/order-profiles', icon: Tags,        title: 'Bestell-Profile',  desc: 'Hier/Außer-Haus, Happy-Hour, Service-Charge — pro Profil andere Preise.' },
      { href: '/settings/price-lists',    icon: ListChecks,  title: 'Preislisten',      desc: 'Zeitgesteuerte Preis-Overrides (Lunch, Late-Night, Weekend).' },
    ],
  },
  {
    title: 'Lieferung',
    items: [
      { href: '/settings/platforms', icon: Truck, title: 'Liefer-Plattformen', desc: 'Lieferando, Uber Eats, Wolt — Bestellungen importieren.', requiresModule: 'delivery' },
    ],
  },
  {
    title: 'Kommunikation',
    items: [
      { href: '/settings/email', icon: Mail, title: 'E-Mail-Versand', desc: 'Resend-Account verbinden, Absender-Adresse setzen.' },
    ],
  },
  {
    title: 'Stammdaten',
    items: [
      { href: '/locations',     icon: MapPin,    title: 'Standorte',          desc: 'Adressen, GPS, Geofence-Radius.' },
      { href: '/departments',   icon: Building2, title: 'Abteilungen',        desc: 'Bar, Küche, Service, Farben.' },
      { href: '/badges',        icon: Award,     title: 'Badges',             desc: 'Auszeichnungs-Regeln & Punkte.',  requiresModule: 'training' },
      { href: '/notifications', icon: Bell,      title: 'Benachrichtigungen', desc: 'Feed der letzten Events.',         requiresModule: 'notifications' },
      { href: '/documents',     icon: FileText,  title: 'Dokumente',          desc: 'Ablauf-Überwachung.',              requiresModule: 'documents' },
    ],
  },
];

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [
    { count: locations },
    { count: departments },
    { count: badges },
    activeModules,
  ] = await Promise.all([
    supabase.from('locations').select('id', { count: 'exact', head: true }),
    supabase.from('departments').select('id', { count: 'exact', head: true }),
    supabase.from('badges').select('id', { count: 'exact', head: true }),
    getActiveModules(),
  ]);

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        description="Zentrale Konfiguration — gruppiert nach Bereich. Gesperrte Einträge brauchen ein aktives Modul."
      />

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 font-display text-sm uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                const locked = !!item.requiresModule && !activeModules.has(item.requiresModule);
                const href = locked ? `/modules?locked=${item.requiresModule}` : item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={'hub-tile' + (locked ? ' opacity-60 hover:opacity-100' : '')}
                    aria-disabled={locked ? 'true' : undefined}
                  >
                    <div className="hub-tile-icon">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-display text-lg font-semibold">
                      {item.title}
                      {locked && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Modul nicht aktiv" />}
                    </div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                    {locked && (
                      <div className="mt-2 text-xs text-amber-700">
                        Braucht Modul „{item.requiresModule}" — Testen starten
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Card className="mt-12">
        <CardHeader><CardTitle>Systemstatus</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Standorte"     value={locations ?? 0} />
          <Stat label="Abteilungen"   value={departments ?? 0} />
          <Stat label="Badges"        value={badges ?? 0} />
          <Stat label="Aktive Module" value={activeModules.size} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
