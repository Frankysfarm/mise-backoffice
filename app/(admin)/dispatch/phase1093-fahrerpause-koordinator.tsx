'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Coffee, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1090/1093 — Fahrerpause-Koordinator (Dispatch)
// Koordiniert Pausen so dass min. 2 Fahrer je Zone immer aktiv bleiben

interface PausenEmpfehlung {
  fahrer_id: string;
  fahrer_name: string;
  zone: string;
  schicht_dauer_min: number;
  letzte_pause_vor_min: number | null;
  pause_empfohlen: boolean;
  pause_moeglich: boolean;
  empfehlung: string;
}

interface ZoneStatus {
  zone: string;
  aktive_fahrer: number;
  auf_pause: number;
  min_erfullt: boolean;
}

interface ApiData {
  empfehlungen: PausenEmpfehlung[];
  zonen: ZoneStatus[];
  generiert_am: string;
}

function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DispatchPhase1093FahrerPauseKoordinator({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrerpause-koordinator?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 5 * 60_000); // 5-min polling
    return () => clearInterval(id);
  }, [load]);

  const needPause = data?.empfehlungen.filter(e => e.pause_empfohlen) ?? [];
  const blockiert = needPause.filter(e => !e.pause_moeglich);
  const zonenKritisch = data?.zonen.filter(z => !z.min_erfullt) ?? [];

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      blockiert.length > 0 ? 'border-red-400' : needPause.length > 0 ? 'border-amber-400' : 'border-teal-300'
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 transition',
          blockiert.length > 0
            ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/50'
            : needPause.length > 0
            ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/50'
            : 'bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100/50'
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Coffee className={cn('h-4 w-4', blockiert.length > 0 ? 'text-red-600' : needPause.length > 0 ? 'text-amber-600' : 'text-teal-600')} />
          <span className="text-sm font-bold">Fahrerpause-Koordinator</span>
          {needPause.length > 0 && (
            <span className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
              blockiert.length > 0 ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'
            )}>
              {needPause.length} Pause fällig
              {blockiert.length > 0 && ` · ${blockiert.length} blockiert`}
            </span>
          )}
          {zonenKritisch.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              Zone {zonenKritisch.map(z => z.zone).join('/')} unter Minimum
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="bg-white dark:bg-background">
          {/* Zone status row */}
          {data && (
            <div className="px-4 py-2 border-b border-muted flex flex-wrap gap-2">
              {data.zonen.map(z => (
                <span
                  key={z.zone}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    z.min_erfullt
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                  )}
                >
                  Zone {z.zone}: {z.aktive_fahrer} aktiv
                  {z.auf_pause > 0 && ` · ${z.auf_pause} Pause`}
                  {!z.min_erfullt && ' ⚠ <Min.'}
                </span>
              ))}
            </div>
          )}

          {/* Driver list */}
          {!data && !loading && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Kein Standort ausgewählt</p>
          )}
          {data && data.empfehlungen.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground text-center">Keine Fahrer aktiv</p>
          )}
          <div className="divide-y divide-muted">
            {data?.empfehlungen.map(e => (
              <div
                key={e.fahrer_id}
                className={cn(
                  'px-4 py-3 flex flex-col gap-1',
                  e.pause_empfohlen && !e.pause_moeglich ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {e.pause_empfohlen ? (
                      <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', e.pause_moeglich ? 'text-amber-500' : 'text-red-600')} />
                    ) : (
                      <Coffee className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                    )}
                    <span className="text-sm font-semibold">{e.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground">Zone {e.zone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Schicht: {durationLabel(e.schicht_dauer_min)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {e.letzte_pause_vor_min !== null
                      ? `Letzte Pause vor ${durationLabel(e.letzte_pause_vor_min)}`
                      : 'Noch keine Pause heute'}
                  </span>
                  <span className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    e.pause_empfohlen && !e.pause_moeglich
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : e.pause_empfohlen
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-green-50 border-green-300 text-green-700'
                  )}>
                    {e.empfehlung}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
