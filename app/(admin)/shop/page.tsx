import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowRight, ArrowUpRight, Bell, Bike, CheckCircle2, Circle, Clock,
  CreditCard, Eye, FileText, Globe, MapPin, Palette, ScrollText, ShieldCheck,
  ShoppingBag, Sparkles, Store, Ticket, TrendingUp, Truck,
  UtensilsCrossed, Wallet,
} from 'lucide-react';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { euro, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Online-Shop · Mise' };

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  custom_domain_status: 'pending' | 'verified' | 'error' | null;
  hero_image_url: string | null;
  logo_url: string | null;
  storefront_theme_id: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  stripe_connect_charges_enabled: boolean;
  oeffnungszeiten_json: unknown;
  liefergebuehr: number | null;
  lieferradius_km: number | null;
  mindestbestellwert: number | null;
  resend_verified_at: string | null;
  agb_url: string | null;
  datenschutz_url: string | null;
  impressum_text: string | null;
};

type DriverRow = {
  id: string;
  vorname: string | null;
  nachname: string | null;
  driver_status: { ist_online: boolean }[] | null;
};

export default async function ShopOverviewPage() {
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const tenantId = emp.tenant_id;
  const svc = createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { data: tenant },
    { count: menuItemsCount },
    { count: categoriesCount },
    { count: activeVouchersCount },
    { count: ordersTodayCount },
    { count: ordersYesterdayCount },
    { count: ordersWeekCount },
    { data: salesToday },
    { data: drivers },
    { count: zonesCount },
    { data: posSettings },
  ] = await Promise.all([
    svc
      .from('tenants')
      .select('id,name,slug,custom_domain,custom_domain_status,hero_image_url,logo_url,storefront_theme_id,theme_primary,theme_accent,stripe_connect_charges_enabled,oeffnungszeiten_json,liefergebuehr,lieferradius_km,mindestbestellwert,resend_verified_at,agb_url,datenschutz_url,impressum_text')
      .eq('id', tenantId)
      .single<TenantRow>(),
    svc.from('menu_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('aktiv', true),
    svc.from('menu_categories').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    svc.from('vouchers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('aktiv', true),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('bestellt_am', today),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('bestellt_am', yesterday).lt('bestellt_am', today),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('bestellt_am', weekAgo),
    svc.from('customer_orders').select('gesamtbetrag').eq('tenant_id', tenantId).gte('bestellt_am', today),
    svc
      .from('employees')
      .select('id, vorname, nachname, driver_status(ist_online)')
      .eq('tenant_id', tenantId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true)
      .returns<DriverRow[]>(),
    svc.from('delivery_zones').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('aktiv', true),
    svc.from('pos_settings').select('lieferando_api_connected').eq('tenant_id', tenantId).maybeSingle<{ lieferando_api_connected: boolean | null }>(),
  ]);

  if (!tenant) redirect('/start');

  const umsatzShop = (salesToday as { gesamtbetrag: number | null }[] | null ?? [])
    .reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);

  // === Status-Ableitungen ===
  const driverList = drivers ?? [];
  const onlineDrivers = driverList.filter((d) => d.driver_status?.[0]?.ist_online).length;
  const totalDrivers = driverList.length;

  const hasHero = Boolean(tenant.hero_image_url);
  const hasLogo = Boolean(tenant.logo_url);
  const hasMenu = (menuItemsCount ?? 0) > 0;
  const hasCategories = (categoriesCount ?? 0) > 0;
  const hasHours = Array.isArray(tenant.oeffnungszeiten_json) && tenant.oeffnungszeiten_json.length > 0;
  const hasStripe = tenant.stripe_connect_charges_enabled;
  const hasDriver = totalDrivers > 0;
  const hasFee = (tenant.liefergebuehr ?? 0) >= 0 && tenant.liefergebuehr !== null;
  const hasLegal = Boolean(tenant.agb_url && tenant.datenschutz_url && tenant.impressum_text);
  const hasZones = (zonesCount ?? 0) > 0;

  const checklist = [
    { id: 'menu',       label: 'Speisekarte angelegt',         done: hasMenu,       href: '/menu' },
    { id: 'categories', label: 'Kategorien angelegt',          done: hasCategories, href: '/menu' },
    { id: 'design',     label: 'Logo + Banner hochgeladen',    done: hasHero && hasLogo, href: '/shop/design' },
    { id: 'hours',      label: 'Öffnungszeiten gepflegt',      done: hasHours,      href: '/shop/hours' },
    { id: 'stripe',     label: 'Stripe-Konto verbunden',       done: hasStripe,     href: '/shop/payments' },
    { id: 'driver',     label: 'Mindestens 1 Fahrer eingeladen', done: hasDriver,   href: '/shop/drivers' },
    { id: 'fee',        label: 'Liefergebühr gesetzt',         done: hasFee,        href: '/shop/delivery' },
    { id: 'zones',      label: 'Lieferzonen definiert',        done: hasZones,      href: '/shop/delivery' },
    { id: 'legal',      label: 'Impressum & Datenschutz',      done: hasLegal,      href: '/settings/legal' },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistTotal = checklist.length;
  const checklistOpen = checklist.filter((c) => !c.done);
  const setupComplete = checklistOpen.length === 0;

  // === Public URL des Shops ===
  const publicUrl = tenant.custom_domain && tenant.custom_domain_status === 'verified'
    ? `https://${tenant.custom_domain}`
    : `https://mise-gastro.de/order/${tenant.slug}`;
  const customDomainPending = tenant.custom_domain && tenant.custom_domain_status === 'pending';
  const customDomainError = tenant.custom_domain && tenant.custom_domain_status === 'error';

  // === QR-Code als Data-URL serverseitig generieren ===
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 320,
    margin: 2,
    color: { dark: '#0f2922', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });

  const primary = tenant.theme_primary ?? '#14532d';
  const accent = tenant.theme_accent ?? '#4ae68a';
  const lieferandoConnected = posSettings?.lieferando_api_connected === true;

  return (
    <>
      <PageHeader
        title="Online-Shop"
        description="Dein Liefer-Cockpit. Hier kommt alles zusammen: Speisekarte, Design, Domain, Stripe, Fahrer, Zonen."
        actions={
          <div className="flex gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-4 py-2 text-sm font-bold hover:bg-muted/50"
            >
              <Eye size={14} /> Bestellseite ansehen <ArrowUpRight size={12} />
            </a>
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800"
            >
              <UtensilsCrossed size={14} /> Speisekarte bearbeiten
            </Link>
          </div>
        }
      />

      {/* Hero — Shop-URL + Domain-Status + QR */}
      <Card
        className="p-5 md:p-6 mb-6 text-white border-0 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 70%, ${accent}33 100%)` }}
      >
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl opacity-25" style={{ backgroundColor: accent }} />
        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              <Store size={11} /> Deine Bestellseite
            </div>
            <div className="mt-2 font-display text-3xl md:text-4xl font-black tracking-tight">{tenant.name}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/15 px-3 py-1.5 text-sm font-mono">
              <Globe size={12} /> {publicUrl.replace(/^https?:\/\//, '')}
            </div>
            {tenant.custom_domain && tenant.custom_domain_status === 'verified' && (
              <div className="mt-2 text-xs opacity-80 inline-flex items-center gap-1">
                <ShieldCheck size={12} /> eigene Domain aktiv · Subdomain bleibt erreichbar
              </div>
            )}
            {customDomainPending && (
              <Link href="/shop/domain" className="mt-2 inline-flex items-center gap-1.5 text-xs underline bg-amber-300/20 px-2.5 py-1 rounded-full">
                Eigene Domain wartet auf DNS — Anleitung
              </Link>
            )}
            {customDomainError && (
              <Link href="/shop/domain" className="mt-2 inline-flex items-center gap-1.5 text-xs underline bg-red-300/20 px-2.5 py-1 rounded-full">
                Eigene Domain hat ein Problem — beheben
              </Link>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/shop/domain`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs hover:bg-white/20"
              >
                <Globe size={12} /> Domain konfigurieren
              </Link>
              <Link
                href={`/shop/qr-design`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs hover:bg-white/20"
              >
                <ScrollText size={12} /> QR-Aufsteller drucken
              </Link>
            </div>
          </div>

          {/* QR-Code Box */}
          <div className="rounded-2xl bg-white p-3 shadow-strong text-center w-fit mx-auto md:mx-0">
            <img src={qrDataUrl} alt={`QR zu ${publicUrl}`} width={160} height={160} className="block" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-900 mt-1">
              QR · Bestellseite
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KPI icon={<TrendingUp size={14} />}  label="Umsatz heute"        value={euro(umsatzShop)} />
        <KPI icon={<ShoppingBag size={14} />} label="Bestellungen heute"  value={ordersTodayCount ?? 0} sub={`gestern ${ordersYesterdayCount ?? 0} · 7T ${ordersWeekCount ?? 0}`} />
        <KPI icon={<Bike size={14} />}        label="Fahrer online"       value={`${onlineDrivers}/${totalDrivers}`} sub={totalDrivers === 0 ? 'noch keiner eingeladen' : undefined} />
        <KPI icon={<CreditCard size={14} />}  label="Online-Zahlung"      value={hasStripe ? 'aktiv' : 'aus'} tone={hasStripe ? 'green' : 'amber'} />
        <KPI icon={<Globe size={14} />}       label="Domain"              value={tenant.custom_domain && tenant.custom_domain_status === 'verified' ? 'eigen' : tenant.custom_domain ? 'pending' : 'Sub'} tone={tenant.custom_domain && tenant.custom_domain_status === 'verified' ? 'green' : tenant.custom_domain ? 'amber' : 'muted'} />
      </div>

      {/* Setup-Checkliste — nur wenn was offen ist (oder als grüne „Alles bereit"-Karte) */}
      {setupComplete ? (
        <Card className="p-5 mb-6 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white grid place-items-center">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg font-bold text-emerald-900">Shop ist startklar.</div>
              <p className="text-sm text-emerald-800 mt-0.5">
                Alle {checklistTotal} Setup-Punkte erledigt. Du kannst jetzt loslegen.
              </p>
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-emerald-700 text-white px-4 py-2 text-sm font-bold inline-flex items-center gap-1.5 hover:bg-emerald-800"
            >
              Bestellseite öffnen <ArrowUpRight size={14} />
            </a>
          </div>
        </Card>
      ) : (
        <Card className="p-5 mb-6 border-amber-200 bg-amber-50/40">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-700" />
                <h2 className="font-display text-lg font-bold">Setup-Checkliste</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {checklistDone} von {checklistTotal} erledigt · {checklistOpen.length} {checklistOpen.length === 1 ? 'Schritt' : 'Schritte'} offen
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-amber-900">
                {Math.round((checklistDone / checklistTotal) * 100)}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">fertig</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {checklist.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition',
                  c.done
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                    : 'border-dashed border-amber-300 bg-white hover:bg-amber-50',
                )}
              >
                {c.done
                  ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  : <Circle size={16} className="text-amber-500 shrink-0" />}
                <span className="flex-1 truncate">{c.label}</span>
                {!c.done && <ArrowRight size={12} className="text-amber-600 opacity-0 group-hover:opacity-100" />}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Sektion: Marke & Erscheinung */}
      <SectionTitle title="Marke & Erscheinung" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <SectionCard
          href="/shop/design"
          icon={<Palette className="h-5 w-5" />}
          title="Design & Banner"
          subtitle={`Theme · ${themeLabel(tenant.storefront_theme_id)} · ${hasHero ? 'Banner ✓' : 'Banner fehlt'} · ${hasLogo ? 'Logo ✓' : 'Logo fehlt'}`}
          cta="Anpassen"
          warn={!hasHero || !hasLogo}
        />
        <SectionCard
          href="/shop/domain"
          icon={<Globe className="h-5 w-5" />}
          title="Eigene Domain"
          subtitle={
            tenant.custom_domain && tenant.custom_domain_status === 'verified'
              ? `${tenant.custom_domain} · aktiv ✓`
              : tenant.custom_domain
                ? `${tenant.custom_domain} · ${tenant.custom_domain_status === 'pending' ? 'wartet auf DNS' : 'Fehler'}`
                : `Subdomain: /order/${tenant.slug}`
          }
          cta={tenant.custom_domain ? 'Status prüfen' : 'Domain hinzufügen'}
          warn={customDomainPending || customDomainError || false}
        />
        <SectionCard
          href="/shop/hours"
          icon={<Clock className="h-5 w-5" />}
          title="Öffnungszeiten"
          subtitle={hasHours ? `${(tenant.oeffnungszeiten_json as unknown[]).length} Zeitfenster` : 'Noch keine Zeiten hinterlegt'}
          cta="Zeiten setzen"
          warn={!hasHours}
        />
      </div>

      {/* Sektion: Lieferung */}
      <SectionTitle title="Lieferung" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <SectionCard
          href="/shop/drivers"
          icon={<Bike className="h-5 w-5" />}
          title="Fahrer · Mise Driver App"
          subtitle={
            totalDrivers === 0
              ? 'Noch keine Fahrer eingeladen'
              : `${totalDrivers} Fahrer · ${onlineDrivers} online`
          }
          cta={totalDrivers === 0 ? 'Ersten Fahrer einladen' : 'Fahrer verwalten'}
          warn={totalDrivers === 0}
        />
        <SectionCard
          href="/shop/delivery"
          icon={<MapPin className="h-5 w-5" />}
          title="Lieferzonen & Kosten"
          subtitle={
            hasZones
              ? `${zonesCount} Zone${(zonesCount ?? 0) === 1 ? '' : 'n'} · Liefergebühr ${tenant.liefergebuehr !== null ? euro(tenant.liefergebuehr) : '—'}`
              : tenant.lieferradius_km
                ? `Radius ${tenant.lieferradius_km} km · ${tenant.liefergebuehr !== null ? euro(tenant.liefergebuehr) : '—'} pauschal`
                : 'Noch keine Zone definiert'
          }
          cta="Zonen + Gebühren"
          warn={!hasZones && !tenant.lieferradius_km}
        />
        <SectionCard
          href={lieferandoConnected ? '/settings/platforms' : '/modules?locked=delivery'}
          icon={<Truck className="h-5 w-5" />}
          title="Lieferando / Uber Eats Sync"
          subtitle={lieferandoConnected
            ? 'Aktiv — externe Bestellungen werden automatisch importiert'
            : 'Bestellungen von externen Plattformen automatisch übernehmen'}
          cta={lieferandoConnected ? 'Verbindungen ansehen' : 'Sync einrichten'}
        />
      </div>

      {/* Sektion: Zahlung */}
      <SectionTitle title="Zahlung" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <SectionCard
          href="/shop/payments"
          icon={<CreditCard className="h-5 w-5" />}
          title="Stripe Connect"
          subtitle={hasStripe
            ? 'Online-Zahlung aktiv · Apple/Google Pay verfügbar'
            : 'Nicht verbunden — kein Apple/Google Pay'}
          cta={hasStripe ? 'Konto-Status' : 'Stripe verbinden'}
          warn={!hasStripe}
        />
        <SectionCard
          href="/settings/payments"
          icon={<Wallet className="h-5 w-5" />}
          title="Zahlmethoden-Matrix"
          subtitle="Bar / Karte / Online — pro Lieferung & Abholung"
          cta="Konfigurieren"
        />
      </div>

      {/* Sektion: Marketing */}
      <SectionTitle title="Marketing & Kunden" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <SectionCard
          href="/menu"
          icon={<UtensilsCrossed className="h-5 w-5" />}
          title="Speisekarte"
          subtitle={`${menuItemsCount ?? 0} Produkte · ${categoriesCount ?? 0} Kategorien`}
          cta="Bearbeiten"
          warn={!hasMenu}
        />
        <SectionCard
          href="/vouchers"
          icon={<Ticket className="h-5 w-5" />}
          title="Gutscheine"
          subtitle={`${activeVouchersCount ?? 0} aktive Codes`}
          cta="Verwalten"
        />
        <SectionCard
          href="/campaigns"
          icon={<Bell className="h-5 w-5" />}
          title="Kampagnen"
          subtitle={tenant.resend_verified_at ? 'E-Mail · Push an Kunden' : 'Resend nicht verbunden'}
          cta={tenant.resend_verified_at ? 'Neue Kampagne' : 'E-Mail einrichten'}
          warn={!tenant.resend_verified_at}
        />
      </div>

      {/* Sektion: Recht */}
      <SectionTitle title="Pflichtangaben" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <SectionCard
          href="/settings/legal"
          icon={<FileText className="h-5 w-5" />}
          title="Impressum · AGB · Datenschutz"
          subtitle={
            hasLegal
              ? 'Alle Pflichttexte vorhanden ✓'
              : `${[tenant.impressum_text ? 'Impressum' : null, tenant.agb_url ? 'AGB' : null, tenant.datenschutz_url ? 'Datenschutz' : null].filter(Boolean).length}/3 hinterlegt`
          }
          cta="Pflegen"
          warn={!hasLegal}
        />
      </div>

      {/* Driver-App-Banner */}
      <Card className="p-5 bg-gradient-to-br from-matcha-50 to-emerald-50 border-emerald-200">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="h-14 w-14 rounded-2xl bg-matcha-900 text-matcha-50 grid place-items-center shrink-0">
            <Bike size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-bold">Mise Driver App</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Deine eingeladenen Fahrer loggen sich mit ihrer Email ein und sehen alle dispatchten Touren live.
              {totalDrivers === 0 && ' Lade jetzt deinen ersten Fahrer ein.'}
            </p>
          </div>
          <Link
            href="/shop/drivers"
            className="rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold inline-flex items-center gap-2 hover:bg-matcha-800 shrink-0"
          >
            {totalDrivers === 0 ? 'Ersten Fahrer einladen' : 'Fahrer verwalten'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </Card>
    </>
  );
}

/* ───────── Helper-Komponenten ───────── */

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-3 font-display text-sm uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
  );
}

function KPI({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'green' | 'amber' | 'muted';
}) {
  return (
    <Card className={cn(
      'p-4',
      tone === 'green' && 'border-emerald-200 bg-emerald-50/40',
      tone === 'amber' && 'border-amber-200 bg-amber-50/40',
    )}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function SectionCard({
  href, icon, title, subtitle, cta, warn,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group rounded-2xl border bg-card p-5 hover:shadow-soft hover:-translate-y-0.5 transition block',
        warn && 'border-amber-200 bg-amber-50/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
          warn ? 'bg-amber-100 text-amber-800' : 'bg-matcha-100 text-matcha-800',
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-bold">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 group-hover:translate-x-0.5 transition" />
      </div>
      <div className={cn(
        'mt-3 text-xs font-bold flex items-center gap-1',
        warn ? 'text-amber-800' : 'text-matcha-800',
      )}>
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

function themeLabel(id: string | null): string {
  if (!id) return 'Classic (Default)';
  const map: Record<string, string> = {
    classic: 'Classic', bold: 'Bold', minimal: 'Minimal',
    farmhouse: 'Farmhouse', urban: 'Urban Dark', aurora: 'Aurora',
  };
  return map[id] ?? id;
}
