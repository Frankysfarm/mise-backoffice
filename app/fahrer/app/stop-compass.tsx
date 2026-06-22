'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Clock, ChevronRight, Phone, CheckCircle2 } from 'lucide-react';

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order?: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_telefon: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    zahlungsart?: string;
    bezahlt?: boolean;
    gesamtbetrag?: number;
  } | null;
}

interface Props {
  currentStop: Stop | null;
  nextStop: Stop | null;
  driverLat?: number | null;
  driverLng?: number | null;
  onNavigate?: (stop: Stop) => void;
  onComplete?: (stop: Stop) => void;
}

function calcBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function calcDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function CompassArrow({ bearing, className }: { bearing: number; className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: `rotate(${bearing}deg)`, transition: 'transform 0.8s ease' }}>
        <circle cx="40" cy="40" r="38" fill="none" stroke="#e5e7eb" strokeWidth="2" />
        <circle cx="40" cy="40" r="30" fill="none" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
        {/* North indicator */}
        <text x="40" y="12" textAnchor="middle" fontSize="8" fill="#9ca3af" fontWeight="bold">N</text>
        {/* Arrow pointing to destination */}
        <polygon points="40,6 34,32 40,26 46,32" fill="#2d6b45" />
        <polygon points="40,74 34,48 40,54 46,48" fill="#d1fae5" />
        {/* Center dot */}
        <circle cx="40" cy="40" r="4" fill="#2d6b45" />
      </svg>
    </div>
  );
}

export function StopCompass({ currentStop, nextStop, driverLat, driverLng, onNavigate, onComplete }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const stop = currentStop ?? nextStop;
  if (!stop) return null;

  const stopLat = stop.order?.kunde_lat;
  const stopLng = stop.order?.kunde_lng;

  const { bearing, distanceM } = useMemo(() => {
    if (!driverLat || !driverLng || !stopLat || !stopLng) return { bearing: 0, distanceM: null };
    return {
      bearing: calcBearing(driverLat, driverLng, stopLat, stopLng),
      distanceM: calcDistanceM(driverLat, driverLng, stopLat, stopLng),
    };
  }, [driverLat, driverLng, stopLat, stopLng]);

  const distanceLabel = distanceM === null
    ? null
    : distanceM < 1000
      ? `${Math.round(distanceM)} m`
      : `${(distanceM / 1000).toFixed(1)} km`;

  const isCurrentActive = !!currentStop && !currentStop.geliefert_am;
  const isCollecting = !!currentStop?.angekommen_am && !currentStop.geliefert_am;

  const cashOnDelivery =
    stop.order?.zahlungsart === 'bar' && !stop.order?.bezahlt;

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      isCurrentActive ? 'border-matcha-400 bg-matcha-50' : 'border-border bg-white',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5',
        isCurrentActive ? 'bg-matcha-600 text-white' : 'bg-muted/40',
      )}>
        <Navigation className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          {isCollecting ? 'Übergabe läuft' : isCurrentActive ? 'Aktueller Stop' : 'Nächster Stop'}
        </span>
        <span className="text-[10px] font-bold opacity-75">
          Stop {stop.reihenfolge}
        </span>
      </div>

      <div className="p-4 flex gap-4 items-center">
        {/* Compass */}
        <div className="shrink-0 w-20 h-20">
          <CompassArrow bearing={bearing} className="w-20 h-20" />
        </div>

        {/* Stop info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-foreground truncate">
            {stop.order?.kunde_name ?? 'Kunde'}
          </div>
          <div className="flex items-start gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-[11px] text-muted-foreground leading-tight">
              {stop.order?.kunde_adresse ?? 'Adresse nicht verfügbar'}
            </span>
          </div>
          {distanceLabel && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-lg font-black tabular-nums text-matcha-700">
                {distanceLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">entfernt</span>
            </div>
          )}
          {cashOnDelivery && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Barzahlung: {((stop.order?.gesamtbetrag ?? 0) / 100).toFixed(2)} €
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        {stop.order?.kunde_telefon && (
          <a
            href={`tel:${stop.order.kunde_telefon}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white py-2.5 text-xs font-bold text-foreground hover:bg-muted/40 transition-all"
          >
            <Phone className="h-3.5 w-3.5" />
            Anrufen
          </a>
        )}
        {onNavigate && stopLat && stopLng && (
          <button
            onClick={() => onNavigate(stop)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all"
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigation
          </button>
        )}
        {onComplete && isCurrentActive && (
          <button
            onClick={() => onComplete(stop)}
            className={cn(
              'col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black text-white transition-all',
              isCollecting ? 'bg-matcha-600 hover:bg-matcha-700' : 'bg-matcha-400 hover:bg-matcha-500',
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isCollecting ? 'Lieferung bestätigen' : 'Angekommen'}
          </button>
        )}
      </div>

      {/* Next stop preview */}
      {nextStop && currentStop && nextStop.id !== currentStop.id && (
        <div className="border-t px-4 py-2.5 flex items-center gap-2 bg-muted/20">
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground">Danach:</span>
          <span className="text-[10px] font-bold text-foreground truncate">
            {nextStop.order?.kunde_name ?? 'Nächster Kunde'}
          </span>
          <Clock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
          <span className="text-[10px] text-muted-foreground">Stop {nextStop.reihenfolge}</span>
        </div>
      )}
    </div>
  );
}
