'use client';

import { useEffect, useRef, useState } from 'react';
import { Bike, MapPin, Clock, CheckCircle2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingData = {
  driver_lat?: number;
  driver_lng?: number;
  driver_name?: string;
  eta_min?: number;
  distance_m?: number;
  status?: string;
};

type Props = {
  orderId: string;
  estimatedMin: number | null;
  orderStatus: string;
};

const RING_RADIUS = 52;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const DASH_ARRAY = '8 6';

function statusLabel(status: string): string {
  switch (status) {
    case 'bestätigt':
    case 'neu':
      return 'Bestellung wird vorbereitet…';
    case 'in_zubereitung':
      return 'Wird gerade gekocht 🍳';
    case 'fertig':
      return 'Wartet auf Fahrer…';
    case 'unterwegs':
      return 'Fahrer ist unterwegs 🚴';
    case 'geliefert':
      return 'Geliefert! ✅';
    default:
      return 'Bestellung wird vorbereitet…';
  }
}

function ringProgress(status: string): number {
  switch (status) {
    case 'neu':
      return 0.1;
    case 'bestätigt':
      return 0.2;
    case 'in_zubereitung':
      return 0.45;
    case 'fertig':
      return 0.65;
    case 'unterwegs':
      return 0.85;
    case 'geliefert':
      return 1;
    default:
      return 0.1;
  }
}

function ringStroke(status: string): string {
  if (status === 'geliefert') return '#4caf73';
  if (status === 'unterwegs') return '#3d9e65';
  if (status === 'fertig') return '#6bbf84';
  return '#a3cfb0';
}

export function LiveFahrerProximityRing({ orderId, estimatedMin, orderStatus }: Props) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTracking() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/tracking`, { cache: 'no-store' });
        if (!res.ok) throw new Error('non-ok');
        const json: TrackingData = await res.json();
        if (!cancelled) {
          setTracking(json);
          setFetchError(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFetchError(true);
          setLoading(false);
        }
      }
    }

    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 15_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId]);

  const effectiveStatus = tracking?.status ?? orderStatus;
  const effectiveEta = tracking?.eta_min ?? estimatedMin;
  const isEnRoute = effectiveStatus === 'unterwegs';
  const isDelivered = effectiveStatus === 'geliefert';

  const progress = ringProgress(effectiveStatus);
  const solidDashOffset = RING_CIRC * (1 - progress);
  const stroke = ringStroke(effectiveStatus);

  const etaText =
    effectiveEta != null
      ? effectiveEta < 2
        ? 'Gleich da!'
        : `~${effectiveEta} Min`
      : null;

  const distanceText =
    tracking?.distance_m != null
      ? tracking.distance_m < 500
        ? '< 500 m entfernt'
        : `~${Math.round(tracking.distance_m)} m entfernt`
      : null;

  const driverName = tracking?.driver_name ?? null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-b from-stone-50 to-white border border-stone-100 shadow-lg px-8 py-8">
        <div className="relative">
          <svg width="128" height="128" className="animate-spin" style={{ animationDuration: '3s' }}>
            <circle
              cx="64" cy="64" r={RING_RADIUS}
              fill="none"
              stroke="#e7f0ea"
              strokeWidth="6"
            />
            <circle
              cx="64" cy="64" r={RING_RADIUS}
              fill="none"
              stroke="#c8dece"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="20 100"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Bike className="h-8 w-8 text-stone-300" />
          </div>
        </div>
        <p className="text-sm font-semibold text-stone-400">Live-Tracking lädt…</p>
      </div>
    );
  }

  if (fetchError && !tracking) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-b from-stone-50 to-white border border-stone-100 shadow-lg px-8 py-8">
        <div className="relative">
          <svg width="128" height="128">
            <circle cx="64" cy="64" r={RING_RADIUS} fill="none" stroke="#f0ede8" strokeWidth="6" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Navigation className="h-8 w-8 text-stone-300" />
          </div>
        </div>
        <p className="text-sm font-semibold text-stone-400">Live-Tracking lädt…</p>
        <p className="text-xs text-stone-300">{statusLabel(orderStatus)}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes mise-ring-spin {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
        @keyframes mise-bike-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.18); opacity: 0.85; }
        }
        @keyframes mise-ring-dash {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -${RING_CIRC}px; }
        }
        .mise-dashed-ring {
          animation: mise-ring-dash 8s linear infinite;
        }
        .mise-bike-pulse {
          animation: mise-bike-pulse 1.4s ease-in-out infinite;
        }
      `}</style>

      <div className={cn(
        'relative flex flex-col items-center gap-5 rounded-3xl shadow-lg px-8 py-8 transition-all duration-500',
        isDelivered
          ? 'bg-gradient-to-b from-matcha-50 to-white border-2 border-matcha-300'
          : isEnRoute
          ? 'bg-gradient-to-b from-emerald-50 via-white to-stone-50 border-2 border-emerald-200'
          : 'bg-gradient-to-b from-stone-50 to-white border border-stone-100',
      )}>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg
            width="128"
            height="128"
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="64" cy="64" r={RING_RADIUS}
              fill="none"
              stroke="#f0ede8"
              strokeWidth="6"
            />

            {isEnRoute && (
              <circle
                cx="64" cy="64" r={RING_RADIUS}
                fill="none"
                stroke="#c8dece"
                strokeWidth="6"
                strokeDasharray={DASH_ARRAY}
                className="mise-dashed-ring"
              />
            )}

            <circle
              cx="64" cy="64" r={RING_RADIUS}
              fill="none"
              stroke={stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={solidDashOffset}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }}
            />
          </svg>

          <div className="relative flex flex-col items-center justify-center z-10">
            {isDelivered ? (
              <CheckCircle2 className="h-10 w-10 text-matcha-500" />
            ) : (
              <Bike
                className={cn(
                  'h-10 w-10',
                  isEnRoute ? 'text-emerald-600 mise-bike-pulse' : 'text-stone-400',
                )}
              />
            )}
            {etaText && !isDelivered && (
              <span className={cn(
                'mt-1 text-[11px] font-black tabular-nums leading-none',
                isEnRoute
                  ? etaText === 'Gleich da!'
                    ? 'text-emerald-700'
                    : 'text-emerald-600'
                  : 'text-stone-500',
              )}>
                {etaText}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className={cn(
            'text-sm font-bold',
            isDelivered ? 'text-matcha-700' : isEnRoute ? 'text-emerald-700' : 'text-stone-600',
          )}>
            {statusLabel(effectiveStatus)}
          </p>

          {driverName && !isDelivered && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
              <Navigation className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Ihr Fahrer: <span className="text-stone-700 font-bold">{driverName}</span></span>
            </div>
          )}

          {distanceText && isEnRoute && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{distanceText}</span>
            </div>
          )}

          {!etaText && !isDelivered && estimatedMin != null && (
            <div className="flex items-center gap-1 text-xs text-stone-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>ca. {estimatedMin} Min Lieferzeit</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
