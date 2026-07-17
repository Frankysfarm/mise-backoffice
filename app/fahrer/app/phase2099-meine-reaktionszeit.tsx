'use client';

import { useCallback, useEffect, useState } from 'react';
import { Timer, TrendingDown, TrendingUp, Minus, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
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
}

const MOCK: ApiData = {
  team_median_min: 3.6,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   median_min: 2.1, avg_min: 2.4, stopps_heute: 14, outlier_count: 1, trend: 'besser',      trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', median_min: 3.8, avg_min: 4.1, stopps_heute: 11, outlier_count: 2, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   median_min: 5.7, avg_min: 6.3, stopps_heute: 9,  outlier_count: 4, trend: 'schlechter', trend_delta: 1.8,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  median_min: 2.8, avg_min: 3.0, stopps_heute: 13, outlier_count: 1, trend: 'besser',      trend_delta: -0.6, alert: false },
  ],
};

const THRESHOLD = 3;

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2099MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
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

  if (!isOnline) return null;

  const me = driverId ? data.fahrer.find(f => f.driver_id === driverId) : data.fahrer[0];
  const myMedian   = me?.median_min ?? data.team_median_min;
  const teamMedian = data.team_median_min;
  const vsTeam     = parseFloat((myMedian - teamMedian).toFixed(1));
  const pct        = Math.min((myMedian / (THRESHOLD * 3)) * 100, 100);

  const barColor = myMedian <= THRESHOLD ? 'bg-matcha-500' : myMedian <= THRESHOLD * 2 ? 'bg-amber-400' : 'bg-red-500';

  const tip = () => {
    if (!me) return null;
    if (me.trend === 'besser')      return { icon: TrendingDown, text: `Du wirst schneller! ${Math.abs(me.trend_delta)} Min Verbesserung.`, cls: 'text-matcha-700 bg-matcha-50 border-matcha-200' };
    if (me.trend === 'schlechter')  return { icon: TrendingUp,   text: `Stopp-Dauer stieg um ${me.trend_delta} Min. Klingelzeiten prüfen?`, cls: 'text-red-700 bg-red-50 border-red-200' };
    return { icon: Minus, text: 'Konstante Stopp-Zeit — weiter so!', cls: 'text-blue-700 bg-blue-50 border-blue-200' };
  };
  const tipData = tip();

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Timer className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Reaktionszeit</span>
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Main KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className={cn('rounded-lg border px-3 py-2 text-center', myMedian > THRESHOLD ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Mein Median</div>
              <div className={cn('text-2xl font-black tabular-nums', myMedian > THRESHOLD ? 'text-red-600' : 'text-blue-700')}>
                {myMedian.toFixed(1)}<span className="text-xs font-normal ml-0.5">Min</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Team-Median</div>
              <div className="text-2xl font-black tabular-nums text-foreground">{teamMedian.toFixed(1)}<span className="text-xs font-normal ml-0.5">Min</span></div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">vs. Team</div>
              <div className={cn('text-2xl font-black tabular-nums', vsTeam < 0 ? 'text-matcha-600' : vsTeam > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {vsTeam > 0 ? '+' : ''}{vsTeam.toFixed(1)}<span className="text-xs font-normal ml-0.5">Min</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Stopp-Reaktionszeit</span>
              <span className="text-[10px] font-bold text-muted-foreground">Ziel: &le;{THRESHOLD} Min</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/8 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-matcha-600">Schnell</span>
              <span className="text-[9px] text-muted-foreground">{me?.stopps_heute ?? 0} Stopps heute · {me?.outlier_count ?? 0} Ausreißer</span>
              <span className="text-[9px] text-red-500">Langsam</span>
            </div>
          </div>

          {/* Tip */}
          {tipData && me && (
            <div className={cn('rounded-lg border px-3 py-2 flex items-start gap-2', tipData.cls)}>
              <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p className="text-xs font-medium">{tipData.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
