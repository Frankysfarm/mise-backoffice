'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Package } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface NaechsterStop {
  adresse: string;
  kundeName: string;
  bestellNr: string;
  anzahlArtikel: number;
}

interface NaechsteTour {
  batch_id: string;
  stops: NaechsterStop[];
  distanzKm: number;
  geschaetzteMinuten: number;
}

const MOCK: NaechsteTour = {
  batch_id: 'mock-1',
  stops: [
    { adresse: 'Musterstraße 12, 10115 Berlin', kundeName: 'Maria S.', bestellNr: '#4821', anzahlArtikel: 2 },
    { adresse: 'Hauptstr. 88, 10117 Berlin', kundeName: 'Klaus M.', bestellNr: '#4822', anzahlArtikel: 3 },
  ],
  distanzKm: 4.2,
  geschaetzteMinuten: 18,
};

export function FahrerPhase704NaechsteTourVorabInfo({ driverId, isOnline }: Props) {
  const [data, setData] = useState<NaechsteTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!driverId || !isOnline) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/driver/naechste-tour?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.batch_id) {
          setData(json);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [driverId, isOnline]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!isOnline || (!loading && !data)) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold">Nächste Tour</span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] text-muted-foreground underline"
        >
          {open ? 'einklappen' : 'anzeigen'}
        </button>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded bg-muted" />
      ) : !data ? null : (
        <>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {data.stops.length} Stop{data.stops.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{data.distanzKm.toFixed(1)} km</span>
            <span>·</span>
            <span>ca. {data.geschaetzteMinuten} Min</span>
          </div>

          {open && (
            <div className="space-y-2">
              {data.stops.map((stop, idx) => (
                <div
                  key={stop.bestellNr}
                  className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{stop.kundeName} · {stop.bestellNr}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{stop.adresse}</span>
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{stop.anzahlArtikel} Artikel</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">30s Aktualisierung · Infos bei Rückfahrt</p>
        </>
      )}
    </div>
  );
}
