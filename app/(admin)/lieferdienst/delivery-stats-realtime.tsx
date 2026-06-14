'use client';

/**
 * DeliveryStatsRealtime — Echtzeit-Lieferstatistiken aus Supabase.
 * Zeigt: Heute gelieferte Bestellungen, Touren, Ø-ETA, Dispatch-Score.
 * Lädt alle 60s neu + bei Realtime-Änderungen.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  MapPin,
  Route,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

type Stats = {
  deliveredToday: number;
  toursToday: number;
  avgEtaMin: number | null;
  avgScore: number | null;
  onTimePct: number | null;
  zoneBreakdown: { zone: string; count: number }[];
  // comparison
  deliveredYesterday: number | null;
};

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadStats(supabase: ReturnType<typeof createClient>): Promise<Stats> {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();

  const yesterdayStart = startOfDay(new Date(now.getTime() - 86_400_000)).toISOString();
  const yesterdayEnd = startOfDay(now).toISOString();

  const [
    { data: ordersToday },
    { data: ordersYesterday },
    { data: toursToday },
    { data: scores },
  ] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id, status, delivery_zone, eta_earliest, eta_latest, geliefert_am')
      .eq('location_id', LOCATION_ID)
      .eq('typ', 'lieferung')
      .gte('bestellt_am', todayStart),

    supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', LOCATION_ID)
      .eq('typ', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen'])
      .gte('bestellt_am', yesterdayStart)
      .lt('bestellt_am', yesterdayEnd),

    supabase
      .from('mise_delivery_batches')
      .select('id, total_eta_min, state')
      .eq('location_id', LOCATION_ID)
      .gte('created_at', todayStart)
      .not('state', 'eq', 'cancelled'),

    supabase
      .from('dispatch_scores')
      .select('total_score')
      .eq('location_id', LOCATION_ID)
      .gte('created_at', todayStart),
  ]);

  const delivered = (ordersToday ?? []).filter(
    (o: { status: string }) => o.status === 'geliefert' || o.status === 'abgeschlossen',
  );

  // Zone breakdown
  const zoneMap: Record<string, number> = {};
  for (const o of ordersToday ?? []) {
    const z = (o as { delivery_zone: string | null }).delivery_zone ?? 'Unbekannt';
    zoneMap[z] = (zoneMap[z] ?? 0) + 1;
  }
  const zoneBreakdown = Object.entries(zoneMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([zone, count]) => ({ zone, count }));

  // Avg ETA
  const etaMinutes = (toursToday ?? [])
    .map((t: { total_eta_min: number | null }) => t.total_eta_min)
    .filter((v): v is number => v != null);
  const avgEtaMin =
    etaMinutes.length > 0
      ? Math.round(etaMinutes.reduce((s, v) => s + v, 0) / etaMinutes.length)
      : null;

  // Avg dispatch score
  const scoreVals = (scores ?? [])
    .map((s: { total_score: number }) => s.total_score)
    .filter((v): v is number => v != null);
  const avgScore =
    scoreVals.length > 0
      ? Math.round(scoreVals.reduce((s, v) => s + v, 0) / scoreVals.length)
      : null;

  // On-time %: delivered orders where geliefert_am <= eta_latest
  const onTimeDeliveries = delivered.filter((o: Record<string, unknown>) => {
    if (!o.geliefert_am || !o.eta_latest) return false;
    return new Date(o.geliefert_am as string).getTime() <= new Date(o.eta_latest as string).getTime();
  });
  const onTimePct =
    delivered.length >= 3
      ? Math.round((onTimeDeliveries.length / delivered.length) * 100)
      : null;

  return {
    deliveredToday: delivered.length,
    toursToday: (toursToday ?? []).length,
    avgEtaMin,
    avgScore,
    onTimePct,
    zoneBreakdown,
    deliveredYesterday: (ordersYesterday as unknown as { count: number } | null)?.count ?? null,
  };
}

function Trend({ now, prev }: { now: number; prev: number | null }) {
  if (prev == null) return null;
  const delta = now - prev;
  if (delta === 0) return <span className="text-stone-400 text-[10px]">= Gestern</span>;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[10px] font-bold',
        delta > 0 ? 'text-matcha-600' : 'text-red-500',
      )}
    >
      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta > 0 ? '+' : ''}{delta} vs. gestern
    </span>
  );
}

function KpiCard({
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
  quality?: 'good' | 'warn' | 'bad' | null;
  children?: React.ReactNode;
}) {
  const border =
    quality === 'good'
      ? 'border-matcha-200 bg-matcha-50'
      : quality === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : quality === 'bad'
      ? 'border-red-200 bg-red-50'
      : 'border-stone-200 bg-white';
  const valueColor =
    quality === 'good'
      ? 'text-matcha-700'
      : quality === 'warn'
      ? 'text-amber-700'
      : quality === 'bad'
      ? 'text-red-700'
      : 'text-stone-800';
  const iconColor =
    quality === 'good'
      ? 'text-matcha-500'
      : quality === 'warn'
      ? 'text-amber-500'
      : quality === 'bad'
      ? 'text-red-500'
      : 'text-stone-400';

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex-1 min-w-[120px]', border)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">
          {label}
        </span>
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', valueColor)}>{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-0.5 leading-snug">{sub}</div>}
      {children}
    </div>
  );
}

export function DeliveryStatsRealtime() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await loadStats(supabase);
      setStats(data);
    } catch {
      // graceful
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);

    const ch = supabase
      .channel('delivery-stats-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, () => refresh())
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 animate-pulse">
        <div className="h-3 w-32 bg-stone-100 rounded mb-3" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-stone-50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const etaQuality =
    stats.avgEtaMin == null
      ? null
      : stats.avgEtaMin <= 25
      ? 'good'
      : stats.avgEtaMin <= 35
      ? 'warn'
      : ('bad' as const);

  const onTimeQuality =
    stats.onTimePct == null
      ? null
      : stats.onTimePct >= 80
      ? 'good'
      : stats.onTimePct >= 60
      ? 'warn'
      : ('bad' as const);

  const scoreQuality =
    stats.avgScore == null
      ? null
      : stats.avgScore >= 75
      ? 'good'
      : stats.avgScore >= 55
      ? 'warn'
      : ('bad' as const);

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-stone-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
            Liefer-Performance heute
          </span>
        </div>
        <span className="text-[10px] text-stone-400">Echtzeit</span>
      </div>

      {/* KPI Grid */}
      <div className="flex flex-wrap gap-2">
        <KpiCard
          icon={CheckCircle2}
          label="Geliefert"
          value={stats.deliveredToday}
          quality={stats.deliveredToday > 0 ? 'good' : null}
        >
          <Trend now={stats.deliveredToday} prev={stats.deliveredYesterday} />
        </KpiCard>

        <KpiCard
          icon={Route}
          label="Touren"
          value={stats.toursToday}
          sub="heute gestartet"
        />

        <KpiCard
          icon={Clock}
          label="Ø ETA"
          value={stats.avgEtaMin != null ? `${stats.avgEtaMin} Min` : '—'}
          sub="Lieferzeit"
          quality={etaQuality}
        />

        {stats.onTimePct !== null && (
          <KpiCard
            icon={Truck}
            label="Pünktlichkeit"
            value={`${stats.onTimePct}%`}
            quality={onTimeQuality}
            sub="pünktliche Lieferungen"
          />
        )}

        {stats.avgScore !== null && (
          <KpiCard
            icon={Award}
            label="Dispatch-Score"
            value={stats.avgScore}
            quality={scoreQuality}
            sub="Ø über alle Touren"
          />
        )}
      </div>

      {/* Zone breakdown */}
      {stats.zoneBreakdown.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">
              Zonen heute
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.zoneBreakdown.map(({ zone, count }) => (
              <span
                key={zone}
                className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-2.5 py-1 text-[10px] font-bold text-stone-700"
              >
                {zone}
                <span className="text-stone-500 font-medium">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* If surge is active, show Zap indicator */}
      {stats.avgEtaMin != null && stats.avgEtaMin > 40 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700 font-bold">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          Hohe Lieferzeiten — Kapazität prüfen
        </div>
      )}
    </div>
  );
}
