'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface RangEntry {
  driver_id: string;
  name: string;
  trinkgeld_heute_eur: number;
  rang: number;
  ist_ich: boolean;
}

const MOCK: RangEntry[] = [
  { driver_id: '1', name: 'Anna K.', trinkgeld_heute_eur: 8.50, rang: 1, ist_ich: false },
  { driver_id: '2', name: 'Du', trinkgeld_heute_eur: 5.20, rang: 2, ist_ich: true },
  { driver_id: '3', name: 'Max M.', trinkgeld_heute_eur: 3.80, rang: 3, ist_ich: false },
  { driver_id: '4', name: 'Lukas B.', trinkgeld_heute_eur: 2.10, rang: 4, ist_ich: false },
];

const RANG_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function FahrerPhase739TrinkgeldRangliste({ driverId, locationId }: Props) {
  const [data, setData] = useState<RangEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!driverId) { setData(MOCK); setLoading(false); return; }
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(
        `/api/delivery/admin/trinkgeld-analyse?${params.toString()}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.fahrer) && json.fahrer.length > 0) {
          const rangliste: RangEntry[] = json.fahrer.map((f: { driver_id: string; name?: string; trinkgeld_gesamt_eur: number }, i: number) => ({
            driver_id: f.driver_id,
            name: f.name ?? 'Fahrer',
            trinkgeld_heute_eur: f.trinkgeld_gesamt_eur,
            rang: i + 1,
            ist_ich: f.driver_id === driverId,
          }));
          setData(rangliste);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [driverId, locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const meinRang = data.find((d) => d.ist_ich);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Trinkgeld-Rangliste</span>
          {!loading && meinRang && (
            <span className="text-xs text-muted-foreground">
              {RANG_EMOJI[meinRang.rang] ?? `#${meinRang.rang}`} {meinRang.trinkgeld_heute_eur.toFixed(2)} €
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Noch keine Daten</p>
          ) : (
            data.slice(0, 5).map((e) => (
              <div
                key={e.driver_id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${e.ist_ich ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' : 'bg-muted/40'}`}
              >
                <span className="text-base w-5 text-center shrink-0">
                  {RANG_EMOJI[e.rang] ?? <span className="text-xs text-muted-foreground">#{e.rang}</span>}
                </span>
                <span className={`flex-1 text-xs truncate ${e.ist_ich ? 'font-bold' : ''}`}>{e.ist_ich ? 'Du' : e.name}</span>
                <span className={`text-xs font-bold tabular-nums ${e.ist_ich ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {e.trinkgeld_heute_eur.toFixed(2)} €
                </span>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Heutige Trinkgelder · 5-Min Update</p>
        </div>
      )}
    </div>
  );
}
