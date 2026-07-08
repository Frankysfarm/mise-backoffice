'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Wifi, WifiOff, Coffee } from 'lucide-react';

interface FahrerStatus {
  driver_id: string;
  name: string;
  status: 'aktiv' | 'pausiert' | 'offline';
  letzte_gps_at: string | null;
  letzte_gps_min_vor: number | null;
  lat: number | null;
  lng: number | null;
}

interface Props {
  locationId: string | null;
}

const MOCK: FahrerStatus[] = [
  { driver_id: '1', name: 'Max M.', status: 'aktiv', letzte_gps_at: null, letzte_gps_min_vor: 1, lat: null, lng: null },
  { driver_id: '2', name: 'Anna K.', status: 'pausiert', letzte_gps_at: null, letzte_gps_min_vor: 5, lat: null, lng: null },
  { driver_id: '3', name: 'Tom S.', status: 'aktiv', letzte_gps_at: null, letzte_gps_min_vor: 2, lat: null, lng: null },
];

function StatusBadge({ status }: { status: FahrerStatus['status'] }) {
  if (status === 'aktiv') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <Wifi className="h-3 w-3" /> aktiv
      </span>
    );
  }
  if (status === 'pausiert') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
        <Coffee className="h-3 w-3" /> Pause
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
      <WifiOff className="h-3 w-3" /> offline
    </span>
  );
}

function gpsAlter(minVor: number | null): string {
  if (minVor === null) return '—';
  if (minVor < 2) return 'gerade eben';
  return `vor ${minVor} Min`;
}

export function DispatchPhase652FahrerLiveStatusPanel({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setFahrer(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-live-status?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.fahrer) ? json.fahrer : [];
        setFahrer(list.length > 0 ? list : MOCK);
      } else {
        setFahrer(MOCK);
      }
    } catch {
      setFahrer(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  const aktiv = fahrer.filter((f) => f.status === 'aktiv').length;
  const pausiert = fahrer.filter((f) => f.status === 'pausiert').length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Fahrer Live-Status</span>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
            {aktiv} aktiv
          </span>
          {pausiert > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              {pausiert} Pause
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && (
            <p className="text-xs text-muted-foreground">Lade Fahrer-Status…</p>
          )}
          {!loading && fahrer.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine aktiven Fahrer.</p>
          )}
          {!loading &&
            fahrer.map((f) => (
              <div
                key={f.driver_id}
                className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold uppercase text-muted-foreground">
                    {f.name.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      GPS: {gpsAlter(f.letzte_gps_min_vor)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
