'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface TagesBilanz {
  touren_count: number;
  km_gesamt: number;
  einnahmen_eur: number;
  trinkgeld_eur: number;
  schicht_stunden: number;
  avg_tour_min: number;
}

const MOCK: TagesBilanz = {
  touren_count: 12,
  km_gesamt: 48.4,
  einnahmen_eur: 9.6,
  trinkgeld_eur: 3.5,
  schicht_stunden: 6.5,
  avg_tour_min: 22,
};

export function FahrerPhase709TagesBilanzZusammenfassung({ driverId, isOnline }: Props) {
  const [data, setData] = useState<TagesBilanz | null>(null);
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
        `/api/delivery/driver/tages-bilanz?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.touren_count === 'number') {
          setData(json);
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

  const gesamtEinnahmen = data ? data.einnahmen_eur + data.trinkgeld_eur : 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Tages-Bilanz</span>
          {!loading && data && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {gesamtEinnahmen.toFixed(2)} € heute
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading || !data ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{data.touren_count}</p>
                  <p className="text-[9px] text-muted-foreground">Touren</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{data.km_gesamt.toFixed(0)}</p>
                  <p className="text-[9px] text-muted-foreground">km</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{data.avg_tour_min}</p>
                  <p className="text-[9px] text-muted-foreground">Min/Tour</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/10 p-2">
                  <p className="text-[10px] text-muted-foreground">Einnahmen</p>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {data.einnahmen_eur.toFixed(2)} €
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/10 p-2">
                  <p className="text-[10px] text-muted-foreground">Trinkgeld</p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {data.trinkgeld_eur.toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-950/10 px-3 py-2">
                <span className="text-xs text-muted-foreground">Gesamt · {data.schicht_stunden.toFixed(1)}h Schicht</span>
                <span className="text-base font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                  {gesamtEinnahmen.toFixed(2)} €
                </span>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">5-Min Aktualisierung · Heutige Schicht</p>
        </div>
      )}
    </div>
  );
}
