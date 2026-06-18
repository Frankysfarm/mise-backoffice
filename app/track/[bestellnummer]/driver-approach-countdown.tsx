'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Navigation2, MapPin, Clock, CheckCircle2, Zap } from 'lucide-react';

interface TrackingPayload {
  orderId: string;
  bestellnummer: string;
  status: string;
  etaLabel: string | null;
  geo: {
    distanceM: number | null;
    almostThere: boolean;
    etaMinRemaining: number | null;
    bearing: number | null;
  };
  driver: {
    lat: number | null;
    lng: number | null;
    heading: number | null;
    ageSec: number | null;
    fahrzeug: string | null;
    vorname: string | null;
  } | null;
  stopsBeforeMe: number;
}

interface Props {
  bestellnummer: string;
  initialStatus?: string | null;
  initialDriverLat?: number | null;
  initialDriverLng?: number | null;
  initialKundeLat?: number | null;
  initialKundeLng?: number | null;
  initialEtaMin?: number | null;
}

const ACTIVE_STATUSES = new Set(['unterwegs', 'out_for_delivery', 'picked_up']);

function distanceLabel(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

// Bar shrinks as driver closes in — full at 5 km, near-zero at ~0 m
function distancePct(m: number): number {
  return Math.min(100, Math.max(2, (m / 5000) * 100));
}

export function DriverApproachCountdown({
  bestellnummer,
  initialStatus,
  initialEtaMin,
}: Props) {
  const [payload, setPayload] = useState<TrackingPayload | null>(null);
  const [status, setStatus] = useState(initialStatus ?? null);
  // Local ETA tick: minutes remaining, decremented every 60 s
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const etaMinRef = useRef(etaMin);
  etaMinRef.current = etaMin;

  // Poll tracking API every 20 s
  useEffect(() => {
    if (status === 'geliefert') return;

    const poll = () => {
      fetch(`/api/delivery/tracking/${bestellnummer}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: TrackingPayload | null) => {
          if (!d) return;
          setPayload(d);
          setStatus(d.status);
          if (d.geo.etaMinRemaining != null) {
            setEtaMin(d.geo.etaMinRemaining);
          }
        })
        .catch(() => {});
    };

    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, [bestellnummer, status]);

  // Local per-minute tick to count down ETA between polls
  useEffect(() => {
    const iv = setInterval(() => {
      setEtaMin((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Delivered success state
  if (status === 'geliefert') {
    return (
      <div className="rounded-2xl border-2 border-matcha-300 bg-gradient-to-br from-matcha-50 to-white p-5 shadow-subtle animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-matcha-800">Zugestellt!</p>
            <p className="text-sm text-matcha-600">Deine Bestellung ist angekommen. Guten Appetit!</p>
          </div>
        </div>
      </div>
    );
  }

  // Hide when status not active
  if (!status || !ACTIVE_STATUSES.has(status)) return null;

  const geo = payload?.geo;
  const driver = payload?.driver;
  const stopsBeforeMe = payload?.stopsBeforeMe ?? 0;
  const distanceM = geo?.distanceM ?? null;
  const almostThere = geo?.almostThere ?? false;
  const driverName = driver?.vorname ?? null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-subtle overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 bg-matcha-700 px-4 py-3">
        <Bike className="h-5 w-5 text-matcha-200 animate-pulse" />
        <span className="font-display text-sm font-bold text-white tracking-wide">
          Auf dem Weg
          {driverName ? ` · ${driverName}` : ''}
        </span>
        <Navigation2 className="ml-auto h-4 w-4 text-matcha-300" />
      </div>

      <div className="space-y-4 p-4">
        {/* Almost there alert */}
        {almostThere && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 animate-in slide-in-from-top-1 duration-300">
            <Zap className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm font-bold text-amber-800">Fast da! Dein Fahrer ist gleich bei dir.</p>
          </div>
        )}

        {/* Distance indicator */}
        {distanceM != null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-matcha-700">
                <MapPin className="h-3.5 w-3.5" />
                <span className="font-semibold">Entfernung</span>
              </div>
              <span className="font-mono text-sm font-bold text-matcha-800 tabular-nums">
                {distanceLabel(distanceM)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-matcha-100">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${distancePct(distanceM)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-matcha-400">
              <span>Du</span>
              <span>5 km</span>
            </div>
          </div>
        )}

        {/* Stops before me */}
        {stopsBeforeMe > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-matcha-50 px-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-matcha-200 text-[10px] font-black text-matcha-800">
              {stopsBeforeMe}
            </span>
            <span className="text-xs text-matcha-700">
              {stopsBeforeMe === 1
                ? 'Noch 1 Haltepunkt vor dir'
                : `Noch ${stopsBeforeMe} Haltepunkte vor dir`}
            </span>
          </div>
        )}

        {/* ETA countdown */}
        {etaMin != null && etaMin > 0 && (
          <div className={cn(
            'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
            etaMin <= 3
              ? 'border-amber-300 bg-amber-50'
              : 'border-matcha-200 bg-matcha-50',
          )}>
            <Clock className={cn(
              'h-4 w-4 shrink-0',
              etaMin <= 3 ? 'text-amber-500' : 'text-matcha-600',
            )} />
            <div>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                etaMin <= 3 ? 'text-amber-600' : 'text-matcha-500',
              )}>
                Ankunft in ca.
              </p>
              <p className={cn(
                'font-mono text-lg font-black tabular-nums leading-tight',
                etaMin <= 3 ? 'text-amber-700' : 'text-matcha-800',
              )}>
                {etaMin} Min
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
