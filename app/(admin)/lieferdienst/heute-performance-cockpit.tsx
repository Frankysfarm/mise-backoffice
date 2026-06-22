'use client';

/**
 * Phase 423 – HeutePerformanceCockpit
 * Real-time today's performance dashboard for Lieferdienst.
 * Shows revenue, deliveries, on-time rate, active drivers,
 * and comparison to yesterday — all in one compact card.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus,
  Euro, Bike, Clock, Target, Zap,
  CheckCircle2, AlertTriangle, RefreshCw,
  BarChart2, Users,
} from 'lucide-react';

interface ShiftKpi {
  orders_count: number;
  revenue_eur: number;
  avg_delivery_min: number;
  on_time_pct: number;
  active_drivers: number;
  cancellation_rate_pct: number;
  orders_per_hour: number;
  top_zone: string | null;
}

interface Props {
  locationId: string | null;
}

function delta(current: number, prev: number): { dir: 'up' | 'down' | 'neutral'; pct: number } {
  if (prev === 0) return { dir: 'neutral', pct: 0 };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', pct: Math.abs(pct) };
}

function KpiTile({
  label,
  value,
  sub,
  dir,
  pct,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  dir?: 'up' | 'down' | 'neutral';
  pct?: number;
  icon: typeof Euro;
  accent?: string;
}) {
  const TrendIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const trendColor =
    dir === 'up' ? 'text-matcha-600' : dir === 'down' ? 'text-red-500' : 'text-stone-400';

  return (
    <div className={cn('rounded-xl p-3 border bg-white', accent ? `border-l-[3px] ${accent}` : 'border-stone-200')}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-stone-400" />
          <span className="text-[11px] text-stone-500 font-medium">{label}</span>
        </div>
        {dir && dir !== 'neutral' && pct !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-[10px] font-bold', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {pct}%
          </div>
        )}
      </div>
      <div className="text-xl font-black text-stone-900 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function HeutePerformanceCockpit({ locationId }: Props) {
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/stats?location_id=${encodeURIComponent(locationId)}&scope=shift`,
      );
      if (!res.ok) return;
      const json = await res.json();
      setKpi({
        orders_count: json.orders_count ?? 0,
        revenue_eur: json.revenue_eur ?? 0,
        avg_delivery_min: json.avg_delivery_min ?? 0,
        on_time_pct: json.on_time_pct ?? 0,
        active_drivers: json.active_drivers ?? 0,
        cancellation_rate_pct: json.cancellation_rate_pct ?? 0,
        orders_per_hour: json.orders_per_hour ?? 0,
        top_zone: json.top_zone ?? null,
      });
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!locationId) return null;

  const fmtEur = (v: number) =>
    v >= 1000
      ? `${(v / 1000).toFixed(1)}k €`
      : v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const onTimeColor =
    !kpi
      ? ''
      : kpi.on_time_pct >= 85
      ? 'border-l-matcha-500'
      : kpi.on_time_pct >= 70
      ? 'border-l-amber-400'
      : 'border-l-red-400';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Zap className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <span className="text-sm font-bold text-stone-900">Schicht-KPI heute</span>
          {kpi && (
            <span className="hidden sm:inline text-xs text-stone-400">
              {kpi.orders_count} Bestellungen · {kpi.active_drivers} Fahrer aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-stone-400 hidden sm:inline">
              {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="rounded-lg p-1 hover:bg-stone-100 transition-colors text-stone-400"
            disabled={loading}
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <span className="text-xs text-stone-400">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-stone-100 p-4">
          {loading && !kpi && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          )}

          {kpi && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <KpiTile
                  label="Umsatz (Schicht)"
                  value={fmtEur(kpi.revenue_eur)}
                  icon={Euro}
                  accent="border-l-matcha-500"
                />
                <KpiTile
                  label="Bestellungen"
                  value={kpi.orders_count.toString()}
                  sub={`${kpi.orders_per_hour}/h Ø`}
                  icon={BarChart2}
                  accent="border-l-blue-500"
                />
                <KpiTile
                  label="Pünktlichkeit"
                  value={`${kpi.on_time_pct}%`}
                  sub={kpi.on_time_pct >= 85 ? '✓ Ziel erreicht' : 'Ziel: 85%'}
                  icon={Target}
                  accent={onTimeColor}
                />
                <KpiTile
                  label="Ø Lieferzeit"
                  value={kpi.avg_delivery_min > 0 ? `${kpi.avg_delivery_min} Min` : '—'}
                  icon={Clock}
                  accent="border-l-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiTile
                  label="Aktive Fahrer"
                  value={kpi.active_drivers.toString()}
                  icon={Users}
                />
                <KpiTile
                  label="Stornoquote"
                  value={`${kpi.cancellation_rate_pct.toFixed(1)}%`}
                  sub={kpi.cancellation_rate_pct <= 5 ? '✓ normal' : '⚠ erhöht'}
                  icon={kpi.cancellation_rate_pct > 5 ? AlertTriangle : CheckCircle2}
                  accent={kpi.cancellation_rate_pct > 10 ? 'border-l-red-500' : kpi.cancellation_rate_pct > 5 ? 'border-l-amber-400' : 'border-l-matcha-400'}
                />
                {kpi.top_zone && (
                  <KpiTile
                    label="Top-Zone"
                    value={kpi.top_zone}
                    sub="meiste Bestellungen"
                    icon={Bike}
                  />
                )}
              </div>

              {/* On-time visual bar */}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-stone-500 shrink-0 w-24">Pünktlichkeit</span>
                <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      kpi.on_time_pct >= 85
                        ? 'bg-matcha-500'
                        : kpi.on_time_pct >= 70
                        ? 'bg-amber-400'
                        : 'bg-red-400',
                    )}
                    style={{ width: `${Math.min(100, kpi.on_time_pct)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-stone-700 tabular-nums w-10 text-right">
                  {kpi.on_time_pct}%
                </span>
                <span className="text-[10px] text-stone-400">/ 85% Ziel</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
