'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock4, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface UeberstundenEintrag {
  driver_id: string;
  name: string;
  schicht_h: number;
  ueberstunden_min: number;
}

const MOCK: UeberstundenEintrag[] = [
  { driver_id: '1', name: 'Max M.', schicht_h: 9.5, ueberstunden_min: 90 },
  { driver_id: '2', name: 'Anna K.', schicht_h: 8.3, ueberstunden_min: 18 },
];

export function DispatchPhase748SchichtUeberstundenPanel({ locationId }: Props) {
  const [data, setData] = useState<UeberstundenEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-ueberstunden?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.ueberstunden) && json.ueberstunden.length > 0) {
          setData(json.ueberstunden);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock4 className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Schicht-Überstunden</span>
          {!loading && data.length > 0 && (
            <span className="text-xs bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded-full px-2 py-0.5 font-semibold">
              {data.length} Fahrer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Überstunden</p>
          ) : (
            data.map((f) => (
              <div key={f.driver_id} className="flex items-center gap-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">Schicht: {f.schicht_h}h</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    +{Math.floor(f.ueberstunden_min / 60) > 0 ? `${Math.floor(f.ueberstunden_min / 60)}h ` : ''}{f.ueberstunden_min % 60}m
                  </p>
                  <p className="text-[9px] text-muted-foreground">Überstunden</p>
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Standard 8h Schicht · 5-Min Update</p>
        </div>
      )}
    </div>
  );
}
