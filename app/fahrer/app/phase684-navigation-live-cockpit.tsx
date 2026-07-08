'use client';

/**
 * Phase 684 — Navigation Live Cockpit
 * Nächster Stopp mit prominenter Adresse, ETA-Countdown und drei Navi-App-Buttons.
 * Props: driverId, locationId
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Navigation2, MapPin, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

type NextStop = {
  kunde_name?: string;
  adresse?: string;
  address?: string;
  eta_min?: number | null;
  stop_nr?: number;
  total_stops?: number;
};

const NAVI_APPS = [
  {
    key: 'google',
    label: 'Google Maps',
    color: 'bg-blue-500 hover:bg-blue-600 text-white',
    url: (addr: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`,
  },
  {
    key: 'waze',
    label: 'Waze',
    color: 'bg-sky-400 hover:bg-sky-500 text-white',
    url: (addr: string) => `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`,
  },
  {
    key: 'apple',
    label: 'Apple Maps',
    color: 'bg-gray-700 hover:bg-gray-800 text-white',
    url: (addr: string) => `http://maps.apple.com/?daddr=${encodeURIComponent(addr)}`,
  },
];

function useCountdownSec(etaMin: number | null | undefined) {
  const [sec, setSec] = useState<number | null>(etaMin != null ? etaMin * 60 : null);
  useEffect(() => {
    if (etaMin == null) { setSec(null); return; }
    setSec(etaMin * 60);
    const id = setInterval(() => setSec((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [etaMin]);
  return sec;
}

function EtaDisplay({ etaMin }: { etaMin: number | null | undefined }) {
  const sec = useCountdownSec(etaMin);
  if (sec === null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const isUrgent = sec < 3 * 60;
  return (
    <div className={cn('text-center', isUrgent && 'animate-pulse')}>
      <div className={cn('text-4xl font-black tabular-nums', isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')}>
        {m}:{String(s).padStart(2, '0')}
      </div>
      <div className="text-xs text-muted-foreground">Min:Sek bis Ankunft</div>
    </div>
  );
}

export function FahrerPhase684NavigationLiveCockpit({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [nextStop, setNextStop] = useState<NextStop | null>(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(
        `/api/delivery/driver/next-stop?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json() as { stop?: NextStop; nextStop?: NextStop };
      const stop = data.stop ?? data.nextStop;
      if (stop) setNextStop(stop);
    } catch {
      // API nicht verfügbar
    }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  if (!nextStop) return null;

  const addr = nextStop.adresse ?? nextStop.address;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation2 className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm">Navigation</span>
          {nextStop.stop_nr != null && nextStop.total_stops != null && (
            <span className="text-xs text-muted-foreground">
              Stopp {nextStop.stop_nr} von {nextStop.total_stops}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4">
          {/* Kundenname */}
          {nextStop.kunde_name && (
            <div className="text-center">
              <p className="text-lg font-black">{nextStop.kunde_name}</p>
            </div>
          )}

          {/* Adresse */}
          {addr && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
              <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
              <span className="text-sm font-bold leading-tight">{addr}</span>
            </div>
          )}

          {/* ETA Countdown */}
          {nextStop.eta_min != null && (
            <div className="flex items-center gap-3 justify-center">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <EtaDisplay etaMin={nextStop.eta_min} />
            </div>
          )}

          {/* Navi-App Buttons */}
          {addr && (
            <div className="grid grid-cols-3 gap-2">
              {NAVI_APPS.map((app) => (
                <a
                  key={app.key}
                  href={app.url(addr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-bold transition',
                    app.color,
                  )}
                >
                  <ExternalLink className="h-4 w-4" />
                  {app.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
