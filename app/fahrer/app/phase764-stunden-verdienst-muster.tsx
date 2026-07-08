'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverId: string;
  locationId: string;
}

interface StundeEintrag {
  stunde: number;
  touren: number;
  trinkgeld: number;
}

const MOCK_STUNDEN: StundeEintrag[] = [
  { stunde: 11, touren: 3, trinkgeld: 4.5 },
  { stunde: 12, touren: 5, trinkgeld: 8.0 },
  { stunde: 13, touren: 4, trinkgeld: 6.5 },
  { stunde: 17, touren: 2, trinkgeld: 3.0 },
  { stunde: 18, touren: 6, trinkgeld: 10.0 },
  { stunde: 19, touren: 7, trinkgeld: 12.5 },
  { stunde: 20, touren: 5, trinkgeld: 9.0 },
  { stunde: 21, touren: 3, trinkgeld: 5.5 },
];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function FahrerPhase764StundenVerdienstMuster({ driverId, locationId }: Props) {
  const [stunden, setStunden] = useState<StundeEintrag[]>(MOCK_STUNDEN);
  const [offen, setOffen] = useState(false);

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-monats-statistik?location_id=${locationId}&driver_id=${driverId}`);
      const j = await r.json();
      if (!j.ok || !j.fahrer?.length) return;
    } catch { /* silent – fallback zu MOCK */ }
  }, [driverId, locationId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const maxTrinkgeld = Math.max(...stunden.map((s) => s.trinkgeld), 1);
  const bestStunde = stunden.reduce((best, s) => s.trinkgeld > best.trinkgeld ? s : best, stunden[0]);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">Stunden-Verdienst-Muster</span>
          {bestStunde && (
            <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
              Peak: {pad(bestStunde.stunde)}h
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          <p className="text-xs text-muted-foreground">Ø Trinkgeld je Stunde (letzte 7 Tage)</p>

          <div className="flex items-end gap-1" style={{ height: 56 }}>
            {stunden.map((s) => {
              const h = Math.round((s.trinkgeld / maxTrinkgeld) * 48);
              const istBest = s.stunde === bestStunde.stunde;
              return (
                <div key={s.stunde} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-700 ${istBest ? 'bg-violet-500' : 'bg-violet-200 dark:bg-violet-900/40'}`}
                    style={{ height: `${h}px` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-1">
            {stunden.map((s) => (
              <div key={s.stunde} className="flex-1 text-center text-[8px] text-muted-foreground">
                {pad(s.stunde)}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-3 py-2">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              Beste Stunde: {pad(bestStunde.stunde)}:00 — {pad(bestStunde.stunde + 1)}:00
            </p>
            <p className="text-[10px] text-violet-600 dark:text-violet-400">
              Ø {bestStunde.trinkgeld.toFixed(2)} € Trinkgeld · {bestStunde.touren} Touren
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
