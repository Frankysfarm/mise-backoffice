'use client';

import { useEffect, useState } from 'react';
import { Award, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type EffTrend = 'up' | 'stable' | 'down';

interface DriverRankEntry {
  rank: number;
  driverId: string;
  driverName: string;
  isOnline: boolean;
  ordersToday: number;
  hoursActiveToday: number;
  ordersPerHourToday: number;
  ordersPerHourAvg7d: number;
  trend: EffTrend;
  trendDelta: number;
}

interface ApiResponse {
  ok: boolean;
  drivers: DriverRankEntry[];
  avgOrdersPerHour: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const rankColors = ['text-yellow-500', 'text-stone-400', 'text-amber-600'];

const trendIcon = {
  up: <TrendingUp className="h-3 w-3 text-matcha-600" />,
  stable: <Minus className="h-3 w-3 text-stone-400" />,
  down: <TrendingDown className="h-3 w-3 text-red-500" />,
};

export function DispatchDriverEfficiencyRanking({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverRankEntry[]>([]);
  const [avg, setAvg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/driver-efficiency-ranking?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setDrivers(d.drivers ?? []);
        setAvg(d.avgOrdersPerHour ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && drivers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Award className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Effizienz-Ranking</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && avg > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-[10px] font-bold">
            Ø {avg}/h
          </span>
        )}
        <span className="text-muted-foreground text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {loading && drivers.length === 0 ? (
            <div className="px-5 py-6 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-stone-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Fahrer</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Heute</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Std.</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Best./Std.</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">7d-Ø</th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {drivers.map((d) => (
                    <tr
                      key={d.driverId}
                      className={cn(
                        'hover:bg-stone-50 transition-colors',
                        d.ordersPerHourToday >= avg * 1.2 ? 'bg-matcha-50/40' :
                        d.ordersPerHourToday < avg * 0.8 ? 'bg-red-50/30' : '',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span className={cn('font-black text-sm', rankColors[d.rank - 1] ?? 'text-muted-foreground')}>
                          {d.rank <= 3 ? `#${d.rank}` : d.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', d.isOnline ? 'bg-matcha-500' : 'bg-stone-300')} />
                          <span className="font-medium truncate max-w-[100px]">{d.driverName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{d.ordersToday}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{d.hoursActiveToday}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                        <span className={cn(
                          d.ordersPerHourToday >= avg * 1.2 ? 'text-matcha-700' :
                          d.ordersPerHourToday < avg * 0.8 ? 'text-red-600' : '',
                        )}>
                          {d.ordersPerHourToday}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{d.ordersPerHourAvg7d}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {trendIcon[d.trend]}
                          {d.trendDelta !== 0 && (
                            <span className={cn('text-[9px] font-bold tabular-nums', d.trend === 'up' ? 'text-matcha-600' : d.trend === 'down' ? 'text-red-500' : 'text-stone-400')}>
                              {d.trendDelta > 0 ? '+' : ''}{d.trendDelta}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
