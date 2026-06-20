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
  drivers: DriverLiveScore[];
}

interface Props {
  locationId: string | null;
}

const SCORE_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  Ausgezeichnet:      { bg: 'bg-matcha-50',  text: 'text-matcha-700',  bar: 'bg-matcha-500'  },
  Gut:                { bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-500'    },
  Durchschnittlich:   { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-400'   },
  Verbesserungsbedarf:{ bg: 'bg-red-50',     text: 'text-red-700',     bar: 'bg-red-400'     },
};

export function DispatchFahrerLeistungsLive({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = () => {
      setLoading((prev) => !prev);
      fetch(`/api/delivery/admin/driver-performance-realtime?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.drivers) setDashboard(d as Dashboard);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!locationId || (!loading && !dashboard)) return null;
  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Fahrer-Leistung…
      </div>
    );
  }
  if (!dashboard || dashboard.drivers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100">
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer Live-Score</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Ø {dashboard.avgLiveScore}/100 · {dashboard.activeDrivers} aktiv
        </span>
      </div>

      {/* Fahrer-Zeilen */}
      <div className="divide-y">
        {dashboard.drivers.slice(0, 6).map((d, idx) => {
          const style = SCORE_STYLE[d.liveScoreLabel] ?? SCORE_STYLE['Durchschnittlich'];
          const TrendIcon =
            d.trendDirection === 'up' ? TrendingUp :
            d.trendDirection === 'down' ? TrendingDown : Minus;
          const trendColor =
            d.trendDirection === 'up' ? 'text-matcha-600' :
            d.trendDirection === 'down' ? 'text-red-500' : 'text-muted-foreground';

          return (
            <div key={idx} className={cn('flex items-center gap-3 px-4 py-2.5', style.bg)}>
              {/* Rang */}
              <span className="shrink-0 w-4 text-[10px] font-bold text-muted-foreground tabular-nums">
                {idx + 1}.
              </span>

              {/* Name + Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">{d.driverName}</span>
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', style.text, 'bg-white/70')}>
                    {d.liveScoreLabel}
                  </span>
                </div>
                {/* Score-Balken */}
                <div className="mt-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                    style={{ width: `${d.liveScore}%` }}
                  />
                </div>
              </div>

              {/* Score + Trend */}
              <div className="shrink-0 flex items-center gap-1">
                <span className={cn('text-sm font-black tabular-nums', style.text)}>
                  {d.liveScore}
                </span>
                <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
              </div>

              {/* Stops heute */}
              <div className="shrink-0 text-right">
                <div className="text-xs font-bold tabular-nums text-foreground">
                  {d.today.stopsCompleted}
                </div>
                <div className="text-[8px] text-muted-foreground">Stops</div>
              </div>
            </div>
          );
        })}
      </div>

      {dashboard.drivers.length > 6 && (
        <div className="px-4 py-2 text-[10px] text-muted-foreground border-t">
          + {dashboard.drivers.length - 6} weitere Fahrer
        </div>
      )}
    </div>
  );
}
