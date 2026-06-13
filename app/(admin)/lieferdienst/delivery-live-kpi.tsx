'use client';

/**
 * DeliveryLiveKpiPanel — Echtzeit-Lieferungs-KPIs aus dem Delivery-System.
 * Ruft echte Daten aus /api/delivery/admin/overview + /api/delivery/admin/eta-accuracy ab.
 * Zeigt: Heute geliefert, SLA-Quote, Ø Lieferzeit, Fahrer-Auslastung, Zone-Verteilung.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, Bike, CheckCircle2, Clock, MapPin, Target, TrendingUp, Truck, Users, Zap,
} from 'lucide-react';

interface OverviewData {
  today_stats: {
    total_orders: number;
    dispatched: number;
    delivered: number;
    pending: number;
    drivers_online: number;
  };
  zone_counts: Record<string, number>;
}

interface EtaAccuracyData {
  overall: {
    totalStops: number;
    onTimeRate: number | null;
    avgDeviationMin: number | null;
    avgDeliveryMin: number | null;
  };
  byZone: Record<string, {
    totalStops: number;
    onTimeRate: number | null;
    avgDeliveryMin: number | null;
  }>;
}

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-matcha-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-red-500',
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: 'good' | 'warn' | 'bad' | null;
  colorClass?: string;
}) {
  const highlightBorder = highlight === 'good' ? 'border-matcha-200 bg-matcha-50'
    : highlight === 'warn' ? 'border-amber-200 bg-amber-50'
    : highlight === 'bad' ? 'border-red-200 bg-red-50'
    : 'border-stone-200 bg-white';
  const valueColor = highlight === 'good' ? 'text-matcha-700'
    : highlight === 'warn' ? 'text-amber-700'
    : highlight === 'bad' ? 'text-red-700'
    : colorClass ?? 'text-stone-800';
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex-1 min-w-[120px]', highlightBorder)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', highlight === 'good' ? 'text-matcha-500' : highlight === 'warn' ? 'text-amber-500' : highlight === 'bad' ? 'text-red-500' : 'text-stone-400')} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">{label}</span>
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', valueColor)}>{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

export function DeliveryLiveKpiPanel() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [etaAcc, setEtaAcc] = useState<EtaAccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [ovRes, etaRes] = await Promise.all([
          fetch(`/api/delivery/admin/overview?location_id=${LOCATION_ID}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/delivery/admin/eta-accuracy?location_id=${LOCATION_ID}&days=1`).then(r => r.ok ? r.json() : null),
        ]);
        if (!cancelled) {
          if (ovRes) setOverview(ovRes);
          if (etaRes) setEtaAcc(etaRes);
          setLastUpdate(new Date());
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading && !overview) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 animate-pulse">
        <div className="h-3 w-40 rounded bg-stone-100 mb-3" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-16 rounded-xl bg-stone-100" />
          ))}
        </div>
      </div>
    );
  }

  const stats = overview?.today_stats;
  const eta = etaAcc?.overall;
  const zoneCounts = overview?.zone_counts ?? {};
  const totalZoneOrders = Object.values(zoneCounts).reduce((a, b) => a + b, 0);

  const slaOnTimePct = eta?.onTimeRate != null ? Math.round(eta.onTimeRate * 100) : null;
  const avgDelivMin = eta?.avgDeliveryMin != null ? Math.round(eta.avgDeliveryMin) : null;
  const utilPct = (stats?.drivers_online && stats.drivers_online > 0 && stats.dispatched > 0)
    ? Math.min(100, Math.round((stats.dispatched / stats.drivers_online) * 33))
    : null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-matcha-100 flex items-center justify-center">
            <Activity className="h-3.5 w-3.5 text-matcha-600" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">
            Live-Lieferungs-KPIs · Heute
          </span>
        </div>
        {lastUpdate && (
          <span className="text-[9px] text-stone-400 tabular-nums">
            Stand {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI Karten */}
      <div className="flex flex-wrap gap-2">
        {stats && (
          <>
            <KpiCard
              icon={CheckCircle2}
              label="Geliefert"
              value={stats.delivered}
              sub={`von ${stats.total_orders} Bestellungen`}
              highlight={stats.delivered > 0 ? 'good' : null}
            />
            <KpiCard
              icon={Truck}
              label="Unterwegs"
              value={stats.dispatched}
              sub="aktive Touren"
              highlight={stats.dispatched > 0 ? null : null}
            />
            <KpiCard
              icon={Bike}
              label="Fahrer Online"
              value={stats.drivers_online}
              sub="verfügbar"
              highlight={stats.drivers_online >= 2 ? 'good' : stats.drivers_online === 1 ? 'warn' : 'bad'}
            />
          </>
        )}
        {slaOnTimePct != null && (
          <KpiCard
            icon={Target}
            label="SLA On-Time"
            value={`${slaOnTimePct}%`}
            sub="pünktliche Lieferungen"
            highlight={slaOnTimePct >= 80 ? 'good' : slaOnTimePct >= 60 ? 'warn' : 'bad'}
          />
        )}
        {avgDelivMin != null && (
          <KpiCard
            icon={Clock}
            label="Ø Lieferzeit"
            value={`${avgDelivMin} Min`}
            sub="tatsächliche Dauer"
            highlight={avgDelivMin <= 30 ? 'good' : avgDelivMin <= 45 ? 'warn' : 'bad'}
          />
        )}
      </div>

      {/* Zonen-Verteilung */}
      {totalZoneOrders > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400">Zonen-Verteilung heute</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(zoneCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([zone, count]) => {
                const pct = Math.round((count / totalZoneOrders) * 100);
                const zoneEta = etaAcc?.byZone?.[zone];
                const zoneOnTime = zoneEta?.onTimeRate != null ? Math.round(zoneEta.onTimeRate * 100) : null;
                return (
                  <div key={zone} className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2 py-1">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', ZONE_COLORS[zone] ?? 'bg-stone-400')} />
                    <span className="text-[10px] font-bold text-stone-700">Zone {zone}</span>
                    <span className="text-[10px] tabular-nums text-stone-500">{count}x · {pct}%</span>
                    {zoneOnTime != null && (
                      <span className={cn(
                        'text-[9px] font-bold tabular-nums',
                        zoneOnTime >= 80 ? 'text-matcha-600' : zoneOnTime >= 60 ? 'text-amber-600' : 'text-red-600',
                      )}>
                        · {zoneOnTime}% pünktlich
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ETA Deviations per Zone */}
      {etaAcc?.byZone && Object.keys(etaAcc.byZone).length > 0 && (
        <div className="space-y-1">
          {Object.entries(etaAcc.byZone)
            .filter(([, z]) => z.totalStops > 0 && z.avgDeliveryMin != null)
            .sort(([, a], [, b]) => (b.avgDeliveryMin ?? 0) - (a.avgDeliveryMin ?? 0))
            .map(([zone, data]) => {
              const avgMin = Math.round(data.avgDeliveryMin ?? 0);
              const onTimePct = data.onTimeRate != null ? Math.round(data.onTimeRate * 100) : null;
              const barPct = Math.min(100, (avgMin / 60) * 100);
              const barColor = avgMin <= 30 ? 'bg-matcha-400' : avgMin <= 45 ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={zone} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-stone-500 w-14 shrink-0">Zone {zone}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-stone-600 w-14 text-right shrink-0">
                    {avgMin} Min
                    {onTimePct != null && (
                      <span className={cn('ml-1 font-bold', onTimePct >= 80 ? 'text-matcha-600' : 'text-red-500')}>
                        {onTimePct}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
