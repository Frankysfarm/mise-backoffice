'use client';

/**
 * SchichtPulseKpi — Phase 421
 *
 * Kompaktes KPI-Strip für den Lieferdienst-Admin:
 * Zeigt 4 Schlüsselkennzahlen der aktuellen Schicht in Echtzeit:
 * Bestellungen diese Stunde, Umsatz/h, Fahrer aktiv, Pünktlichkeitsquote.
 * API: GET /api/delivery/stats?scope=shift&location_id=...
 */

import { useCallback, useEffect, useState } from 'react';
import { Activity, Bike, Clock, Euro, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStats {
  totalOrders:    number;
  totalRevenue:   number;
  activeDrivers:  number;
  onTimeRate:     number | null;
  ordersThisHour: number | null;
  revenueThisHour:number | null;
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${Math.round(v * 100)} %`;
}

interface KpiItem {
  label: string;
  value: string;
  icon: typeof Activity;
  color: string;
  trend?: 'up' | 'down' | null;
}

export function SchichtPulseKpi({ locationId }: { locationId: string | null }) {
  const [data, setData]     = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(() => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/stats?scope=shift&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setData({
          totalOrders:     d.totalOrders     ?? d.orders        ?? 0,
          totalRevenue:    d.totalRevenue    ?? d.revenue        ?? 0,
          activeDrivers:   d.activeDrivers   ?? d.drivers_active ?? 0,
          onTimeRate:      d.onTimeRate      ?? d.on_time_rate   ?? null,
          ordersThisHour:  d.ordersThisHour  ?? null,
          revenueThisHour: d.revenueThisHour ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    laden();
    const iv = setInterval(laden, 60_000);
    return () => clearInterval(iv);
  }, [laden]);

  if (!locationId) return null;
  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Schicht-KPIs laden…
      </div>
    );
  }
  if (!data) return null;

  const kpis: KpiItem[] = [
    {
      label: 'Bestellungen',
      value: data.totalOrders.toString(),
      icon: Activity,
      color: 'text-matcha-700',
      trend: data.ordersThisHour !== null ? (data.ordersThisHour > 5 ? 'up' : 'down') : null,
    },
    {
      label: 'Umsatz',
      value: fmtEur(data.totalRevenue),
      icon: Euro,
      color: 'text-emerald-700',
      trend: data.revenueThisHour !== null ? (data.revenueThisHour > 50 ? 'up' : 'down') : null,
    },
    {
      label: 'Fahrer aktiv',
      value: data.activeDrivers.toString(),
      icon: Bike,
      color: 'text-blue-700',
      trend: null,
    },
    {
      label: 'Pünktlich',
      value: fmtPct(data.onTimeRate),
      icon: Clock,
      color: data.onTimeRate !== null && data.onTimeRate >= 0.8 ? 'text-matcha-700' : data.onTimeRate !== null && data.onTimeRate >= 0.6 ? 'text-amber-700' : 'text-red-700',
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {kpis.map(kpi => {
        const Icon = kpi.icon;
        return (
          <div key={kpi.label} className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className={cn('text-sm font-black tabular-nums truncate', kpi.color)}>
                  {kpi.value}
                </span>
                {kpi.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-500 shrink-0" />}
                {kpi.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{kpi.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
