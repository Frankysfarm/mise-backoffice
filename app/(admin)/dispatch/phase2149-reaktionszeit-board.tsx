'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Minus, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerReaktionszeit {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_min: 5.9,
  alert_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_min: 3.2,  auftraege: 12, trend: 'besser',     trend_delta: -0.8, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_min: 5.1,  auftraege: 9,  trend: 'gleich',     trend_delta: 0,    alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_min: 11.4, auftraege: 7,  trend: 'schlechter', trend_delta: 2.3,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  avg_min: 4.0,  auftraege: 11, trend: 'besser',     trend_delta: -1.2, alert: false },
  ],
};

function zeitColor(min: number) {
  if (min <= 3) return 'text-green-600';
  if (min <= 5) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(min: number) {
  if (min <= 3) return 'bg-green-500';
  if (min <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props { locationId: string | null }

export function DispatchPhase2149ReaktionszeitBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertList = data.fahrer.filter(f => f.alert || f.avg_min > 5);
  const hasAlert  = alertList.length > 0;
  const sorted    = [...data.fahrer].sort((a, b) => a.avg_min - b.avg_min);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Timer className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Reaktionszeit-Board</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{alertList.length} LANGSAM
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Reaktionszeit</p>
              <p className={cn('text-xl font-black tabular-nums', zeitColor(data.team_avg_min))}>
                {data.team_avg_min.toFixed(1)} Min.
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[9px] text-muted-foreground">Ziel: &lt; 3 Min.</p>
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertList.map(f => f.name).join(', ')} — Reaktionszeit über 5 Min. Coaching empfehlen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f, i) => (
              <div key={f.driver_id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                f.avg_min > 5  ? 'bg-red-50 border-red-200'
                : f.avg_min > 3 ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/10',
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-bold w-4 shrink-0">#{i + 1}</span>
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    {f.trend === 'besser'     && <TrendingDown className="h-3 w-3 text-green-500" />}
                    {f.trend === 'schlechter' && <TrendingUp   className="h-3 w-3 text-red-500" />}
                    {f.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                    <span className={cn('text-sm font-black tabular-nums', zeitColor(f.avg_min))}>
                      {f.avg_min.toFixed(1)}m
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(f.avg_min))}
                      style={{ width: `${Math.min((f.avg_min / 12) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{f.auftraege} Auftr.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
