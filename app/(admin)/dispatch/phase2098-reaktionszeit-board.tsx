'use client';

import { useCallback, useEffect, useState } from 'react';
import { Timer, TrendingDown, TrendingUp, Minus, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRow {
  driver_id: string;
  name: string;
  median_min: number;
  avg_min: number;
  stopps_heute: number;
  outlier_count: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_median_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_median_min: 3.6,
  alert_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   median_min: 2.1, avg_min: 2.4, stopps_heute: 14, outlier_count: 1, trend: 'besser',      trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', median_min: 3.8, avg_min: 4.1, stopps_heute: 11, outlier_count: 2, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   median_min: 5.7, avg_min: 6.3, stopps_heute: 9,  outlier_count: 4, trend: 'schlechter', trend_delta: 1.8,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  median_min: 2.8, avg_min: 3.0, stopps_heute: 13, outlier_count: 1, trend: 'besser',      trend_delta: -0.6, alert: false },
  ],
};

const THRESHOLD = 3;

interface Props { locationId: string | null }

export function DispatchPhase2098ReaktionsteitBoard({ locationId }: Props) {
  const [open, setOpen]     = useState(true);
  const [data, setData]     = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/stopp-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const TrendIcon = ({ trend, delta }: { trend: FahrerRow['trend']; delta: number }) => {
    if (trend === 'besser')      return <TrendingDown  className="h-3 w-3 text-matcha-600" title={`${Math.abs(delta)} Min besser`} />;
    if (trend === 'schlechter')  return <TrendingUp    className="h-3 w-3 text-red-500"    title={`+${delta} Min langsamer`} />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const ampel = (min: number) =>
    min <= THRESHOLD ? 'bg-matcha-500' : min <= THRESHOLD * 2 ? 'bg-amber-400' : 'bg-red-500';

  const maxMedian = Math.max(...data.fahrer.map(f => f.median_min), 1);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Timer className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Stopp-Reaktionszeit
        </span>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-center">
              <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Team-Median</div>
              <div className={cn('text-xl font-black tabular-nums', data.team_median_min > THRESHOLD ? 'text-red-600' : 'text-blue-700')}>
                {data.team_median_min.toFixed(1)}<span className="text-xs font-normal ml-0.5">Min</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Fahrer</div>
              <div className="text-xl font-black text-foreground flex items-center justify-center gap-1">
                <Users className="h-4 w-4" />{data.fahrer.length}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ziel</div>
              <div className="text-xl font-black text-matcha-700">&le;{THRESHOLD}<span className="text-xs font-normal ml-0.5">Min</span></div>
            </div>
          </div>

          {/* Alert banner */}
          {data.alert_count > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                {data.alert_count} Fahrer überschreitet Median &gt;{THRESHOLD} Min — bitte prüfen
              </p>
            </div>
          )}

          {/* Driver ranking */}
          <div className="space-y-2">
            {data.fahrer.map((f, i) => (
              <div key={f.driver_id} className={cn('rounded-lg border px-3 py-2', f.alert ? 'bg-red-50 border-red-200' : 'bg-muted/20')}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    i === 0 ? 'bg-matcha-500 text-white' : i === 1 ? 'bg-matcha-300 text-matcha-900' : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold flex-1">{f.name}</span>
                  <TrendIcon trend={f.trend} delta={f.trend_delta} />
                  <span className={cn('text-xs font-black tabular-nums', f.alert ? 'text-red-600' : 'text-foreground')}>
                    {f.median_min.toFixed(1)} Min
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/8 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', ampel(f.median_min))}
                      style={{ width: `${Math.min((f.median_min / maxMedian) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {f.stopps_heute} Stopps · {f.outlier_count > 0 ? `${f.outlier_count} Ausreißer` : 'OK'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-matcha-500" /> ≤{THRESHOLD} Min</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-amber-400" /> ≤{THRESHOLD * 2} Min</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-500" /> &gt;{THRESHOLD * 2} Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
