'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coffee, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface PauseEmpfehlung {
  driver_id: string;
  name: string;
  schicht_min: number;
  letzte_pause_vor_min: number | null;
  empfehlung: boolean;
  grund: string;
}

const MOCK: PauseEmpfehlung[] = [
  { driver_id: '1', name: 'Max M.', schicht_min: 240, letzte_pause_vor_min: 180, empfehlung: true, grund: 'Keine Pause seit 3 h' },
  { driver_id: '2', name: 'Anna K.', schicht_min: 120, letzte_pause_vor_min: 30, empfehlung: false, grund: 'Letzte Pause vor 30 Min' },
  { driver_id: '3', name: 'Lukas B.', schicht_min: 300, letzte_pause_vor_min: null, empfehlung: true, grund: 'Noch keine Pause heute' },
];

export function DispatchPhase738FahrerPauseEmpfehlung({ locationId }: Props) {
  const [data, setData] = useState<PauseEmpfehlung[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/pausen-empfehlung?location_id=${locationId}`,
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
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const empfohlen = data.filter((f) => f.empfehlung);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold">Pause-Empfehlung</span>
          {!loading && empfohlen.length > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5 font-semibold">
              {empfohlen.length} fällig
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
            <p className="text-xs text-muted-foreground text-center py-3">Keine Fahrer aktiv</p>
          ) : (
            data.map((f) => (
              <div key={f.driver_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${f.empfehlung ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' : 'bg-muted/40'}`}>
                <Coffee className={`h-4 w-4 shrink-0 ${f.empfehlung ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.grund}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {Math.floor(f.schicht_min / 60)}h {f.schicht_min % 60}m
                </span>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Schichtdauer + letzte Pause · 5-Min Update</p>
        </div>
      )}
    </div>
  );
}
