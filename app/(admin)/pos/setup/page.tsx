import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight, Banknote, Calculator, ChefHat, CreditCard,
  ExternalLink, FileText, Globe, Grid, Lock, Monitor, Palette, Plus, Printer,
  QrCode, Receipt, Shield, ShoppingBag, Smartphone, Wallet,
} from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'POS Setup · Mise' };

type Status = 'ok' | 'warn' | 'todo' | 'off';

export default async function POSSetupPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [
    { count: kassenCount },
    { count: terminalsCount },
    { count: tischeCount },
    { count: tischeMitLayoutCount },
    { count: stationenCount },
    { data: tenant },
    { data: posSettings },
  ] = await Promise.all([
    svc.from('pos_registers').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id).eq('aktiv', true),
    svc.from('pos_terminals').select('id', { count: 'exact', head: true })
      .eq('aktiv', true),
    svc.from('restaurant_tables').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id).eq('aktiv', true),
    svc.from('restaurant_tables').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id).eq('aktiv', true).not('floor_plan_id', 'is', null),
    svc.from('kitchen_stations').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id),
    svc.from('tenants')
      .select('name, slug, sumup_affiliate_key, sumup_verbunden_am, stripe_connect_charges_enabled, custom_domain, custom_domain_status, logo_url, hero_image_url')
      .eq('id', empRow.tenant_id).single(),
    svc.from('pos_settings').select('*').eq('location_id', empRow.location_id).maybeSingle(),
  ]);

  const t = tenant as {
    name: string; slug: string;
    sumup_affiliate_key: string | null; sumup_verbunden_am: string | null;
    stripe_connect_charges_enabled: boolean | null;
    custom_domain: string | null; custom_domain_status: string | null;
    logo_url: string | null; hero_image_url: string | null;
  } | null;

  const settings = posSettings as Record<string, unknown> | null;
  const tip = (settings?.trinkgeld_aktiv as boolean) ?? false;
  const managerPinReq = (settings?.manager_pin_storno as boolean) ?? false;
  const receiptMode = (settings?.receipt_mode as string) ?? 'email';

  const sumupOk = Boolean(t?.sumup_affiliate_key && t.sumup_verbunden_am);
  const stripeOk = Boolean(t?.stripe_connect_charges_enabled);
  const designOk = Boolean(t?.logo_url || t?.hero_image_url);
  const domainOk = Boolean(t?.custom_domain && t?.custom_domain_status === 'verified');
  const domainPending = Boolean(t?.custom_domain && t?.custom_domain_status !== 'verified');

  const lieferungUrl = `https://mise-gastro.de/biss-app/${t?.slug ?? ''}`;

  return (
    <>
      <PageHeader
        title={`POS-Setup${t?.name ? ` · ${t.name}` : ''}`}
        description="Hier konfigurierst du alles rund um deine Kasse und deine Online-Bestellseite. Karten zeigen den aktuellen Status — Klick öffnet die Detail-Einstellungen."
      />

      {/* Quick-Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Kassen aktiv" value={`${kassenCount ?? 0}`} icon={Calculator} hint={`${terminalsCount ?? 0} Tablet${terminalsCount === 1 ? '' : 's'} verbunden`} />
        <Stat label="Tische" value={`${tischeCount ?? 0}`} icon={Grid} hint={`${tischeMitLayoutCount ?? 0} im Floor-Plan`} />
        <Stat label="Karten-Reader" value={sumupOk ? 'SumUp ✓' : 'Im Terminal verbinden'} icon={CreditCard} hint={sumupOk ? 'Tablet + Reader bereit' : 'Setup beim ersten Karten-Klick'} />
        <Stat label="Eigene Domain" value={domainOk ? 'Aktiv ✓' : domainPending ? 'Pending' : 'mise-gastro.de'} icon={Globe} hint={t?.custom_domain ?? 'Subdomain reicht aus'} />
      </div>

      {/* Quick-Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/pos/tables" className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800">
          <Plus className="h-4 w-4" /> Tisch hinzufügen
        </Link>
        <Link href="/pos/registers" className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800">
          <Plus className="h-4 w-4" /> Kasse hinzufügen
        </Link>
        <Link href="/pos/tables/print" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-matcha-900 text-matcha-900 px-4 py-2 text-sm font-bold hover:bg-matcha-50">
          <QrCode className="h-4 w-4" /> Alle QR-Codes drucken
        </Link>
        <Link href="/pos/terminal" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-gray-200 text-gray-900 px-4 py-2 text-sm font-bold hover:bg-gray-50 ml-auto">
          Kasse vorne öffnen <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-8">
        {/* === SEKTION 1: HARDWARE === */}
        <Section title="Hardware in deinem Restaurant" subtitle="Kassen, Tische, Drucker, Stationen">
          <Card
            href="/pos/registers"
            icon={Calculator}
            title="Kassen-Terminals"
            stat={`${kassenCount ?? 0} Kasse${kassenCount === 1 ? '' : 'n'}`}
            description="Wieviele Kassen brauchst du? Jede bekommt einen Pairing-Code zum Anbinden ans Tablet. Mehrere Kassen = parallele Schichten."
            status={kassenCount && kassenCount > 0 ? 'ok' : 'warn'}
            statusLabel={kassenCount && kassenCount > 0 ? 'Bereit' : 'Mindestens 1 anlegen'}
          />
          <Card
            href="/pos/tables"
            icon={Grid}
            title="Tische anlegen & verwalten"
            stat={`${tischeCount ?? 0} Tisch${tischeCount === 1 ? '' : 'e'} aktiv`}
            description="Tische mit Nummer + Kapazität anlegen, deaktivieren, einzelnen QR-Code drucken. Jeder Tisch hat einen sicheren QR-Token."
            status={tischeCount && tischeCount > 0 ? 'ok' : 'warn'}
            statusLabel={tischeCount && tischeCount > 0 ? `${tischeCount} aktiv` : 'Noch keine Tische'}
            extra={[
              { label: 'QR-Codes alle drucken', href: '/pos/tables/print' },
            ]}
          />
          <Card
            href="/pos/tables/layout"
            icon={Grid}
            title="Floor-Plan zeichnen"
            stat={`${tischeMitLayoutCount ?? 0} Tisch${tischeMitLayoutCount === 1 ? '' : 'e'} platziert`}
            description="Drag-and-Drop: Zeichne deinen Gastraum, ziehe Tische auf den Plan. Kellner sehen den Plan im POS-Terminal genauso."
            status={tischeMitLayoutCount && tischeMitLayoutCount > 0 ? 'ok' : 'todo'}
            statusLabel={tischeMitLayoutCount && tischeMitLayoutCount > 0 ? 'Plan da' : 'Optional'}
          />
          <Card
            href="/pos/printers"
            icon={Printer}
            title="Bondrucker verwalten"
            stat="Bluetooth + Test-Druck"
            description="Drucker hinzufügen, Test-Bon drucken, Verbindung verwalten. In der Mise POS-App auf iPad/iPhone."
            status="ok"
            statusLabel="Verfügbar"
          />
          <Card
            href="/pos/stations"
            icon={ChefHat}
            title="Küchen-Stationen"
            stat={`${stationenCount ?? 0} Station${stationenCount === 1 ? '' : 'en'}`}
            description="Routing pro Kategorie: Pizza → Pizza-Station, Getränke → Bar. Bestellungen landen am richtigen Drucker."
            status={stationenCount && stationenCount > 0 ? 'ok' : 'todo'}
            statusLabel={stationenCount && stationenCount > 0 ? 'OK' : 'Optional'}
            extra={[{ label: 'KDS-Drucker verbinden', href: '/pos/stations/devices' }]}
          />
        </Section>

        {/* === SEKTION 2: ONLINE-BESTELLSEITE & QR-TISCH === */}
        <Section
          title="Online-Bestellseite & QR-Tisch"
          subtitle="Eine Bestellseite — funktioniert für Lieferung, Abholung UND QR am Tisch"
        >
          <Card
            href="/shop/design"
            icon={Palette}
            title="Design anpassen"
            stat={designOk ? 'Logo + Banner gesetzt' : 'Noch generisch'}
            description="Logo, Banner-Bild, Farben, Schriften. Dein Branding gilt für alle Gäste — egal ob sie zu Hause via Lieferung bestellen oder vor Ort am Tisch QR scannen."
            status={designOk ? 'ok' : 'warn'}
            statusLabel={designOk ? 'Konfiguriert' : 'Logo + Bild fehlt'}
          />
          <Card
            href="/settings/domain"
            icon={Globe}
            title="Eigene Domain"
            stat={t?.custom_domain ?? 'mise-gastro.de/' + (t?.slug ?? 'restaurant')}
            description="Verbinde z. B. bestellen.dein-restaurant.de mit deiner Bestellseite. Eine Domain — funktioniert für Lieferung + QR-Tisch."
            status={domainOk ? 'ok' : domainPending ? 'todo' : 'todo'}
            statusLabel={domainOk ? 'Aktiv' : domainPending ? 'DNS-Verify läuft' : 'Optional'}
          />
          <Card
            href={lieferungUrl}
            icon={ShoppingBag}
            title="Bestellseite Lieferung ansehen"
            stat="Was Kunden zu Hause sehen"
            description="Vorschau auf die Online-Bestellseite. So sieht's der Kunde wenn er von zu Hause bestellt."
            status="ok"
            statusLabel="Live"
            externalLink
          />
          <Card
            href="/shop/hours"
            icon={Receipt}
            title="Öffnungszeiten"
            stat="Wann darf bestellt werden"
            description="Öffnungszeiten für Lieferung, Abholung und QR-Tisch. Außerhalb: Bestellseite zeigt 'Geschlossen — komm Mo 11 Uhr wieder'."
            status="ok"
            statusLabel="Bereit"
          />
          <Card
            href="/shop/delivery"
            icon={Smartphone}
            title="Lieferradius & Gebühren"
            stat="PLZ + Mindestbestellwert"
            description="Wo lieferst du hin? Pro PLZ: Liefergebühr, Mindestbestellwert, Liefer-ETA. QR-Tisch braucht das nicht."
            status="ok"
            statusLabel="Konfigurierbar"
          />
        </Section>

        {/* === SEKTION 3: ZAHLUNG IM RESTAURANT === */}
        <Section title="Zahlung vorne in der Kasse" subtitle="SumUp, Bar, Mobile am Tisch">
          <Card
            href="/pos/terminal"
            icon={CreditCard}
            title="SumUp · Karten am Tisch"
            stat={sumupOk ? `Verbunden ✓ ${t?.sumup_verbunden_am ? new Date(t.sumup_verbunden_am).toLocaleDateString('de-DE') : ''}` : 'Nicht verbunden'}
            description={sumupOk
              ? 'SumUp-Affiliate-Key ist hinterlegt. Reader-Pairing läuft direkt in der SumUp-App auf dem Tablet — Mise muss da nichts tun.'
              : 'Die Verbindung passiert direkt im Kassen-Terminal beim ersten Klick auf "Karte". 4-Step-Wizard führt dich durch App-Install, Reader-Pairing, Affiliate-Key.'}
            status={sumupOk ? 'ok' : 'todo'}
            statusLabel={sumupOk ? 'Live' : 'Im Terminal verbinden'}
          />
          <Card
            href="/shop/payments"
            icon={Banknote}
            title="Welche Zahlungsarten anbieten"
            stat="Bar · Karte · Mobile · Online"
            description="Pro Standort: was sieht der Kassierer im POS und der Gast online? Bar immer an, andere optional."
            status="ok"
            statusLabel="Konfigurierbar"
          />
        </Section>

        {/* === SEKTION 4: SICHERHEIT & WORKFLOW === */}
        <Section title="Sicherheit & Workflow" subtitle="Manager-PIN, Trinkgeld, Bon-Output">
          <Card
            href="/settings/manager-pin"
            icon={Lock}
            title="Manager-PIN"
            stat={managerPinReq ? 'Pflicht für Storno' : 'Nicht erforderlich'}
            description="PIN für Storno, Rabatte, Z-Bon. Verhindert Missbrauch durch Mitarbeiter."
            status={managerPinReq ? 'ok' : 'todo'}
            statusLabel={managerPinReq ? 'Aktiv' : 'Empfohlen'}
          />
          <Card
            href="/pos/settings"
            icon={Smartphone}
            title="Bon-Output"
            stat={bonModeLabel(receiptMode)}
            description="Wie der Gast den Bon kriegt: Bluetooth-Druck, QR-Code am Display, E-Mail oder Auswahl beim Bezahlen."
            status="ok"
            statusLabel="Konfiguriert"
          />
          <Card
            href="/pos/settings"
            icon={Receipt}
            title="Trinkgeld + Service"
            stat={tip ? 'Aktiviert' : 'Aus'}
            description="Trinkgeld-Stufen (5/10/15%), Aufrunden, Service-Charge automatisch beim Bezahlen anbieten."
            status={tip ? 'ok' : 'todo'}
            statusLabel={tip ? 'Aktiv' : 'Empfohlen'}
          />
        </Section>

        {/* === SEKTION 5: COMPLIANCE & FINANZEN === */}
        <Section title="Compliance & Finanzen" subtitle="DSFinV-K, TSE, Tagesabschluss">
          <Card
            href="/settings/kassenpruefung"
            icon={FileText}
            title="DSFinV-K-Export"
            stat="13 CSVs + index.xml"
            description="BMF-konformer Komplett-Export für Kassen-Nachschau und Betriebsprüfung. ZIP mit SHA-256-Tamper-Detection."
            status="ok"
            statusLabel="Bereit"
          />
          <Card
            href="/settings/tse"
            icon={Shield}
            title="TSE (Fiskaly)"
            stat="Phase 2"
            description="Technische Sicherheitseinrichtung — Pflicht ab Umsatzschwelle. Pilot läuft 4 Wochen ohne TSE."
            status="off"
            statusLabel="Später aktivieren"
          />
          <Card
            href="/cash"
            icon={Banknote}
            title="Kassenbuch & Tagesabschluss"
            stat="Bar + Karte getrennt"
            description="Tägliches Wechselgeld, Zwischen-Entnahmen, Z-Bericht am Ende. Schicht-übergreifend."
            status="ok"
            statusLabel="Bereit"
          />
          <Card
            href="/pos/z-report"
            icon={Receipt}
            title="Z-Bericht abrufen"
            stat="Tag / Woche / Monat"
            description="Z-Bericht und X-Abruf, mit Steuersatz-Aufteilung und Storno-Übersicht."
            status="ok"
            statusLabel="Bereit"
          />
        </Section>

        {/* === SEKTION 6: VORNE === */}
        <Section title="Vorne in der Kasse" subtitle="Schichten, Mitarbeiter, Verbindung zur App">
          <Card
            href="/pos/terminal"
            icon={Monitor}
            title="Kassen-Terminal öffnen"
            stat="Vollbild · Touch-optimiert"
            description="Die eigentliche Kasse für Servicekräfte. Tisch-Auswahl, Bestellung aufnehmen, Bezahlen, Bon."
            status="ok"
            statusLabel="Live"
          />
          <Card
            href="/pos"
            icon={Receipt}
            title="Bon-Historie"
            stat="Alle Bestellungen"
            description="Vergangene Bons durchsuchen, neu drucken, stornieren, Refund einleiten."
            status="ok"
            statusLabel="Bereit"
          />
          <Card
            href="/employees"
            icon={Lock}
            title="Mitarbeiter & Rollen"
            stat="5 Rollen-Stufen"
            description="Mitarbeiter anlegen, Rolle zuweisen, per Token einladen. Rollen: Mitarbeiter / Teamleiter / Manager / Backoffice / Admin."
            status="ok"
            statusLabel="Bereit"
          />
        </Section>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-xl font-black">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-black mt-1 truncate">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function Card({
  href, icon: Icon, title, stat, description, status, statusLabel, extra, externalLink,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  stat: string;
  description: string;
  status: Status;
  statusLabel: string;
  extra?: { label: string; href: string }[];
  externalLink?: boolean;
}) {
  const dot = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    todo: 'bg-blue-500',
    off: 'bg-gray-300',
  }[status];
  const pill = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    todo: 'bg-blue-50 text-blue-800 border-blue-200',
    off: 'bg-gray-50 text-gray-600 border-gray-200',
  }[status];

  const inner = (
    <>
      <div className="flex items-start gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-matcha-50 text-matcha-900 grid place-items-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold leading-tight">{title}</h3>
          <div className="text-xs font-mono text-gray-600 mt-0.5 truncate">{stat}</div>
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', pill)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
          {statusLabel}
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
      <div className="mt-3 text-xs font-bold text-matcha-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        Öffnen {externalLink ? <ExternalLink className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
      </div>
    </>
  );

  return (
    <div className="bg-white rounded-2xl border hover:border-matcha-900 hover:shadow-md transition group flex flex-col">
      {externalLink ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="p-4 flex-1 flex flex-col">
          {inner}
        </a>
      ) : (
        <Link href={href} className="p-4 flex-1 flex flex-col">
          {inner}
        </Link>
      )}
      {extra && extra.length > 0 && (
        <div className="border-t px-4 py-2 flex flex-wrap gap-3">
          {extra.map((e) => (
            <Link key={e.href} href={e.href} className="text-[11px] font-bold text-matcha-900 hover:underline">
              {e.label} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function bonModeLabel(mode: string): string {
  switch (mode) {
    case 'printer': return 'Bluetooth-Drucker';
    case 'qr': return 'QR am Display';
    case 'email': return 'E-Mail an Gast';
    case 'ask_customer': return 'Kunde wählt';
    case 'none': return 'Aus';
    default: return mode;
  }
}
