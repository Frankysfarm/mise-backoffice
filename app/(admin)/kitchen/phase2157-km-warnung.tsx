'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKmEffizienz {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  auftraege: number;
  effizienz_score: number;
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
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  auftraege: 12, effizienz_score: 92, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  auftraege: 9,  effizienz_score: 71, alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, auftraege: 7,  effizienz_score: 31, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  km_per_auftrag: 4.5,  auftraege: 11, effizienz_score: 81, alert: false },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2157KmWarnung({ locationId }: Props) {
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

  const alertFahrer  = useMemo(() => data.fahrer.filter(f => f.alert || f.km_per_auftrag > 10), [data.fahrer]);
  const mehrereAlert = alertFahrer.length >= 2;
  const hasAlert     = alertFahrer.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Route className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-red-500' : 'text-emerald-500')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">km-Warnung</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5',
            mehrereAlert
              ? 'text-red-700 bg-red-100 border border-red-200'
              : 'text-amber-700 bg-amber-100 border border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {mehrereAlert ? 'ESKALATION' : `${alertFahrer.length} INEFFIZIENT`}
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø km / Auftrag</p>
              <p className={cn(
                'text-lg font-black tabular-nums',
                data.team_avg_km <= 5 ? 'text-green-600' : data.team_avg_km <= 10 ? 'text-amber-600' : 'text-red-600',
              )}>
                {data.team_avg_km.toFixed(1)} km
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground text-right">Alert: &gt; 10 km</p>
          </div>

          {mehrereAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Mehrere Fahrer mit über 10 km/Auftrag — Eskalation. Batch-Neuplanung mit Zonen-Bündelung empfehlen.
              </p>
            </div>
          )}

          {hasAlert ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fahrer über 10 km/Auftrag</p>
              {alertFahrer.map(f => (
                <div key={f.driver_id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] font-bold text-red-700 tabular-nums">{f.km_per_auftrag.toFixed(1)} km</span>
                  <span className="text-[9px] text-muted-foreground">{f.auftraege} Auftr.</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                💡 Dispatcher: Aufträge dieser Fahrer in nähere Zonen umverteilen.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Alle Fahrer effizient — keine km-Warnung
            </p>
          )}
        </div>
      )}
    </div>
  );
}
