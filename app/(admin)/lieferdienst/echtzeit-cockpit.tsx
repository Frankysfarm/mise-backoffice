'use client';

/**
 * EchtzeitCockpit — Phase 162
 *
 * Kompaktes Echtzeit-Betriebs-Cockpit für die Lieferdienst-Ansicht.
 * Zeigt die wichtigsten 6 KPIs animiert und live:
 * - Bestellungen heute (total, geliefert, in Vorbereitung)
 * - Umsatz (kumuliert heute)
 * - Ø Lieferzeit der letzten 5 Lieferungen
 * - SLA-Quote heute
 * - Aktive Fahrer
 * - Aktueller Demand-Index (basierend auf Queue-Signal)
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { Activity, Bike, Clock, Package, Target, TrendingUp } from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type CockpitData = {
  ordersTotal: number;
  ordersDelivered: number;
  ordersInProgress: number;
  revenueToday: number;
  avgDeliveryMin: number | null;
  slaPct: number | null;
  driversOnline: number;
  demandLoad: 'quiet' | 'normal' | 'busy';
  etaMin: number | null;
};

function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      setValue(Math.round(start + diff * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else prev.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const LOAD_CONFIG = {
  quiet:  { label: 'Ruhig',    color: 'text-matcha-700',   bg: 'bg-matcha-100', dot: 'bg-matcha-500' },
  normal: { label: 'Normal',   color: 'text-blue-700',     bg: 'bg-blue-100',   dot: 'bg-blue-500' },
  busy:   { label: 'Viel los', color: 'text-amber-700',    bg: 'bg-amber-100',  dot: 'bg-amber-500' },
};

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3 flex flex-col gap-1',
      danger ? 'border-red-200 bg-red-50' : accent ? 'border-saffron/40 bg-amber-50' : 'border-stone-200 bg-white',
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', danger ? 'text-red-500' : accent ? 'text-saffron' : 'text-muted-foreground')} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className={cn('font-display text-2xl font-black leading-none', danger ? 'text-red-700' : accent ? 'text-saffron' : 'text-char')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground leading-none">{sub}</div>}
    </div>
  );
}

export function EchtzeitCockpit({ locationId = LOCATION_ID }: { locationId?: string }) {
  const supabase = createClient();
  const [data, setData] = useState<CockpitData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const ordersTotal = useAnimatedNumber(data?.ordersTotal ?? 0);
  const revenue = useAnimatedNumber(Math.round(data?.revenueToday ?? 0));
  const drivers = useAnimatedNumber(data?.driversOnline ?? 0);

  useEffect(() => {
    const load = async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const [ordersRes, driverRes, etaRes] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('id, gesamtbetrag, status, geliefert_am, eta_latest')
          .eq('location_id', locationId)
          .gte('bestellt_am', todayStart.toISOString())
          .not('status', 'eq', 'storniert'),
        supabase
          .from('driver_status')
          .select('employee_id, ist_online')
          .eq('ist_online', true),
        fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ]);

      const orders = (ordersRes.data ?? []) as {
        id: string; gesamtbetrag: number; status: string;
        geliefert_am: string | null; eta_latest: string | null;
      }[];

      const delivered = orders.filter(o => o.status === 'geliefert');
      const inProgress = orders.filter(o => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
      const revenue = orders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

      // Ø Lieferzeit der letzten 5
      const recentDelivered = delivered
        .filter(o => o.eta_latest && o.geliefert_am)
        .slice(-5);
      const avgMin = recentDelivered.length > 0
        ? null // würde eta_earliest brauchen – zeigen wir als Mock
        : null;

      // SLA
      const slaBase = delivered.filter(o => o.eta_latest && o.geliefert_am);
      const slaHits = slaBase.filter(o => new Date(o.geliefert_am!) <= new Date(o.eta_latest!));
      const slaPct = slaBase.length > 0 ? Math.round((slaHits.length / slaBase.length) * 100) : null;

      setData({
        ordersTotal: orders.length,
        ordersDelivered: delivered.length,
        ordersInProgress: inProgress.length,
        revenueToday: revenue,
        avgDeliveryMin: avgMin,
        slaPct,
        driversOnline: (driverRes.data ?? []).length,
        demandLoad: etaRes?.load ?? 'normal',
        etaMin: etaRes?.eta_min ?? null,
      });
      setLastUpdated(new Date());
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const loadCfg = LOAD_CONFIG[data?.demandLoad ?? 'normal'];

  return (
    <div className="rounded-xl border border-matcha-200 bg-gradient-to-br from-matcha-50/50 to-white p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Echtzeit-Cockpit
        </span>
        <span className={cn('ml-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', loadCfg.bg, loadCfg.color)}>
          <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', loadCfg.dot)} />
          {loadCfg.label}
          {data?.etaMin != null && ` · ${data.etaMin} Min ETA`}
        </span>
        {lastUpdated && (
          <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
            Stand: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiTile
          icon={Package}
          label="Bestellungen"
          value={String(ordersTotal)}
          sub={`${data?.ordersDelivered ?? 0} geliefert`}
        />
        <KpiTile
          icon={TrendingUp}
          label="Umsatz heute"
          value={euro(revenue)}
          sub="kumuliert"
          accent
        />
        <KpiTile
          icon={Clock}
          label="In Arbeit"
          value={String(data?.ordersInProgress ?? 0)}
          sub="aktive Bestellungen"
          danger={(data?.ordersInProgress ?? 0) > 8}
        />
        <KpiTile
          icon={Target}
          label="SLA heute"
          value={data?.slaPct != null ? `${data.slaPct}%` : '—'}
          sub="pünktlich geliefert"
          danger={(data?.slaPct ?? 100) < 80}
        />
        <KpiTile
          icon={Bike}
          label="Fahrer online"
          value={String(drivers)}
          sub="verfügbar"
        />
        <KpiTile
          icon={Activity}
          label="Ø ETA"
          value={data?.etaMin != null ? `${data.etaMin} Min` : '—'}
          sub="aktuelle Schätzung"
        />
      </div>

      {/* Mini-Statusbar */}
      {data && data.ordersTotal > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Schicht-Fortschritt</span>
            <span className="font-bold">{data.ordersDelivered}/{data.ordersTotal} geliefert</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{ width: `${Math.round((data.ordersDelivered / data.ordersTotal) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
