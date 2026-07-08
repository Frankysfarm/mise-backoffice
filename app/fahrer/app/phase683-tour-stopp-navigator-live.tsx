'use client';

/**
 * Phase 683 — Tour-Stopp-Navigator Live
 * Zeigt alle aktuellen Stopps der laufenden Tour mit Status, Entfernung und direkter Navigation.
 * Props: driverId, locationId
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Check, Clock, Navigation2, Package, ChevronDown, ChevronUp } from 'lucide-react';

type TourStop = {
  id: string;
  stop_nr?: number;
  kunde_name?: string;
  adresse?: string;
  address?: string;
  geliefert_am?: string | null;
  eta_min?: number | null;
  distance_km?: number | null;
};

type TourData = {
  batchId: string;
  driverName: string;
  stops: TourStop[];
  startedAt?: string;
  totalEtaMin?: number | null;
};

export function FahrerPhase683TourStoppNavigatorLive({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [tour, setTour] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTour = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/active-tour?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json() as { batch?: TourData; stops?: TourStop[] };
      if (data.batch) setTour({ ...data.batch, stops: data.stops ?? data.batch.stops ?? [] });
    } catch {
      // API not available — zeige nichts
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    loadTour();
    const id = setInterval(loadTour, 30_000);
    return () => clearInterval(id);
  }, [loadTour]);

  if (!tour || tour.stops.length === 0) return null;

  const sortedStops = [...tour.stops].sort((a, b) => (a.stop_nr ?? 0) - (b.stop_nr ?? 0));
  const deliveredCount = sortedStops.filter((s) => s.geliefert_am).length;
  const nextStop = sortedStops.find((s) => !s.geliefert_am);

  const handleNavigate = (stop: TourStop) => {
    const query = encodeURIComponent(stop.adresse ?? stop.address ?? '');
    if (!query) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank', 'noopener');
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm">Tour-Stopps</span>
          <span className="text-xs text-muted-foreground">
            {deliveredCount}/{sortedStops.length} erledigt
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {sortedStops.map((stop, idx) => {
            const isDone = !!stop.geliefert_am;
            const isCurrent = stop.id === nextStop?.id;
            return (
              <div
                key={stop.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition',
                  isDone && 'opacity-50',
                  isCurrent && 'bg-blue-50 dark:bg-blue-950/20',
                )}
              >
                {/* Stopp-Nummer / Status */}
                <div className={cn(
                  'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black border-2',
                  isDone
                    ? 'bg-matcha-500 border-matcha-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-background border-muted-foreground/40 text-muted-foreground',
                )}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold truncate', isCurrent && 'text-blue-700 dark:text-blue-300')}>
                    {stop.kunde_name ?? `Stopp ${idx + 1}`}
                  </p>
                  {(stop.adresse ?? stop.address) && (
                    <p className="text-xs text-muted-foreground truncate">
                      <MapPin className="inline h-3 w-3 mr-0.5" />
                      {stop.adresse ?? stop.address}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    {stop.eta_min != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{stop.eta_min} Min
                      </span>
                    )}
                    {stop.distance_km != null && (
                      <span className="text-xs text-muted-foreground">
                        {stop.distance_km.toFixed(1)} km
                      </span>
                    )}
                    {isDone && stop.geliefert_am && (
                      <span className="text-xs text-matcha-600 dark:text-matcha-400 font-bold">
                        Geliefert {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation-Button */}
                {!isDone && (stop.adresse ?? stop.address) && (
                  <button
                    onClick={() => handleNavigate(stop)}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                      isCurrent
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    <Navigation2 className="h-3.5 w-3.5" />
                    Navi
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
