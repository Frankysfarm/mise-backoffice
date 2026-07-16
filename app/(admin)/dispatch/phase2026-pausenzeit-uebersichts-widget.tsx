'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface FahrerPausenzeit {
  driver_id: string;
  name: string;
  avg_pause_min: number;
  max_pause_min: number;
  pause_count: number;
  ist_ausreisser: boolean;
}

interface PausenzeitData {
  location_id: string;
  fahrer: FahrerPausenzeit[];
  ausreisser_count: number;
  alert_ausreisser: boolean;
  generiert_am: string;
}

const MOCK: PausenzeitData = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_pause_min: 8, max_pause_min: 12, pause_count: 14, ist_ausreisser: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_pause_min: 22, max_pause_min: 35, pause_count: 9, ist_ausreisser: true },
    { driver_id: 'd3', name: 'Tom B.', avg_pause_min: 6, max_pause_min: 10, pause_count: 18, ist_ausreisser: false },
  ],
  ausreisser_count: 1,
  alert_ausreisser: false,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase2026PausenzeitUebersichtsWidget({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<PausenzeitData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-pausenzeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const d = data;
  const maxAvg = d ? Math.max(1, ...d.fahrer.map(f => f.avg_pause_min)) : 1;

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Fahrer-Pausenzeiten (7 Tage)</span>
        {d?.alert_ausreisser && (
          <span className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> {d.ausreisser_count} Ausreißer
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {d?.alert_ausreisser && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300">
                {d.ausreisser_count} Fahrer mit überdurchschnittlichen Pausen (&gt;20 Min Ø)
              </span>
            </div>
          )}

          {!d ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Pausendaten…</p>
          ) : d.fahrer.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Keine Daten verfügbar.</p>
          ) : (
            <div className="space-y-2">
              {d.fahrer.map(f => {
                const pct = Math.round((f.avg_pause_min / maxAvg) * 100);
                return (
                  <div key={f.driver_id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {f.ist_ausreisser && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">{f.name}</span>
                      </div>
                      <span className={cn(
                        'text-[10px] font-bold tabular-nums',
                        f.ist_ausreisser ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        Ø {f.avg_pause_min} Min
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          f.ist_ausreisser ? 'bg-amber-400' : 'bg-matcha-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-1 grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className="text-sm font-black text-foreground">
                    {d.fahrer.length > 0
                      ? Math.round(d.fahrer.reduce((s, f) => s + f.avg_pause_min, 0) / d.fahrer.length)
                      : 0} Min
                  </div>
                  <div className="text-[9px] text-muted-foreground">Team-Ø Pause</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className={cn(
                    'text-sm font-black',
                    d.ausreisser_count > 3 ? 'text-red-600' : d.ausreisser_count > 0 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {d.ausreisser_count}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Ausreißer</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
