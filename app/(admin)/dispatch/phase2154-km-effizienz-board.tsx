'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Minus, Route, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKmEffizienz {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  auftraege: number;
  effizienz_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKmEffizienz[];
  team_avg_km: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_km: 6.7,
  alert_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  auftraege: 12, effizienz_score: 92, trend: 'besser',     trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  auftraege: 9,  effizienz_score: 71, trend: 'gleich',     trend_delta: 0,    alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, auftraege: 7,  effizienz_score: 31, trend: 'schlechter', trend_delta: 2.1,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  km_per_auftrag: 4.5,  auftraege: 11, effizienz_score: 81, trend: 'besser',     trend_delta: -0.9, alert: false },
  ],
};

function kmColor(km: number) {
  if (km <= 5)  return 'text-green-600';
  if (km <= 10) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(km: number) {
  if (km <= 5)  return 'bg-green-500';
  if (km <= 10) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props { locationId: string | null }

export function DispatchPhase2154KmEffizienzBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertList = data.fahrer.filter(f => f.alert || f.km_per_auftrag > 10);
  const hasAlert  = alertList.length > 0;
  const sorted    = [...data.fahrer].sort((a, b) => a.km_per_auftrag - b.km_per_auftrag);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Route className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Kilometer-Effizienz-Board</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{alertList.length} INEFFIZIENT
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø km je Auftrag</p>
              <p className={cn('text-xl font-black tabular-nums', kmColor(data.team_avg_km))}>
                {data.team_avg_km.toFixed(1)} km
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Ziel: ≤ 5 km</p>
              <p className="text-[9px] text-muted-foreground">Alert: &gt; 10 km</p>
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertList.map(f => f.name).join(', ')} — über 10 km/Auftrag. Routenoptimierung empfehlen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f, i) => (
              <div key={f.driver_id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                f.km_per_auftrag > 10 ? 'bg-red-50 border-red-200'
                : f.km_per_auftrag > 5 ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/10',
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-bold w-4 shrink-0">#{i + 1}</span>
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    {f.trend === 'besser'     && <TrendingDown className="h-3 w-3 text-green-500" />}
                    {f.trend === 'schlechter' && <TrendingUp   className="h-3 w-3 text-red-500" />}
                    {f.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                    <span className={cn('text-sm font-black tabular-nums', kmColor(f.km_per_auftrag))}>
                      {f.km_per_auftrag.toFixed(1)} km
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(f.km_per_auftrag))}
                      style={{ width: `${Math.min((f.km_per_auftrag / 15) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{f.auftraege} Auftr.</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
            <p className="text-[10px] text-emerald-800 font-medium">
              💡 Tipp: Aufträge gleicher Zone bündeln reduziert km je Lieferung um bis zu 40%.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
