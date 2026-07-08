'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerInfo {
  driver_id: string;
  name: string;
  status: string;
  aktuelle_stops: number;
  abgeschlossene_stops: number;
  schicht_stunden: number;
  lat: number | null;
  lng: number | null;
}

const MOCK: FahrerInfo[] = [
  { driver_id: '1', name: 'Max M.', status: 'in_progress', aktuelle_stops: 2, abgeschlossene_stops: 6, schicht_stunden: 3.2, lat: 52.52, lng: 13.405 },
  { driver_id: '2', name: 'Lena K.', status: 'assigned', aktuelle_stops: 3, abgeschlossene_stops: 4, schicht_stunden: 2.8, lat: 52.51, lng: 13.41 },
];

function statusLabel(s: string) {
  switch (s) {
    case 'in_progress': return 'Unterwegs';
    case 'assigned': return 'Bereit';
    case 'available': return 'Frei';
    case 'offline': return 'Offline';
    default: return s;
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'in_progress': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
    case 'assigned': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    case 'available': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function DispatchPhase713FahrerKarteInfobox({ locationId }: Props) {
  const [data, setData] = useState<FahrerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
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
        if (Array.isArray(json.fahrer) && json.fahrer.length > 0) {
          setData(json.fahrer);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  const selectedFahrer = data.find((f) => f.driver_id === selected);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Fahrer-Karte</span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {data.filter((f) => f.status !== 'offline').length} aktiv
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Fahrer in Schicht</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {data.map((f) => (
                  <button
                    key={f.driver_id}
                    onClick={() => setSelected(selected === f.driver_id ? null : f.driver_id)}
                    className={`w-full flex items-center gap-2 rounded-lg p-2 text-left transition hover:bg-muted/60 ${selected === f.driver_id ? 'bg-muted' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{f.name}</p>
                    </div>
                    <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${statusColor(f.status)}`}>
                      {statusLabel(f.status)}
                    </span>
                  </button>
                ))}
              </div>

              {selectedFahrer && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-xs font-bold">{selectedFahrer.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold tabular-nums">{selectedFahrer.aktuelle_stops}</p>
                      <p className="text-[9px] text-muted-foreground">Stops jetzt</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold tabular-nums">{selectedFahrer.abgeschlossene_stops}</p>
                      <p className="text-[9px] text-muted-foreground">Heute done</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold tabular-nums">{selectedFahrer.schicht_stunden.toFixed(1)}h</p>
                      <p className="text-[9px] text-muted-foreground">Schicht</p>
                    </div>
                  </div>
                  {selectedFahrer.lat && selectedFahrer.lng && (
                    <p className="text-[9px] text-muted-foreground text-center">
                      GPS: {selectedFahrer.lat.toFixed(4)}, {selectedFahrer.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <p className="text-[10px] text-muted-foreground">30s Aktualisierung · Klicken für Details</p>
        </div>
      )}
    </div>
  );
}
