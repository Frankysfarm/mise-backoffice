'use client';

/**
 * Phase 565 — Fahrer: Tour-Heimkehr-Info
 *
 * Zeigt nach Abschluss aller Tour-Stopps eine Karte mit:
 *   - "Tour abgeschlossen!" Bestätigung
 *   - Geschätzte Rückfahrtzeit zum Restaurant
 *   - Kurzübersicht: Stopps, Dauer, ggf. Trinkgeld
 *   - Navigationsbutton zurück zur Basis
 *
 * Sichtbar wenn: activeBatch vorhanden + alle Stopps geliefert
 * Verschwindet sobald kein activeBatch mehr vorhanden
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Home, MapPin, Navigation, Timer } from 'lucide-react';

interface Stop {
  geliefert_am: string | null;
  order?: {
    kunde_lat?: number | null;
    kunde_lng?: number | null;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  started_at?: string | null;
  stops: Stop[];
}

interface Driver {
  location_id?: string | null;
}

interface Props {
  activeBatch: Batch | null;
  driver: Driver;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  restaurantName?: string;
}

function fmtDuration(startIso: string | null | undefined): string {
  if (!startIso) return '—';
  const minTotal = Math.round((Date.now() - new Date(startIso).getTime()) / 60_000);
  const h = Math.floor(minTotal / 60);
  const m = minTotal % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min`;
}

export function FahrerPhase565TourHeimkehrInfo({
  activeBatch,
  restaurantLat,
  restaurantLng,
  restaurantName = 'Restaurant',
}: Props) {
  const allDelivered = useMemo(() => {
    if (!activeBatch) return false;
    if (activeBatch.stops.length === 0) return false;
    return activeBatch.stops.every(s => s.geliefert_am !== null);
  }, [activeBatch]);

  if (!activeBatch || !allDelivered) return null;

  const completedCount = activeBatch.stops.length;
  const duration = fmtDuration(activeBatch.started_at);

  const handleNavigate = () => {
    if (restaurantLat && restaurantLng) {
      window.open(
        `https://maps.google.com/maps?q=${restaurantLat},${restaurantLng}`,
        '_blank',
      );
    }
  };

  return (
    <div className="mx-4 my-2 rounded-2xl overflow-hidden border-2 border-matcha-300 bg-matcha-50 shadow-sm">
      {/* Header */}
      <div className="bg-matcha-600 text-white px-4 py-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-black">Tour abgeschlossen!</div>
          <div className="text-[11px] text-matcha-100">
            {completedCount} {completedCount === 1 ? 'Lieferung' : 'Lieferungen'} erfolgreich
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-xl bg-white border border-matcha-200 p-3 text-center">
          <div className="text-xl font-black text-matcha-700 tabular-nums">{completedCount}</div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
            Stopps
          </div>
        </div>
        <div className="rounded-xl bg-white border border-matcha-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Timer className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="text-xl font-black text-blue-700 tabular-nums">{duration}</div>
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
            Tour-Dauer
          </div>
        </div>
      </div>

      {/* Return Info */}
      <div className="px-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-white border border-matcha-200 px-3 py-2">
          <Home className="h-4 w-4 text-matcha-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-foreground">Zurück zu {restaurantName}</div>
            <div className="text-[10px] text-muted-foreground">
              {restaurantLat && restaurantLng
                ? 'GPS-Navigation bereit'
                : 'Fahr sicher zurück'}
            </div>
          </div>
          {restaurantLat && restaurantLng && (
            <MapPin className="h-3 w-3 text-matcha-600 shrink-0" />
          )}
        </div>

        {restaurantLat && restaurantLng && (
          <button
            onClick={handleNavigate}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
              'bg-matcha-600 text-white text-sm font-bold',
              'hover:bg-matcha-700 active:bg-matcha-800 transition-colors',
            )}
          >
            <Navigation className="h-4 w-4" />
            Navigation starten
          </button>
        )}
      </div>
    </div>
  );
}
