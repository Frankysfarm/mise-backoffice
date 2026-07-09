'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, Bike, Clock } from 'lucide-react';

/**
 * Phase 993 — Fahrer-Status-Matrix (Dispatch)
 *
 * Kompakte Grid-Ansicht aller Fahrer: Online/Pause/Offline
 * + Zone + verbleibende Stopps + ETR. 90s-Polling.
 */

interface FahrerStatus {
  fahrer_id: string;
  name: string;
  status: 'online' | 'pause' | 'offline';
  zone: string | null;
  verbleibende_stopps: number;
  etr_min: number | null;
  fahrzeug: string;
}

interface ApiResponse {
  fahrer: FahrerStatus[];
  online: number;
  pause: number;
  offline: number;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', name: 'M. Bauer', status: 'online', zone: 'A', verbleibende_stopps: 2, etr_min: 14, fahrzeug: '🚲' },
    { fahrer_id: 'f2', name: 'L. Huber', status: 'online', zone: 'B', verbleibende_stopps: 3, etr_min: 21, fahrzeug: '🛵' },
    { fahrer_id: 'f3', name: 'K. Stein', status: 'pause', zone: null, verbleibende_stopps: 0, etr_min: null, fahrzeug: '🚗' },
    { fahrer_id: 'f4', name: 'A. König', status: 'offline', zone: null, verbleibende_stopps: 0, etr_min: null, fahrzeug: '🚲' },
    { fahrer_id: 'f5', name: 'S. Weber', status: 'online', zone: 'C', verbleibende_stopps: 1, etr_min: 7, fahrzeug: '🛵' },
  ],
  online: 3,
  pause: 1,
  offline: 1,
  generiert_am: new Date().toISOString(),
};

function statusStyle(status: FahrerStatus['status']): { dot: string; badge: string; text: string; label: string } {
  switch (status) {
    case 'online': return { dot: 'bg-matcha-500', badge: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700', text: 'text-matcha-700 dark:text-matcha-300', label: 'Online' };
    case 'pause': return { dot: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', label: 'Pause' };
    case 'offline': return { dot: 'bg-zinc-400', badge: 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700', text: 'text-zinc-500', label: 'Offline' };
  }
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase993FahrerStatusMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const url = locationId
          ? `/api/delivery/admin/fahrer-status-matrix?location_id=${locationId}`
          : '/api/delivery/admin/fahrer-status-matrix';
        const res = await fetch(url);
        if (res.ok && mounted) {
          const json = await res.json() as ApiResponse;
          setData(json);
        }
      } catch {
        if (mounted) setData(MOCK);
      }
    };

    load();
    const iv = setInterval(load, 90_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-bold text-sm">Fahrer-Status-Matrix</span>
          <span className="text-[10px] rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 font-bold">
            {d.online} online
          </span>
          {d.pause > 0 && (
            <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold">
              {d.pause} Pause
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{d.fahrer.length} Fahrer</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {d.fahrer.map(f => {
              const st = statusStyle(f.status);
              return (
                <div key={f.fahrer_id} className={cn('rounded-lg border p-3 transition', st.badge)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot, f.status === 'online' && 'animate-pulse')} />
                    <span className="text-sm font-bold truncate">{f.fahrzeug} {f.name}</span>
                    <span className={cn('ml-auto text-[10px] font-bold shrink-0', st.text)}>{st.label}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    {f.zone && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        Zone <span className="font-bold text-foreground ml-0.5">{f.zone}</span>
                      </span>
                    )}
                    {f.verbleibende_stopps > 0 && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <Bike className="h-3 w-3" />
                        <span className="font-bold text-foreground">{f.verbleibende_stopps}</span> Stopps
                      </span>
                    )}
                    {f.etr_min !== null && (
                      <span className="flex items-center gap-0.5 text-muted-foreground ml-auto">
                        <Clock className="h-3 w-3" />
                        <span className="font-bold text-foreground tabular-nums">{f.etr_min}</span> Min
                      </span>
                    )}
                    {f.status !== 'online' && !f.zone && (
                      <span className="text-muted-foreground italic">Keine Tour</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {d.fahrer.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">Keine Fahrer aktiv.</div>
          )}
        </div>
      )}
    </div>
  );
}
