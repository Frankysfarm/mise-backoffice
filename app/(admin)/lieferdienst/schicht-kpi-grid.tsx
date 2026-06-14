'use client';

/**
 * SchichtKpiGrid — Kompakte KPI-Kacheln für die aktuelle Schicht.
 *
 * Zeigt auf einem Blick:
 * - Gesamtbestellungen / Lieferungen / Abholungen
 * - Durchschnittliche Lieferzeit
 * - Pünktlichkeitsquote
 * - Umsatz heute
 * - Aktive Fahrer
 * - Dispatch-Score Ø
 *
 * Pollt /api/delivery/admin/overview alle 60s und via Supabase Realtime.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Award,
  Bike,
  CheckCircle2,
  Clock,
  Euro,
  Package,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

type OverviewData = {
  ordersToday: number;
  deliveredToday: number;
  pickupToday: number;
  revenueToday: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  activeDrivers: number;
  avgDispatchScore: number | null;
  ordersYesterday: number | null;
  revenueYesterday: number | null;
};

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function loadOverview(supabase: ReturnType<typeof createClient>): Promise<OverviewData> {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const yestStart = startOfDay(new Date(now.getTime() - 86_400_000)).toISOString();
  const yestEnd = todayStart;

  const [
    { data: ordersToday },
    { data: ordersYesterday },
    { data: activeDrivers },
    { data: scores },
  ] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id, typ, status, gesamtbetrag, geliefert_am, eta_latest, geschaetzte_lieferung_min, fertig_am, bestellt_am')
      .eq('location_id', LOCATION_ID)
      .gte('bestellt_am', todayStart),

    supabase
      .from('customer_orders')
      .select('id, gesamtbetrag')
      .eq('location_id', LOCATION_ID)
      .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
      .gte('bestellt_am', yestStart)
      .lt('bestellt_am', yestEnd),

    supabase
      .from('driver_status')
      .select('employee_id')
      .eq('ist_online', true),

    supabase
      .from('dispatch_scores')
      .select('total_score')
      .eq('location_id', LOCATION_ID)
      .gte('created_at', todayStart),
  ]);

  const rows = (ordersToday ?? []) as any[];

  const delivered = rows.filter(o => o.typ === 'lieferung' && (o.status === 'geliefert' || o.status === 'abgeschlossen'));
  const pickups   = rows.filter(o => o.typ === 'abholung'  && (o.status === 'abgeholt'  || o.status === 'abgeschlossen'));

  const revenue = rows
    .filter(o => o.status === 'geliefert' || o.status === 'abgeholt' || o.status === 'abgeschlossen')
    .reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

  const revenueYest = ((ordersYesterday ?? []) as any[])
    .reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

  // Avg delivery time: bestellt_am → geliefert_am in minutes
  const deliveryTimes = delivered
    .filter((o: any) => o.bestellt_am && o.geliefert_am)
    .map((o: any) => (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000);
  const avgDeliveryMin = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((s: number, v: number) => s + v, 0) / deliveryTimes.length)
    : null;

  // On-time %
  const onTimeDeliveries = delivered.filter((o: any) =>
    o.geliefert_am && o.eta_latest &&
    new Date(o.geliefert_am).getTime() <= new Date(o.eta_latest).getTime()
  );
  const onTimePct = delivered.length >= 3
    ? Math.round((onTimeDeliveries.length / delivered.length) * 100)
    : null;

  // Dispatch score avg
  const scoreVals = ((scores ?? []) as any[]).map((s: any) => s.total_score).filter((v: any) => v != null);
  const avgDispatchScore = scoreVals.length > 0
    ? Math.round(scoreVals.reduce((a: number, b: number) => a + b, 0) / scoreVals.length)
    : null;

  return {
    ordersToday: rows.length,
    deliveredToday: delivered.length,
    pickupToday: pickups.length,
    revenueToday: revenue,
    avgDeliveryMin,
    onTimePct,
    activeDrivers: (activeDrivers ?? []).length,
    avgDispatchScore,
    ordersYesterday: (ordersYesterday ?? []).length,
    revenueYesterday: revenueYest > 0 ? revenueYest : null,
  };
}

function Delta({ now, prev, unit = '' }: { now: number; prev: number | null; unit?: string }) {
  if (prev == null) return null;
  const delta = now - prev;
  if (delta === 0) return <span className="text-[9px] text-stone-400">= gestern</span>;
  return (
    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', delta > 0 ? 'text-matcha-500' : 'text-red-400')}>
      {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {delta > 0 ? '+' : ''}{unit === 'eur' ? delta.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : delta} vs gestern
    </span>
  );
}

type QualityLevel = 'good' | 'ok' | 'warn' | 'bad' | null;

function qualityColors(q: QualityLevel) {
  switch (q) {
    case 'good': return { border: 'border-matcha-200', bg: 'bg-matcha-50',   value: 'text-matcha-700', icon: 'text-matcha-500' };
    case 'ok':   return { border: 'border-blue-200',   bg: 'bg-blue-50',     value: 'text-blue-700',   icon: 'text-blue-400'   };
    case 'warn': return { border: 'border-amber-200',  bg: 'bg-amber-50',    value: 'text-amber-700',  icon: 'text-amber-500'  };
    case 'bad':  return { border: 'border-red-200',    bg: 'bg-red-50',      value: 'text-red-700',    icon: 'text-red-400'    };
    default:     return { border: 'border-stone-200',  bg: 'bg-white',       value: 'text-stone-800',  icon: 'text-stone-400'  };
  }
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  quality,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  quality?: QualityLevel;
  children?: React.ReactNode;
}) {
  const c = qualityColors(quality ?? null);
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 min-w-[110px]', c.border, c.bg)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.icon)} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">{label}</span>
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', c.value)}>{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-0.5">{sub}</div>}
      {children}
    </div>
  );
}

export function SchichtKpiGrid() {
  const supabase = createClient();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const d = await loadOverview(supabase);
      setData(d);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);

    const ch = supabase
      .channel('schicht-kpi-grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' }, () => refresh())
      .subscribe();

    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-100 bg-white p-3 animate-pulse">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-stone-50 rounded-xl min-w-[90px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const etaQ: QualityLevel =
    data.avgDeliveryMin == null ? null :
    data.avgDeliveryMin <= 25 ? 'good' :
    data.avgDeliveryMin <= 35 ? 'ok' :
    data.avgDeliveryMin <= 45 ? 'warn' : 'bad';

  const onTimeQ: QualityLevel =
    data.onTimePct == null ? null :
    data.onTimePct >= 85 ? 'good' :
    data.onTimePct >= 70 ? 'ok' :
    data.onTimePct >= 55 ? 'warn' : 'bad';

  const scoreQ: QualityLevel =
    data.avgDispatchScore == null ? null :
    data.avgDispatchScore >= 80 ? 'good' :
    data.avgDispatchScore >= 65 ? 'ok' :
    data.avgDispatchScore >= 50 ? 'warn' : 'bad';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
          Schicht-KPIs heute
        </span>
        <span className="flex items-center gap-1 text-[9px] text-stone-300">
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 animate-pulse inline-block" />
          live
        </span>
      </div>

      {/* KPI tiles */}
      <div className="flex flex-wrap gap-2">
        <Tile
          icon={Package}
          label="Bestellungen"
          value={data.ordersToday}
          sub="heute gesamt"
        >
          <Delta now={data.ordersToday} prev={data.ordersYesterday} />
        </Tile>

        <Tile
          icon={Truck}
          label="Geliefert"
          value={data.deliveredToday}
          quality={data.deliveredToday > 0 ? 'good' : null}
          sub="Lieferungen fertig"
        />

        <Tile
          icon={ShoppingBag}
          label="Abgeholt"
          value={data.pickupToday}
          sub="Abholungen fertig"
        />

        <Tile
          icon={Euro}
          label="Umsatz"
          value={data.revenueToday.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          quality={data.revenueToday > 0 ? 'good' : null}
        >
          {data.revenueYesterday != null && (
            <Delta now={data.revenueToday} prev={data.revenueYesterday} unit="eur" />
          )}
        </Tile>

        {data.avgDeliveryMin != null && (
          <Tile
            icon={Clock}
            label="Ø Lieferzeit"
            value={`${data.avgDeliveryMin} Min`}
            quality={etaQ}
            sub="Bestellung → Tür"
          />
        )}

        {data.onTimePct != null && (
          <Tile
            icon={Target}
            label="Pünktlichkeit"
            value={`${data.onTimePct}%`}
            quality={onTimeQ}
            sub="pünktliche Lieferungen"
          />
        )}

        <Tile
          icon={Bike}
          label="Fahrer online"
          value={data.activeDrivers}
          quality={data.activeDrivers === 0 ? 'bad' : data.activeDrivers >= 2 ? 'good' : 'warn'}
          sub="gerade aktiv"
        />

        {data.avgDispatchScore != null && (
          <Tile
            icon={Award}
            label="Dispatch-Score"
            value={data.avgDispatchScore}
            quality={scoreQ}
            sub="Ø über alle Touren"
          />
        )}
      </div>

      {/* Alerts */}
      {data.activeDrivers === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px] text-red-700 font-bold">
          <Zap className="h-3.5 w-3.5 text-red-500 shrink-0" />
          Kein Fahrer online — Bestellungen können nicht ausgeliefert werden!
        </div>
      )}
      {data.avgDeliveryMin != null && data.avgDeliveryMin > 45 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700 font-bold">
          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          Lange Lieferzeiten ({data.avgDeliveryMin} Min Ø) — Kapazität prüfen
        </div>
      )}
      {data.onTimePct != null && data.onTimePct < 55 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px] text-red-700 font-bold">
          <CheckCircle2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
          Pünktlichkeit kritisch ({data.onTimePct}%) — Zeitplan anpassen
        </div>
      )}
    </div>
  );
}
