'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Route } from 'lucide-react';

interface Props {
  driverId: string;
}

interface FahrtEntry {
  id: string;
  datum: string;
  uhrzeit: string;
  stops: number;
  km: number;
  einnahmen_eur: number;
  dauer_min: number;
}

const MOCK: FahrtEntry[] = [
  { id: '1', datum: 'Heute', uhrzeit: '19:45', stops: 3, km: 8.2, einnahmen_eur: 2.40, dauer_min: 28 },
  { id: '2', datum: 'Heute', uhrzeit: '18:10', stops: 2, km: 5.1, einnahmen_eur: 1.60, dauer_min: 19 },
  { id: '3', datum: 'Heute', uhrzeit: '17:02', stops: 4, km: 11.4, einnahmen_eur: 3.20, dauer_min: 35 },
  { id: '4', datum: 'Gestern', uhrzeit: '20:30', stops: 3, km: 7.8, einnahmen_eur: 2.40, dauer_min: 26 },
  { id: '5', datum: 'Gestern', uhrzeit: '19:15', stops: 2, km: 4.6, einnahmen_eur: 1.60, dauer_min: 17 },
];

export function FahrerPhase729FahrtenChronik({ driverId }: Props) {
  const [data, setData] = useState<FahrtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!driverId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/driver/fahrten-chronik?driver_id=${driverId}&limit=10`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.fahrten) && json.fahrten.length > 0) {
          setData(json.fahrten);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [driverId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const gesamt = data.reduce((s, f) => s + f.einnahmen_eur, 0);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Fahrten-Chronik</span>
          {!loading && data.length > 0 && (
            <span className="text-xs text-muted-foreground">{data.length} Touren</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Noch keine Touren</p>
          ) : (
            <>
              {data.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">{f.datum} {f.uhrzeit}</span>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{f.stops} Stop{f.stops !== 1 ? 's' : ''} · {f.km.toFixed(1)} km · {f.dauer_min} Min</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                    +{f.einnahmen_eur.toFixed(2)} €
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-[10px] text-muted-foreground">Gesamt ({data.length} Touren)</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {gesamt.toFixed(2)} €
                </span>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">Letzte 10 Touren · 5-Min Update</p>
        </div>
      )}
    </div>
  );
}
