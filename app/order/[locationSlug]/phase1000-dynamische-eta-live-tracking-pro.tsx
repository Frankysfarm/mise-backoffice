'use client';

import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Zap } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  driverName?: string | null;
  bestellnummer?: string | null;
}

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
  prepStartedAt: string | null;
  prepMin: number | null;
}

const STEPS: { keys: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { keys: ['neu', 'bestätigt'], label: 'Bestätigt', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { keys: ['in_zubereitung', 'fertig'], label: 'Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" /> },
  { keys: ['abgeholt', 'unterwegs'], label: 'Unterwegs', icon: <Bike className="h-3.5 w-3.5" /> },
  { keys: ['geliefert'], label: 'Geliefert', icon: <Package className="h-3.5 w-3.5" /> },
];

const STATUS_MSG: Partial<Record<OrderStatus, string>> = {
  neu: 'Deine Bestellung ist eingegangen.',
  bestätigt: 'Restaurant hat bestätigt!',
  in_zubereitung: 'Wird gerade zubereitet…',
  fertig: 'Fertig — Fahrer kommt gleich!',
  abgeholt: 'Fahrer hat abgeholt!',
  unterwegs: 'Dein Fahrer ist unterwegs!',
  geliefert: '🎉 Geliefert! Guten Hunger!',
  cancelled: 'Bestellung storniert.',
};

function stepIndex(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if ((STEPS[i].keys as string[]).includes(status)) return i;
  }
  return 0;
}

function formatCountdown(min: number): string {
  if (min <= 0) return 'Jeden Moment';
  return `ca. ${Math.round(min)} min`;
}

export function Phase1000DynamischeEtaLiveTrackingPro({
  orderId,
  locationId,
  initialStatus = 'neu',
  initialEtaMin = null,
  driverName = null,
  bestellnummer = null,
}: Props) {
  const [track, setTrack] = useState<TrackData>({
    status: initialStatus,
    etaMin: initialEtaMin,
    driverName,
    driverDistanceKm: null,
    prepStartedAt: null,
    prepMin: null,
  });
  const [etaTick, setEtaTick] = useState(initialEtaMin);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!orderId) return;
    try {
      const url = `/api/delivery/order/tracking?order_id=${orderId}${locationId ? `&location_id=${locationId}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const d: TrackData = await res.json();
        setTrack(d);
        setEtaTick(d.etaMin);
      }
    } catch {
      // keep current state
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20_000);
    tickRef.current = setInterval(() => {
      setEtaTick(t => (t !== null && t > 0 ? t - 1 / 60 : t));
    }, 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [orderId, locationId]);

  const activeStep = stepIndex(track.status);
  const isDelivered = track.status === 'geliefert';
  const isCancelled = track.status === 'cancelled';

  if (isCancelled) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 dark:border-matcha-700 bg-white dark:bg-matcha-950/40 shadow-sm overflow-hidden mb-4">
      {/* Status header */}
      <div className={`px-4 py-3 ${isDelivered ? 'bg-matcha-500 text-white' : 'bg-matcha-50 dark:bg-matcha-900/30'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isDelivered ? 'text-white' : 'text-matcha-800 dark:text-matcha-200'}`}>
            {STATUS_MSG[track.status] ?? 'Status wird geladen…'}
          </span>
          {!isDelivered && track.etaMin !== null && (
            <span className="ml-auto flex items-center gap-1 text-xs text-matcha-500 dark:text-matcha-400 font-medium">
              <Clock className="h-3 w-3" />
              {formatCountdown(etaTick ?? track.etaMin)}
            </span>
          )}
        </div>
        {bestellnummer && (
          <p className="text-xs text-matcha-500 dark:text-matcha-400 mt-0.5">{bestellnummer}</p>
        )}
      </div>

      {/* Step progress */}
      <div className="px-4 py-4">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <div key={step.label} className="flex-1 flex flex-col items-center">
                <div className="relative flex items-center w-full">
                  {i > 0 && (
                    <div className={`flex-1 h-0.5 ${done || active ? 'bg-matcha-500' : 'bg-matcha-100 dark:bg-matcha-800'}`} />
                  )}
                  <div className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${done ? 'bg-matcha-500 text-white' : active ? 'bg-matcha-500 text-white ring-4 ring-matcha-200 dark:ring-matcha-700' : 'bg-matcha-100 dark:bg-matcha-800 text-matcha-400'}
                  `}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${done ? 'bg-matcha-500' : 'bg-matcha-100 dark:bg-matcha-800'}`} />
                  )}
                </div>
                <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${active ? 'text-matcha-700 dark:text-matcha-300' : done ? 'text-matcha-500' : 'text-matcha-300 dark:text-matcha-600'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {(track.driverName || track.driverDistanceKm !== null) && !isDelivered && (
        <div className="px-4 pb-4">
          <div className="rounded-xl bg-matcha-50 dark:bg-matcha-900/30 border border-matcha-100 dark:border-matcha-800 px-3 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-matcha-500 flex items-center justify-center shrink-0">
              <Bike className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-matcha-800 dark:text-matcha-200">
                {track.driverName ?? 'Fahrer auf dem Weg'}
              </div>
              {track.driverDistanceKm !== null && (
                <div className="flex items-center gap-1 text-xs text-matcha-500 dark:text-matcha-400 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {track.driverDistanceKm < 1
                    ? `${Math.round(track.driverDistanceKm * 1000)}m entfernt`
                    : `${track.driverDistanceKm.toFixed(1)}km entfernt`}
                </div>
              )}
            </div>
            {track.etaMin !== null && track.etaMin <= 3 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                <Zap className="h-3 w-3" />
                Gleich da!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
