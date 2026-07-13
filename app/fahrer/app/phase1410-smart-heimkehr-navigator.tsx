'use client';

/**
 * Phase 1410 — Smart Heimkehr Navigator
 *
 * Zeigt dem Fahrer nach dem letzten Stopp eine klare Heimkehr-Anzeige:
 * - "Alle Stopps erledigt" Banner
 * - Direkt-Navigationstasten (Google Maps / Apple Maps)
 * - Geschätzte Heimkehrzeit
 * - Kilometer-Abschluss-Info
 * - Motivations-Badge
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Home, Map, Navigation, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  geliefert_am: string | null;
  completed_at?: string | null;
  reihenfolge: number;
}

interface ActiveBatch {
  id: string;
  status: string;
  stops: Stop[];
}

interface Props {
  activeBatch: ActiveBatch | null;
  restaurantLat: number | null;
  restaurantLng: number | null;
  restaurantName?: string;
  driverPos?: { lat: number; lng: number } | null;
}

function mapsUrl(lat: number, lng: number, label?: string): string {
  const encoded = encodeURIComponent(label ?? `${lat},${lng}`);
  if (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function FahrerPhase1410SmartHeimkehrNavigator({
  activeBatch,
  restaurantLat,
  restaurantLng,
  restaurantName = 'Restaurant',
  driverPos,
}: Props) {
  const [, setTick] = useState(0);
  const [returnEtaMin, setReturnEtaMin] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Fetch return ETA from API
  useEffect(() => {
    if (!restaurantLat || !restaurantLng || !driverPos) return;
    fetch(`/api/delivery/admin/tour-rueckkehr-eta`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.eta_min) setReturnEtaMin(d.eta_min);
      })
      .catch(() => {
        // Estimate based on straight-line distance
        if (!driverPos || !restaurantLat || !restaurantLng) return;
        const R = 6371;
        const dLat = ((restaurantLat - driverPos.lat) * Math.PI) / 180;
        const dLng = ((restaurantLng - driverPos.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((driverPos.lat * Math.PI) / 180) * Math.cos((restaurantLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setReturnEtaMin(Math.round((dist / 25) * 60)); // 25 km/h city avg
      });
  }, [restaurantLat, restaurantLng, driverPos]);

  // Only show when all stops are completed
  if (!activeBatch) return null;
  const allDone = activeBatch.stops.length > 0 &&
    activeBatch.stops.every(s => s.geliefert_am || s.completed_at);
  if (!allDone) return null;

  const completedCount = activeBatch.stops.length;
  const now = new Date();
  const arrivalTime = returnEtaMin
    ? new Date(now.getTime() + returnEtaMin * 60_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-2xl border-2 border-matcha-300 bg-gradient-to-br from-matcha-50 to-white shadow-md overflow-hidden">
      {/* Success header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-600">
        <CheckCircle2 className="h-6 w-6 text-white shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm">Tour abgeschlossen!</div>
          <div className="text-matcha-200 text-xs">{completedCount} Stopp{completedCount !== 1 ? 's' : ''} erfolgreich geliefert</div>
        </div>
        <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
      </div>

      <div className="p-4 space-y-3">
        {/* Heimkehr info */}
        <div className="flex items-center gap-3 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2.5">
          <Home className="h-5 w-5 text-matcha-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-matcha-800">Zurück zu {restaurantName}</div>
            {returnEtaMin !== null ? (
              <div className="text-matcha-700 font-black text-sm">
                ~{returnEtaMin} Min
                {arrivalTime && <span className="font-normal text-xs text-matcha-600"> · Ankunft ca. {arrivalTime} Uhr</span>}
              </div>
            ) : (
              <div className="text-xs text-matcha-600">Route berechnen…</div>
            )}
          </div>
        </div>

        {/* Navigation buttons */}
        {restaurantLat && restaurantLng && (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mapsUrl(restaurantLat, restaurantLng, restaurantName)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-3 py-2.5 text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Map className="h-4 w-4" />
              Google Maps
            </a>
            <a
              href={wazeUrl(restaurantLat, restaurantLng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 text-white px-3 py-2.5 text-sm font-bold hover:bg-cyan-600 active:scale-95 transition-all"
            >
              <Navigation className="h-4 w-4" />
              Waze
            </a>
          </div>
        )}

        {/* Motivation chip */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-matcha-600">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-semibold">Super Leistung! Schicht-Ende nähert sich.</span>
        </div>
      </div>
    </div>
  );
}
