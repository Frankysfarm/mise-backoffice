'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';

interface Props {
  isOnline: boolean;
}

interface GpsStatus {
  accuracy: number | null;
  timestamp: number | null;
  error: string | null;
}

const ACCURACY_SCHWELLE = 50; // Meter
const STALE_SCHWELLE_S = 60; // Sekunden

export function FahrerPhase719GpsGenauigkeitsWarnung({ isOnline }: Props) {
  const [gps, setGps] = useState<GpsStatus>({ accuracy: null, timestamp: null, error: null });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOnline) return;
    if (!navigator.geolocation) {
      setGps({ accuracy: null, timestamp: null, error: 'GPS nicht verfügbar' });
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          error: null,
        });
      },
      (err) => {
        setGps({ accuracy: null, timestamp: null, error: err.message });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [isOnline]);

  if (!isOnline) return null;

  const staleMs = gps.timestamp ? now - gps.timestamp : null;
  const isSchwach = gps.accuracy !== null && gps.accuracy > ACCURACY_SCHWELLE;
  const isVeraltet = staleMs !== null && staleMs > STALE_SCHWELLE_S * 1_000;
  const hatFehler = !!gps.error;

  if (!hatFehler && !isSchwach && !isVeraltet && gps.accuracy !== null) return null;

  const isKritisch = hatFehler || (isSchwach && isVeraltet);

  return (
    <div className={`rounded-xl border p-3 ${isKritisch
      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
      : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20'
    }`}>
      <div className="flex items-center gap-2">
        {isKritisch ? (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
        ) : (
          <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${isKritisch ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {hatFehler
              ? `GPS-Fehler: ${gps.error}`
              : isVeraltet
              ? `GPS veraltet (${Math.round((staleMs ?? 0) / 1_000)}s)`
              : `GPS schwach (±${Math.round(gps.accuracy ?? 0)}m)`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {hatFehler
              ? 'Bitte GPS aktivieren oder in Freie bewegen'
              : 'Dispatch sieht ungenaue Position — bitte warten'}
          </p>
        </div>
        {gps.accuracy !== null && (
          <span className={`text-xs font-bold tabular-nums shrink-0 ${isSchwach ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            ±{Math.round(gps.accuracy)}m
          </span>
        )}
      </div>
    </div>
  );
}
