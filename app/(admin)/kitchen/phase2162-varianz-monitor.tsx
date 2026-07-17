'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerVarianz {
  driver_id: string;
  name: string;
  stdabweichung_min: number;
  avg_lieferzeit_min: number;
  auftraege: number;
  konsistenz_score: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerVarianz[];
  team_avg_sigma: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_sigma: 9.2,
  alert_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   stdabweichung_min: 3.2,  avg_lieferzeit_min: 24, auftraege: 12, konsistenz_score: 90, alert: false },
    { driver_id: 'd3', name: 'Tom B.',   stdabweichung_min: 19.4, avg_lieferzeit_min: 38, auftraege: 7,  konsistenz_score: 22, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  stdabweichung_min: 5.7,  avg_lieferzeit_min: 28, auftraege: 11, konsistenz_score: 78, alert: false },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2162VarianzMonitor({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer   = useMemo(() => data.fahrer.filter(f => f.alert || f.stdabweichung_min > 15), [data]);
  const mehrereAlert  = alertFahrer.length >= 2;
  const hasAlert      = alertFahrer.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Activity className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-red-500' : 'text-blue-500')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Varianz-Monitor</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5',
            mehrereAlert
              ? 'text-red-700 bg-red-100 border border-red-200'
              : 'text-amber-700 bg-amber-100 border border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {mehrereAlert ? 'ESKALATION' : `${alertFahrer.length} INKONSISTENT`}
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Varianz (σ)</p>
              <p className={cn(
                'text-lg font-black tabular-nums',
                data.team_avg_sigma <= 5 ? 'text-green-600' : data.team_avg_sigma <= 15 ? 'text-amber-600' : 'text-red-600',
              )}>
                {data.team_avg_sigma.toFixed(1)} Min.
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground text-right">Ziel: σ ≤ 5 Min.</p>
          </div>

          {mehrereAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Mehrere Fahrer mit σ &gt;15 Min. — Eskalation. Ursachenanalyse: Routenwahl, Stopp-Dichte, Zonen-Mix prüfen.
              </p>
            </div>
          )}

          {hasAlert ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fahrer mit σ &gt; 15 Min.</p>
              {alertFahrer.map(f => (
                <div key={f.driver_id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] font-bold text-red-700 tabular-nums">σ {f.stdabweichung_min.toFixed(1)} Min.</span>
                  <span className="text-[9px] text-muted-foreground">Score {f.konsistenz_score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Alle Fahrer liefern konsistent — keine Varianz-Alerts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
