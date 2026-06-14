'use client';

/**
 * EchtzeitPerformance — Live-Schicht-Performance für die aktuelle Stunde.
 *
 * Fragt Supabase jede 60s ab und zeigt:
 *  - Bestellungen in der letzten vollen Stunde (vs. Stunde davor)
 *  - Ø Zubereitungszeit heute
 *  - Pünktlichkeitsquote (fertig innerhalb ETA)
 *  - Aktive Fahrer + Touren
 *
 * Fokus: kompakte Karte für den AKTUELLEN Moment — nicht historisch.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Activity, ArrowUp, ArrowDown, Bike, CheckCircle2, Clock, Minus, Target, Truck,
} from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type PerfData = {
  currentHourOrders: number;
  prevHourOrders: number;
  activeDrivers: number;
  activeTours: number;
  avgPrepMin: number | null;
  onTimePct: number | null;
};

async function loadPerf(supabase: ReturnType<typeof createClient>): Promise<PerfData> {
  const now = new Date();
  const currentHourStart = new Date(now);
  currentHourStart.setMinutes(0, 0, 0);

  const prevHourStart = new Date(currentHourStart.getTime() - 3_600_000);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: currentHourData },
    { data: prevHourData },
    { data: activeDriverData },
    { data: batchData },
    { data: prepData },
  ] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id')
      .eq('location_id', LOCATION_ID)
      .gte('bestellt_am', currentHourStart.toISOString()),

    supabase
      .from('customer_orders')
      .select('id')
      .eq('location_id', LOCATION_ID)
      .gte('bestellt_am', prevHourStart.toISOString())
      .lt('bestellt_am', currentHourStart.toISOString()),

    supabase
      .from('driver_status')
      .select('employee_id, ist_online')
      .eq('ist_online', true),

    supabase
      .from('mise_delivery_batches')
      .select('id, state')
      .eq('location_id', LOCATION_ID)
      .in('state', ['on_route', 'at_restaurant', 'assigned', 'pending_acceptance']),

    supabase
      .from('customer_orders')
      .select('zubereitung_start, fertig_am, eta_earliest, eta_latest, geliefert_am')
      .eq('location_id', LOCATION_ID)
      .in('status', ['fertig', 'geliefert', 'abgeschlossen'])
      .gte('bestellt_am', todayStart.toISOString())
      .not('zubereitung_start', 'is', null)
      .not('fertig_am', 'is', null)
      .limit(50),
  ]);

  // Avg prep time
  const prepItems = (prepData ?? []) as {
    zubereitung_start: string | null;
    fertig_am: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    geliefert_am: string | null;
  }[];
  const prepMins = prepItems
    .filter(r => r.zubereitung_start && r.fertig_am)
    .map(r => (new Date(r.fertig_am!).getTime() - new Date(r.zubereitung_start!).getTime()) / 60_000);
  const avgPrepMin =
    prepMins.length > 0
      ? Math.round(prepMins.reduce((s, v) => s + v, 0) / prepMins.length)
      : null;

  // On-time %: delivered within eta_latest
  const deliveredWithEta = prepItems.filter(r => r.geliefert_am && r.eta_latest);
  const onTimeCount = deliveredWithEta.filter(
    r => new Date(r.geliefert_am!).getTime() <= new Date(r.eta_latest!).getTime(),
  ).length;
  const onTimePct =
    deliveredWithEta.length >= 3
      ? Math.round((onTimeCount / deliveredWithEta.length) * 100)
      : null;

  return {
    currentHourOrders: (currentHourData ?? []).length,
    prevHourOrders: (prevHourData ?? []).length,
    activeDrivers: (activeDriverData ?? []).length,
    activeTours: (batchData ?? []).length,
    avgPrepMin,
    onTimePct,
  };
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  if (d === 0) return <Minus className="h-3 w-3 text-stone-400 inline" />;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[9px] font-bold', d > 0 ? 'text-emerald-600' : 'text-red-500')}>
      {d > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(d)}
    </span>
  );
}

function KpiCell({
  icon: Icon,
  label,
  value,
  sub,
  quality,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  quality?: 'good' | 'warn' | 'bad' | null;
}) {
  const border =
    quality === 'good' ? 'border-emerald-100 bg-emerald-50' :
    quality === 'warn' ? 'border-amber-100 bg-amber-50' :
    quality === 'bad'  ? 'border-red-100 bg-red-50' :
    'border-stone-100 bg-white';
  const valColor =
    quality === 'good' ? 'text-emerald-700' :
    quality === 'warn' ? 'text-amber-700' :
    quality === 'bad'  ? 'text-red-700' :
    'text-stone-800';

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex-1 min-w-[100px]', border)}>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="h-3 w-3 text-stone-400 shrink-0" />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">{label}</span>
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', valColor)}>{value}</div>
      {sub && <div className="text-[9px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function EchtzeitPerformance() {
  const supabase = createClient();
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowLabel, setNowLabel] = useState('');

  const refresh = async () => {
    try {
      const d = await loadPerf(supabase);
      setData(d);
      setNowLabel(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 animate-pulse">
        <div className="h-3 w-40 bg-stone-100 rounded mb-3" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="flex-1 h-16 bg-stone-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const etaQuality =
    data.onTimePct == null ? null :
    data.onTimePct >= 85 ? 'good' :
    data.onTimePct >= 65 ? 'warn' :
    ('bad' as const);

  const prepQuality =
    data.avgPrepMin == null ? null :
    data.avgPrepMin <= 18 ? 'good' :
    data.avgPrepMin <= 25 ? 'warn' :
    ('bad' as const);

  const currentHour = new Date().getHours();
  const hourLabel = `${String(currentHour).padStart(2, '0')}:00`;
  const prevHourLabel = `${String((currentHour - 1 + 24) % 24).padStart(2, '0')}:00`;

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-stone-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
            Echtzeit-Performance · {hourLabel}
          </span>
        </div>
        <span className="text-[9px] text-stone-400">aktualisiert {nowLabel}</span>
      </div>

      {/* KPI Grid */}
      <div className="flex flex-wrap gap-2">
        {/* Current hour orders */}
        <KpiCell
          icon={Target}
          label={`Bestell. ${hourLabel}`}
          value={data.currentHourOrders}
          quality={
            data.currentHourOrders > data.prevHourOrders ? 'good' :
            data.currentHourOrders === data.prevHourOrders ? null :
            'warn'
          }
          sub={
            <>
              vs {prevHourLabel}: {data.prevHourOrders}{' '}
              <Delta now={data.currentHourOrders} prev={data.prevHourOrders} />
            </>
          }
        />

        {/* Active drivers */}
        <KpiCell
          icon={Bike}
          label="Fahrer aktiv"
          value={data.activeDrivers}
          quality={data.activeDrivers >= 3 ? 'good' : data.activeDrivers >= 1 ? null : 'warn'}
          sub={`${data.activeTours} Tour${data.activeTours !== 1 ? 'en' : ''} läuft`}
        />

        {/* Avg prep time */}
        {data.avgPrepMin != null && (
          <KpiCell
            icon={Clock}
            label="Ø Zubereitung"
            value={`${data.avgPrepMin} Min`}
            quality={prepQuality}
            sub="heute"
          />
        )}

        {/* On-time % */}
        {data.onTimePct != null && (
          <KpiCell
            icon={CheckCircle2}
            label="Pünktlichkeit"
            value={`${data.onTimePct}%`}
            quality={etaQuality}
            sub="innerhalb ETA"
          />
        )}
      </div>

      {/* Quick context */}
      {data.activeTours > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-[10px] text-blue-700 font-semibold">
          <Truck className="h-3 w-3 shrink-0" />
          {data.activeTours} Tour{data.activeTours !== 1 ? 'en' : ''} gerade aktiv ·{' '}
          {data.activeDrivers} Fahrer online
        </div>
      )}
    </div>
  );
}
