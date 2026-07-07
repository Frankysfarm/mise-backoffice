'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, ExternalLink, Compass } from 'lucide-react';

interface Props {
  driverId: string;
  nextStopAddress?: string | null;
  nextStopLat?: number | null;
  nextStopLng?: number | null;
  etaMin?: number | null;
}

function buildNavUrl(address: string): string {
  const query = encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=bicycling`;
}

export function FahrerPhase630NavigationLiveCockpit({
  driverId,
  nextStopAddress,
  nextStopLat,
  nextStopLng,
  etaMin,
}: Props) {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      () => {},
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!nextStopAddress) return null;

  const navUrl = buildNavUrl(nextStopAddress);

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wide">
          Navigation · Live
        </span>
        {etaMin !== null && etaMin !== undefined && (
          <span className="ml-auto rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 text-sm font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
            ~{etaMin} Min
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900/60 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60">
            <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
              Zieladresse
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug">
              {nextStopAddress}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 px-3 py-3 text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
          >
            <Navigation2 className="h-4 w-4" />
            Google Maps
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
          <a
            href={`waze://?ll=${nextStopLat ?? 0},${nextStopLng ?? 0}&navigate=yes`}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 dark:bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
          >
            <Navigation2 className="h-4 w-4" />
            Waze
          </a>
        </div>

        {etaMin !== null && etaMin !== undefined && (
          <div className="rounded-xl bg-white dark:bg-gray-900/40 border border-indigo-100 dark:border-indigo-900 px-4 py-3 text-center">
            <p className="text-3xl font-black tabular-nums text-indigo-700 dark:text-indigo-300">
              ~{etaMin}
              <span className="text-base font-semibold ml-1 text-indigo-500 dark:text-indigo-400">Min</span>
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">
              Geschätzte Fahrzeit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
