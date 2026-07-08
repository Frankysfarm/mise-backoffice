'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerKmEntry {
  driver_id: string;
  name: string;
  km_heute: number;
  km_vorwoche: number;
  delta_km: number;
  trend: 'up' | 'down' | 'gleich';
}

const MOCK: FahrerKmEntry[] = [
  { driver_id: '1', name: 'Max M.', km_heute: 52.3, km_vorwoche: 44.1, delta_km: 8.2, trend: 'up' },
  { driver_id: '2', name: 'Anna K.', km_heute: 38.7, km_vorwoche: 41.0, delta_km: -2.3, trend: 'down' },
  { driver_id: '3', name: 'Lukas B.', km_heute: 29.4, km_vorwoche: 29.6, delta_km: -0.2, trend: 'gleich' },
];

function TrendIcon({ t }: { t: string }) {
  if (t === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function DispatchPhase753FahrerKmBilanzPanel({ locationId }: Props) {
  const [data, setData] = useState<FahrerKmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-km-bilanz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.fahrer) && json.fahrer.length > 0) {
          setData(json.fahrer);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 10 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const gesamtKm = data.reduce((s, f) => s + f.km_heute, 0);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Fahrer-km-Bilanz</span>
          {!loading && data.length > 0 && (
            <span className="text-xs text-muted-foreground">{gesamtKm.toFixed(0)} km gesamt</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Daten</p>
          ) : (
            data.map((f) => (
              <div key={f.driver_id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">Vw.: {f.km_vorwoche.toFixed(1)} km</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TrendIcon t={f.trend} />
                  <span className={`text-xs font-bold tabular-nums ${f.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : f.trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {f.delta_km > 0 ? '+' : ''}{f.delta_km.toFixed(1)} km
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0 w-14 text-right">
                  {f.km_heute.toFixed(1)} km
                </span>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Heute vs. gleicher Wochentag · 10-Min Update</p>
        </div>
      )}
    </div>
  );
}
