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

interface Props { locationId?: string | null }

export function KitchenPhase2152RekationszeitMonitor({ locationId }: Props) {
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
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const langsam    = data.fahrer.filter(f => f.avg_min > 5);
  const eskalation = langsam.length >= 2;
  const hasAlert   = langsam.length > 0;
  const teamColor  = data.team_avg_min <= 3 ? 'text-green-600' : data.team_avg_min <= 5 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Timer className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-red-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Reaktionszeit-Monitor</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5',
            eskalation
              ? 'text-red-700 bg-red-100 border border-red-200'
              : 'text-amber-700 bg-amber-100 border border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {eskalation ? 'ESKALATION' : `${langsam.length} LANGSAM`}
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Reaktionszeit</p>
              <p className={cn('text-lg font-black tabular-nums', teamColor)}>
                {data.team_avg_min.toFixed(1)} Min
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground text-right">Ziel: &lt; 3 Min.</p>
          </div>

          {eskalation && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Mehrere Fahrer &gt;5 Min. Reaktionszeit — Dispatcher kontaktieren!
              </p>
            </div>
          )}

          {hasAlert ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fahrer über 5 Min.</p>
              {langsam.map(f => (
                <div key={f.driver_id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    {f.trend === 'schlechter' && <TrendingUp   className="h-3 w-3 text-red-500" />}
                    {f.trend === 'besser'     && <TrendingDown className="h-3 w-3 text-green-500" />}
                    {f.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-[10px] font-bold text-red-700 tabular-nums">{f.avg_min.toFixed(1)} Min</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{f.auftraege} Auftr.</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Alle Fahrer reagieren schnell — keine Alerts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
