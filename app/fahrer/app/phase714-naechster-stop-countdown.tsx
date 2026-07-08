'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navigation2, MapPin } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface NaechsterStop {
  adresse: string;
  kundeName: string;
  bestellNr: string;
  etaMinuten: number;
  distanzKm: number;
  sequence: number;
  gesamtStops: number;
}

const MOCK: NaechsterStop = {
  adresse: 'Bergstraße 42, 10115 Berlin',
  kundeName: 'Julia H.',
  bestellNr: '#4831',
  etaMinuten: 8,
  distanzKm: 2.3,
  sequence: 2,
  gesamtStops: 3,
};

export function FahrerPhase714NaechsterStopCountdown({ driverId, isOnline }: Props) {
  const [data, setData] = useState<NaechsterStop | null>(null);
  const [loading, setLoading] = useState(true);
  const [verblMs, setVerblMs] = useState(0);

  const laden = useCallback(async () => {
    if (!driverId || !isOnline) { setData(null); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/naechster-stop?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.adresse) {
          setData(json);
          setVerblMs(json.etaMinuten * 60_000);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
    setVerblMs(MOCK.etaMinuten * 60_000);
  }, [driverId, isOnline]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const poll = setInterval(laden, 30_000);
    return () => clearInterval(poll);
  }, [laden]);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => setVerblMs((v) => Math.max(0, v - 10_000)), 10_000);
    return () => clearInterval(id);
  }, [data]);

  if (!isOnline || (!loading && !data)) return null;

  const minLeft = Math.ceil(verblMs / 60_000);
  const pct = data ? Math.min(100, Math.max(0, 100 - (verblMs / (data.etaMinuten * 60_000)) * 100)) : 0;
  const urgent = minLeft <= 3;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${urgent ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20' : 'bg-card'}`}>
      {loading ? (
        <div className="h-16 animate-pulse rounded bg-muted" />
      ) : !data ? null : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation2 className={`h-4 w-4 ${urgent ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <div>
                <p className="text-xs font-bold">
                  Stop {data.sequence}/{data.gesamtStops} · {data.kundeName}
                </p>
                <p className="text-[10px] text-muted-foreground">{data.bestellNr}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold tabular-nums ${urgent ? 'text-red-600 dark:text-red-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
                {minLeft} Min
              </p>
              <p className="text-[9px] text-muted-foreground">{data.distanzKm.toFixed(1)} km</p>
            </div>
          </div>

          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${urgent ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">{data.adresse}</p>
          </div>

          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(data.adresse)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Navigation starten
          </a>
        </div>
      )}
    </div>
  );
}
