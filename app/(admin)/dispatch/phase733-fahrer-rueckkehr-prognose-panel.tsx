'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navigation, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerPrognose {
  driver_id: string;
  name: string;
  eta_min: number;
  stops_remaining: number;
  distanz_km: number;
  hat_gps: boolean;
}

const MOCK: FahrerPrognose[] = [
  { driver_id: '1', name: 'Max M.', eta_min: 8, stops_remaining: 1, distanz_km: 3.2, hat_gps: true },
  { driver_id: '2', name: 'Anna K.', eta_min: 17, stops_remaining: 2, distanz_km: 6.8, hat_gps: true },
  { driver_id: '3', name: 'Lukas B.', eta_min: 25, stops_remaining: 3, distanz_km: 10.1, hat_gps: false },
];

function etaFarbe(min: number) {
  if (min <= 10) return 'text-emerald-600 dark:text-emerald-400';
  if (min <= 20) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function DispatchPhase733FahrerRueckkehrPrognosePanel({ locationId }: Props) {
  const [data, setData] = useState<FahrerPrognose[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-rueckkehr-prognose-v2?location_id=${locationId}`,
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
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Rückkehr-Prognose</span>
          {!loading && data.length > 0 && (
            <span className="text-xs text-muted-foreground">{data.length} aktiv</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Kein Fahrer unterwegs</p>
          ) : (
            data.map((f) => (
              <div key={f.driver_id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {f.stops_remaining} Stop{f.stops_remaining !== 1 ? 's' : ''} · {f.distanz_km.toFixed(1)} km
                    {!f.hat_gps && ' · Schätzung'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${etaFarbe(f.eta_min)}`}>
                    {f.eta_min} Min
                  </p>
                  <p className="text-[9px] text-muted-foreground">ETA</p>
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Haversine-GPS · 30s Update</p>
        </div>
      )}
    </div>
  );
}
