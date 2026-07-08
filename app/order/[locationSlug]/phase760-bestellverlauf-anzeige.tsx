'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface StundenEintrag {
  stunde: number;
  bestellungen: number;
}

const MOCK: StundenEintrag[] = [
  { stunde: 11, bestellungen: 5 },
  { stunde: 12, bestellungen: 14 },
  { stunde: 13, bestellungen: 18 },
  { stunde: 14, bestellungen: 11 },
  { stunde: 15, bestellungen: 8 },
  { stunde: 16, bestellungen: 7 },
  { stunde: 17, bestellungen: 12 },
  { stunde: 18, bestellungen: 20 },
  { stunde: 19, bestellungen: 15 },
];

export function Phase760BestellverlaufAnzeige({ locationId }: Props) {
  const [data, setData] = useState<StundenEintrag[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setGesamt(MOCK.reduce((s, h) => s + h.bestellungen, 0)); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/bestellverlauf-heute?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.stunden)) {
          const aktiv = json.stunden.filter((s: StundenEintrag) => s.bestellungen > 0);
          setData(aktiv.slice(-10));
          setGesamt(json.gesamt_heute ?? 0);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
    setGesamt(MOCK.reduce((s, h) => s + h.bestellungen, 0));
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const maxB = data.length > 0 ? Math.max(...data.map((d) => d.bestellungen), 1) : 1;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold">Bestellverlauf Heute</span>
          {!loading && gesamt > 0 && (
            <span className="text-xs text-muted-foreground">{gesamt} gesamt</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Noch keine Bestellungen</p>
          ) : (
            <div className="flex items-end gap-1 h-20">
              {data.map((d) => {
                const h = Math.max(4, Math.round((d.bestellungen / maxB) * 64));
                const isPeak = d.bestellungen === maxB;
                return (
                  <div key={d.stunde} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-muted-foreground tabular-nums">{d.bestellungen}</span>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${isPeak ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-700'}`}
                      style={{ height: `${h}px` }}
                    />
                    <span className="text-[7px] text-muted-foreground">{d.stunde}h</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">Stündliche Bestellungen heute · 5-Min Update</p>
        </div>
      )}
    </div>
  );
}
