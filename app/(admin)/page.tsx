import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight, ArrowUpRight, Bell, Bike, ChefHat, Clock, CreditCard,
  Grid, Rocket, Sparkles, Store, TrendingUp, Utensils,
} from 'lucide-react';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { getTenantModules } from '@/lib/modules';
import { euro, cn } from '@/lib/utils';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  inhaber_vollname: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  stripe_connect_charges_enabled: boolean;
  onboarding_abgeschlossen: boolean;
};

export default async function HomePage() {
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const tenantId = emp.tenant_id;
  const svc = createServiceClient();

  // Auto-Trigger Setup-Wizard beim Erstlogin
  const { data: wizCheck } = await svc.from('tenants').select('wizard_completed_at, wizard_skipped_at').eq('id', tenantId).maybeSingle();
  if (wizCheck && !wizCheck.wizard_completed_at && !wizCheck.wizard_skipped_at) {
    redirect('/setup-wizard');
  }

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: tenant },
    tenantModules,
    { count: ordersTodayCount },
    { count: openPickupCount },
    { count: kitchenCount },
    { count: deliveryCount },
    { data: salesToday },
    { count: staffCount },
  ] = await Promise.all([
    svc.from('tenants').select('id,name,slug,inhaber_vollname,theme_primary,theme_accent,stripe_connect_charges_enabled,onboarding_abgeschlossen').eq('id', tenantId).single(),
    getTenantModules(),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('bestellt_am', today),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'fertig'),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['bestaetigt', 'in_zubereitung']),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['bereit_zur_lieferung', 'unterwegs']),
    svc.from('pos_transactions').select('brutto_gesamt').eq('typ', 'verkauf').gte('created_at', today),
    svc.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('aktiv', true),
  ]);

  if (!tenant) redirect('/start');
  const t = tenant as Tenant;

  const umsatzHeute = (salesToday as { brutto_gesamt: number | null }[] | null ?? [])
    .reduce((s, r) => s + Number(r.brutto_gesamt ?? 0), 0);

  const primary = t.theme_primary ?? '#14532d';
  const accent = t.theme_accent ?? '#4ae68a';
  const firstName = t.inhaber_vollname?.split(' ')[0] ?? emp.vorname;
  const initial = (t.name[0] ?? 'F').toUpperCase();

  // Trial-Module, die bald ablaufen
  const expiringTrials = tenantModules
    .filter((m) => m.status === 'trial' && m.aktiv && m.ablauf_am)
    .map((m) => {
      const days = Math.ceil((new Date(m.ablauf_am!).getTime() - Date.now()) / (24 * 3600 * 1000));
      return { module_id: m.module_id, days };
    })
    .filter((x) => x.days >= 0 && x.days <= 7);

  const activeModulesCount = tenantModules.filter((m) =>
    m.aktiv && (m.status === 'aktiv' || (m.status === 'trial' && m.ablauf_am && new Date(m.ablauf_am) > new Date())),
  ).length;

  // Setup-Tasks (zeigen, was noch fehlt)
  const setupTasks: { id: string; label: string; href: string; done: boolean }[] = [
    { id: 'onboarding', label: 'Stammdaten vervollständigen', href: '/settings/restaurant', done: t.onboarding_abgeschlossen },
    { id: 'stripe',     label: 'Online-Zahlung aktivieren',    href: '/settings/payments',   done: t.stripe_connect_charges_enabled },
    { id: 'team',       label: 'Team einladen',                 href: '/employees',           done: (staffCount ?? 0) >= 2 },
  ];
  const openSetup = setupTasks.filter((x) => !x.done);

  return (
    <div className="space-y-8">
      {/* Hero / Begrüßung */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 md:px-10 pt-8 pb-10 text-white"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 60%, ${adjustColor(primary, -25)} 100%)` }}
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-25" style={{ backgroundColor: accent }} />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full blur-3xl opacity-15" style={{ backgroundColor: accent }} />

        <div className="relative">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center text-xl font-display font-bold shadow-lg"
              style={{ backgroundColor: accent, color: primary }}
            >
              {initial}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">Restaurant</div>
              <div className="font-display text-base font-bold">{t.name}</div>
            </div>
            <div className="ml-auto hidden md:flex items-center gap-2">
              <Link
                href={`/order/${t.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 px-3 py-1.5 text-xs hover:bg-white/20"
              >
                <Store size={12} /> Bestellseite <ArrowUpRight size={10} />
              </Link>
              <Link
                href="/modules"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 px-3 py-1.5 text-xs hover:bg-white/20"
              >
                <Grid size={12} /> Alle Module
              </Link>
            </div>
          </div>

          <div className="mt-10 max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              {greeting()} {firstName}.
            </h1>
            <p className="mt-3 text-lg text-white/80">
              {dateLine()} · {activeModulesCount} Modul{activeModulesCount === 1 ? '' : 'e'} aktiv.
            </p>
          </div>

          {/* KPI Row */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Umsatz heute"   value={euro(umsatzHeute)}          icon={<TrendingUp size={14} />} accent={accent} />
            <KPI label="Bestellungen"   value={ordersTodayCount ?? 0}      icon={<Store size={14} />}      accent={accent} />
            <KPI label="In der Küche"   value={kitchenCount ?? 0}          icon={<ChefHat size={14} />}    accent={accent} />
            <KPI label="Unterwegs"      value={deliveryCount ?? 0}         icon={<Bike size={14} />}       accent={accent} />
          </div>
        </div>
      </section>

      {/* Heute im Blick */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Linke Spalte: Was braucht Aufmerksamkeit */}
        <div className="lg:col-span-2 space-y-4">
          <SectionTitle title="Heute im Blick" subtitle="Was gerade Aufmerksamkeit braucht" />

          <div className="grid gap-3 sm:grid-cols-2">
            <AttentionCard
              icon={<Clock className="h-5 w-5" />}
              tone={openPickupCount && openPickupCount > 0 ? 'gold' : 'muted'}
              title="Abholung wartet"
              value={openPickupCount ?? 0}
              subtitle={openPickupCount ? 'fertige Bestellungen' : 'Alles ausgegeben'}
              href="/pos"
            />
            <AttentionCard
              icon={<ChefHat className="h-5 w-5" />}
              tone={kitchenCount && kitchenCount > 0 ? 'green' : 'muted'}
              title="In der Küche"
              value={kitchenCount ?? 0}
              subtitle={kitchenCount ? 'in Zubereitung' : 'Alles fertig'}
              href="/kitchen"
            />
            <AttentionCard
              icon={<Bike className="h-5 w-5" />}
              tone={deliveryCount && deliveryCount > 0 ? 'green' : 'muted'}
              title="Lieferung"
              value={deliveryCount ?? 0}
              subtitle={deliveryCount ? 'unterwegs / bereit' : 'Keine offenen Touren'}
              href="/dispatch"
            />
            <AttentionCard
              icon={<Bell className="h-5 w-5" />}
              tone={expiringTrials.length > 0 ? 'red' : 'muted'}
              title="Trials endend"
              value={expiringTrials.length}
              subtitle={expiringTrials.length > 0 ? `läuft in ≤ 7 Tagen ab` : 'Nichts läuft aus'}
              href="/modules"
            />
          </div>

          {/* Setup-Fortschritt */}
          {openSetup.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-matcha-700" />
                    <h3 className="font-display text-lg font-bold">Noch nicht fertig eingerichtet</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {setupTasks.length - openSetup.length} von {setupTasks.length} erledigt
                  </p>
                </div>
                <Link
                  href="/setup"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-matcha-900 text-matcha-50 px-3 py-1.5 text-xs font-bold hover:bg-matcha-800"
                >
                  Setup-Wizard <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="space-y-2">
                {openSetup.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={task.href}
                      className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm hover:bg-muted/60"
                    >
                      <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                      <span className="flex-1">{task.label}</span>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Trial-Hinweise */}
          {expiringTrials.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h3 className="font-display text-lg font-bold">Trial-Module laufen bald ab</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Du kannst sie behalten – buche jetzt weiter, um sie nicht zu verlieren.
              </p>
              <div className="flex flex-wrap gap-2">
                {expiringTrials.map((t) => (
                  <Link
                    key={t.module_id}
                    href="/modules"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold hover:bg-amber-200"
                  >
                    {t.module_id} · {t.days}d
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Schnellzugriffe */}
        <aside className="space-y-4">
          <SectionTitle title="Schnellzugriff" />

          <div className="space-y-2">
            <QuickLink href="/modules"             icon={<Grid />}          label="Alle Module"       sub="Zur Modul-Übersicht" primary />
            <QuickLink href={`/order/${t.slug}`}   icon={<Store />}          label="Bestellseite"     sub="Kunden-Shop öffnen"  external />
            <QuickLink href="/menu"                icon={<Utensils />}       label="Menü bearbeiten"  sub="Produkte & Preise" />
            <QuickLink href="/settings/restaurant" icon={<CreditCard />}     label="Einstellungen"    sub="Stammdaten · Zahlung" />
          </div>
        </aside>
      </section>
    </div>
  );
}

/* --- Kleine Helfer-Komponenten --- */

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function KPI({
  label, value, icon, accent,
}: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4 hover:bg-white/15 transition">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function AttentionCard({
  icon, tone, title, value, subtitle, href,
}: {
  icon: React.ReactNode;
  tone: 'green' | 'gold' | 'red' | 'muted';
  title: string;
  value: number;
  subtitle: string;
  href: string;
}) {
  const toneCls =
    tone === 'green' ? 'bg-matcha-50 border-matcha-200 text-matcha-900' :
    tone === 'gold'  ? 'bg-amber-50 border-amber-200 text-amber-900' :
    tone === 'red'   ? 'bg-red-50 border-red-200 text-red-900' :
                       'bg-card border-border';

  const iconCls =
    tone === 'green' ? 'bg-matcha-700 text-matcha-50' :
    tone === 'gold'  ? 'bg-amber-500 text-white' :
    tone === 'red'   ? 'bg-red-600 text-white' :
                       'bg-muted text-muted-foreground';

  return (
    <Link
      href={href}
      className={cn('group rounded-2xl border p-4 hover:shadow-soft transition block', toneCls)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', iconCls)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider opacity-70">{title}</div>
          <div className="font-display text-3xl font-bold leading-none mt-1">{value}</div>
          <div className="mt-1 text-xs opacity-80 truncate">{subtitle}</div>
        </div>
        <ArrowRight size={14} className="mt-1 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
      </div>
    </Link>
  );
}

function QuickLink({
  href, icon, label, sub, primary, external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  primary?: boolean;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-3 transition',
        primary
          ? 'bg-matcha-900 text-matcha-50 border-matcha-900 hover:bg-matcha-800'
          : 'bg-card hover:bg-muted/60',
      )}
    >
      <div className={cn(
        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
        primary ? 'bg-matcha-50/10' : 'bg-matcha-100 text-matcha-800',
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{label}</div>
        <div className={cn('text-xs truncate', primary ? 'text-matcha-100/80' : 'text-muted-foreground')}>
          {sub}
        </div>
      </div>
      {external
        ? <ArrowUpRight size={14} className={primary ? 'text-matcha-100' : 'text-muted-foreground'} />
        : <ArrowRight size={14} className={primary ? 'text-matcha-100' : 'text-muted-foreground'} />}
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Gute Nacht,';
  if (h < 11) return 'Guten Morgen,';
  if (h < 17) return 'Hallo,';
  if (h < 21) return 'Guten Abend,';
  return 'Gute Nacht,';
}

function dateLine(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function adjustColor(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
