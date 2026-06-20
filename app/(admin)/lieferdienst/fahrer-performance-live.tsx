'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverLiveScore {
  driverName: string;
  liveScore: number;
  liveScoreLabel: 'Ausgezeichnet' | 'Gut' | 'Durchschnittlich' | 'Verbesserungsbedarf';
  trendDirection: 'up' | 'down' | 'flat';
  today: { stopsCompleted: number; onTimeRate: number | null; avgDeliveryMin: number | null };
}

interface Dashboard {
  activeDrivers: number;
  avgLiveScore: number;
  avgOnTimeRate: number | null;
  avgDeliveryMin: number | null;
  drivers: DriverLiveScore[];
}

interface Props {
  locationId: string | null;
}

const LABEL_STYLE: Record<string, { badge: string; bar: string }> = {
  Ausgezeichnet:       { badge: 'bg-matcha-100 text-matcha-700',  bar: 'bg-matcha-500'  },
  Gut:                 { badge: 'bg-blue-100 text-blue-700',      bar: 'bg-blue-500'    },
  Durchschnittlich:    { badge: 'bg-amber-100 text-amber-700',    bar: 'bg-amber-400'   },
  Verbesserungsbedarf: { badge: 'bg-red-100 text-red-700',        bar: 'bg-red-400'     },
};

export function FahrerPerformanceLive({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/admin/driver-performance-realtime?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.drivers) {
            setDashboard(d as Dashboard);
            setLastUpdate(new Date());
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;

  if (loading && !dashboard) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Fahrer-Performance…
      </div>
    );
  }
  if (!dashboard || dashboard.drivers.length === 0) return null;

  const topCount = dashboard.drivers.filter((d) => d.liveScore >= 85).length;
  const critCount = dashboard.drivers.filter((d) => d.liveScore < 45).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold">Fahrer-Performance Live</div>
          <div className="text-[10px] text-stone-400">
            {lastUpdate ? `Aktualisiert ${lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Echtzeit · 60s Refresh'}
          </div>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {/* Team-KPIs */}
      <div className="grid grid-cols-4 divide-x border-b">
        {[
          { label: 'Aktive Fahrer', value: dashboard.activeDrivers.toString() },
          { label: 'Ø Live-Score', value: `${dashboard.avgLiveScore}/100` },
          {
            label: 'Ø Pünktlichkeit',
            value: dashboard.avgOnTimeRate != null
              ? `${Math.round(dashboard.avgOnTimeRate * 100)}%`
              : '–',
          },
          {
            label: 'Top / Kritisch',
            value: `${topCount} / ${critCount}`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="px-4 py-3 text-center">
            <div className="text-base font-black tabular-nums text-foreground">{kpi.value}</div>
            <div className="text-[9px] font-semibold text-stone-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Ranking-Tabelle */}
      <div className="divide-y">
        {dashboard.drivers.map((d, idx) => {
          const style = LABEL_STYLE[d.liveScoreLabel] ?? LABEL_STYLE['Durchschnittlich'];
          const TrendIcon =
            d.trendDirection === 'up' ? TrendingUp :
            d.trendDirection === 'down' ? TrendingDown : Minus;
          const trendColor =
            d.trendDirection === 'up' ? 'text-matcha-600' :
            d.trendDirection === 'down' ? 'text-red-500' : 'text-stone-400';

          return (
            <div key={idx} className="flex items-center gap-3 px-5 py-3">
              {/* Rang */}
              <span className="shrink-0 w-5 text-[11px] font-bold text-muted-foreground tabular-nums">
                {idx + 1}.
              </span>

              {/* Name + Score */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold truncate">{d.driverName}</span>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', style.badge)}>
                    {d.liveScoreLabel}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                    style={{ width: `${d.liveScore}%` }}
                  />
                </div>
              </div>

              {/* Score + Trend */}
              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-sm font-black tabular-nums">{d.liveScore}</span>
                <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
              </div>

              {/* Stats */}
              <div className="shrink-0 hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold tabular-nums">{d.today.stopsCompleted} Stops</span>
                {d.today.onTimeRate != null && (
                  <span className="text-[9px] text-muted-foreground">
                    {Math.round(d.today.onTimeRate * 100)}% p'tl.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
