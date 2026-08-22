import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Bike, MapPin, Plug, Banknote, Users, ArrowRight, Clock, TrendingUp,
} from 'lucide-react';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/utils';
// import { SeedTestButton } from './seed-test-button'; // deaktiviert in Produktion

export const dynamic = 'force-dynamic';

export default async function DeliveryOverviewPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: tenant },
    { count: driversCount },
    { count: activeDriversCount },
    { count: openDeliveries },
    { data: salesToday },
    { data: platformConfigs },
    { count: waitlistCount },
  ] = await Promise.all([
    svc.from('tenants').select('liefergebuehr,mindestbestellwert,lieferradius_km').eq('id', emp.tenant_id).single(),
    svc.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id).eq('rolle', 'fahrer'),
    svc.from('driver_status').select('driver_id', { count: 'exact', head: true }).eq('online', true),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id).in('status', ['bereit_zur_lieferung', 'unterwegs']),
    svc.from('customer_orders').select('gesamtbetrag').eq('tenant_id', emp.tenant_id).eq('bestellart', 'lieferung').gte('bestellt_am', today),
    svc.from('tenant_platform_configs').select('source,aktiv').eq('tenant_id', emp.tenant_id),
    svc.from('platform_waitlist').select('source', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id),
  ]);

  const umsatzLieferung = (salesToday as { gesamtbetrag: number | null }[] | null ?? [])
    .reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);

  const activePlatforms = (platformConfigs as { source: string; aktiv: boolean }[] ?? []).filter((p) => p.aktiv).length;

  return (
    <>
      <PageHeader
        title="Lieferdienst"
        description="Fahrer, Touren, Konditionen und externe Plattformen an einem Ort."
      />

      {/* Test-Orders-Button — deaktiviert (Produktion). Falls dev-only, in Env-Check verpacken.
      <div className="mb-6">
        <SeedTestButton />
      </div>
      */}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KPI icon={<TrendingUp size={14} />} label="Umsatz Lieferung heute" value={euro(umsatzLieferung)} />
        <KPI icon={<Clock size={14} />}      label="Offene Touren"          value={openDeliveries ?? 0} />
        <KPI icon={<Bike size={14} />}       label="Fahrer online"          value={`${activeDriversCount ?? 0}/${driversCount ?? 0}`} />
        <KPI icon={<Plug size={14} />}       label="Plattformen aktiv"      value={activePlatforms} />
      </div>

      {/* Sektionen */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          href="/drivers"
          icon={<Users className="h-5 w-5" />}
          title="Fahrer"
          subtitle={`${driversCount ?? 0} Fahrer · ${activeDriversCount ?? 0} gerade online`}
          cta="Fahrer verwalten"
        />
        <SectionCard
          href="/dispatch"
          icon={<MapPin className="h-5 w-5" />}
          title="Touren & Dispatch"
          subtitle={`${openDeliveries ?? 0} Lieferungen offen · Live-Karte`}
          cta="Touren öffnen"
          highlight={Boolean(openDeliveries && openDeliveries > 0)}
        />
        <SectionCard
          href="/delivery/platforms"
          icon={<Plug className="h-5 w-5" />}
          title="Externe Lieferdienste"
          subtitle={
            activePlatforms > 0
              ? `${activePlatforms} aktiv · Deliverect, Lieferando, Uber, Wolt`
              : `Noch keine verbunden${waitlistCount ? ` · ${waitlistCount} auf Warteliste` : ''}`
          }
          cta={activePlatforms > 0 ? 'Verwalten' : 'Verbinden'}
        />
        <SectionCard
          href="/delivery/zone"
          icon={<MapPin className="h-5 w-5" />}
          title="Liefergebiet"
          subtitle={tenant?.lieferradius_km ? `Radius ${tenant.lieferradius_km} km` : 'Noch nicht definiert'}
          cta="Radius & Zonen"
        />
        <SectionCard
          href="/delivery/conditions"
          icon={<Banknote className="h-5 w-5" />}
          title="Konditionen"
          subtitle={`Liefergebühr ${tenant?.liefergebuehr ? euro(tenant.liefergebuehr) : '—'} · Mindest ${tenant?.mindestbestellwert ? euro(tenant.mindestbestellwert) : '—'}`}
          cta="Preise & Limits"
        />
      </div>
    </>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
    </Card>
  );
}

function SectionCard({
  href, icon, title, subtitle, cta, highlight,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border bg-card p-5 hover:shadow-soft hover:-translate-y-0.5 transition block ${
        highlight ? 'border-matcha-500/50 bg-matcha-50/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-bold">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 group-hover:translate-x-0.5 transition" />
      </div>
      <div className="mt-3 text-xs font-bold text-matcha-800 flex items-center gap-1">
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
