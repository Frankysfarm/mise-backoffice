'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ArrowRight, ChevronDown, ChevronUp, Navigation2, Clock } from 'lucide-react';

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
}

interface Props {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

function distanceKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMin(distKm: number, avgSpeedKmh = 25): number {
  return Math.max(1, Math.round((distKm / avgSpeedKmh) * 60));
}

export function TourStoppOptimierung({ stops, driverLat, driverLng }: Props) {
  const [open, setOpen] = useState(false);

  const pending = stops.filter(s => s.geliefert_am == null);
  const completed = stops.filter(s => s.geliefert_am != null);

  // Compute optimized order by proximity if we have coords
  const optimizedStops = useMemo(() => {
    if (!driverLat || !driverLng) return pending;

    const withDist = pending.map(s => {
      const lat = s.order.kunde_lat;
      const lng = s.order.kunde_lng;
      const dist = lat != null && lng != null
        ? distanceKm(driverLat!, driverLng!, lat, lng)
        : 999;
      return { stop: s, dist };
    });
    withDist.sort((a, b) => a.dist - b.dist);
    return withDist.map(w => w.stop);
  }, [pending, driverLat, driverLng]);

  const isOptimized =
    driverLat != null &&
    driverLng != null &&
    optimizedStops.length > 1 &&
    optimizedStops[0].reihenfolge !== pending[0]?.reihenfolge;

  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/20 transition"
      >
        <Navigation2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Stopp-Sequenz</span>
        {isOptimized && (
          <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            Optimiert
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {completed.length}/{stops.length} erledigt
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Progress strip always visible */}
      <div className="px-4 pb-2">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${stops.length > 0 ? (completed.length / stops.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {open && (
        <div className="border-t divide-y">
          {optimizedStops.map((stop, idx) => {
            const lat = stop.order.kunde_lat;
            const lng = stop.order.kunde_lng;
            const prevStop = idx > 0 ? optimizedStops[idx - 1] : null;
            const prevLat = prevStop?.order.kunde_lat ?? driverLat;
            const prevLng = prevStop?.order.kunde_lng ?? driverLng;

            let distToThis: number | null = null;
            if (lat != null && lng != null && prevLat != null && prevLng != null) {
              distToThis = distanceKm(prevLat, prevLng, lat, lng);
            }
            const eta = distToThis != null ? etaMin(distToThis) : null;

            return (
              <div
                key={stop.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3',
                  idx === 0 ? 'bg-matcha-50' : 'bg-white',
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                    idx === 0
                      ? 'bg-matcha-600 text-white'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {idx + 1}
                </div>

                {/* Stop info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">#{stop.order.bestellnummer}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {stop.order.kunde_name}
                    </span>
                  </div>
                  {stop.order.kunde_adresse && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        {[stop.order.kunde_plz, stop.order.kunde_adresse].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                  {stop.order.kunde_lieferhinweis && (
                    <div className="mt-0.5 text-[10px] text-amber-600 truncate">
                      ⚠ {stop.order.kunde_lieferhinweis}
                    </div>
                  )}
                </div>

                {/* ETA */}
                {eta != null && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground tabular-nums">
                      <Clock className="h-3 w-3" />
                      ~{eta} Min
                    </div>
                    {distToThis != null && (
                      <div className="text-[9px] text-muted-foreground">
                        {distToThis < 1 ? `${Math.round(distToThis * 1000)}m` : `${distToThis.toFixed(1)}km`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {completed.length > 0 && (
            <div className="px-4 py-2 bg-muted/20">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Erledigt ({completed.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {completed.map(stop => (
                  <span
                    key={stop.id}
                    className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700"
                  >
                    ✓ #{stop.order.bestellnummer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
