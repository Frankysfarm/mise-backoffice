'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Truck, ChefHat, Package, Clock, MapPin, Navigation, Bike, Zap } from 'lucide-react';

const STEPS = [
  { key: 'bestätigt',      label: 'Bestätigt',   icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'fertig',         label: 'Fertig',       icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',    icon: Truck },
  { key: 'geliefert',      label: 'Geliefert',    icon: CheckCircle2 },
] as const;

type StepKey = typeof STEPS[number]['key'];

function stepIndex(status: string | null): number {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

interface TrackingData {
  status: string | null;
  etaLabel: string | null;
  driverName: string | null;
  distanceM: number | null;
  etaMinRemaining: number | null;
  almostThere: boolean;
  bearingDeg: number | null;
  stopsBefore: number | null;
}

interface LiveDriverTrackerProps {
  orderId: string;
  initialStatus?: string | null;
}

function ProximityRing({ pct, isNearby }: { pct: number; isNearby: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const clamp = Math.max(0, Math.min(1, pct));
  const color = isNearby ? '#10b981' : clamp > 0.5 ? '#3b82f6' : '#f59e0b';
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
      <circle
        cx="42" cy="42" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${circ * (1 - clamp)}`}
        className="transition-all duration-700"
        transform="rotate(-90 42 42)"
      />
    </svg>
  );
}

export function LiveDriverTracker({ orderId, initialStatus }: LiveDriverTrackerProps) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [pulseOn, setPulseOn] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setPulseOn(p => !p), 1400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setStatus(d.status ?? null);
        setTracking({
          status: d.status,
          etaLabel: d.eta_label ?? null,
          driverName: d.driver_name ?? null,
          distanceM: d.geo?.distance_m ?? null,
          etaMinRemaining: d.geo?.eta_min_remaining ?? null,
          almostThere: d.geo?.almost_there ?? false,
          bearingDeg: d.geo?.bearing_deg ?? null,
          stopsBefore: d.stops_before ?? null,
        });
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 25_000);

    const supabase = createClient();
    const channel = supabase
      .channel(`ldt-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          if (!cancelled && payload.new?.status) {
            setStatus(payload.new.status as string);
            poll();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const currentIdx = stepIndex(status);
  const isDelivered = status === 'geliefert';
  const isUnterwegs = status === 'unterwegs';
  const isNearby = tracking?.almostThere || (tracking?.distanceM != null && tracking.distanceM < 500);

  const pct = tracking?.distanceM != null
    ? Math.max(0, 1 - tracking.distanceM / 3000)
    : tracking?.etaMinRemaining != null
    ? Math.max(0, 1 - tracking.etaMinRemaining / 20)
    : 0.3;

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border',
      isDelivered ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-card',
    )}>
      {isDelivered ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
          <div className="rounded-full bg-emerald-500 p-4">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-800">Geliefert!</div>
            <div className="text-sm text-emerald-600 mt-0.5">Ihre Bestellung ist angekommen.</div>
          </div>
        </div>
      ) : (
        <>
          {/* Status step bar */}
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider">Lieferstatus</span>
            {tracking?.etaLabel && (
              <span className="ml-auto text-[10px] font-bold text-muted-foreground tabular-nums">
                ETA {tracking.etaLabel}
              </span>
            )}
          </div>

          <div className="px-4 py-4">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted -z-0" />
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
                    <div className={cn(
                      'rounded-full p-1.5 border-2 transition-colors',
                      done
                        ? active
                          ? 'bg-matcha-500 border-matcha-500 text-white'
                          : 'bg-matcha-100 border-matcha-300 text-matcha-700'
                        : 'bg-white border-border text-muted-foreground',
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className={cn(
                      'text-[9px] font-semibold text-center leading-tight',
                      done ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GPS driver proximity panel — visible only when on the way */}
          {isUnterwegs && tracking && (
            <div className={cn(
              'border-t px-4 pb-4 pt-3',
              isNearby ? 'bg-emerald-50/50' : 'bg-blue-50/50',
            )}>
              <div className="flex items-center gap-3">
                {/* Proximity ring */}
                <div className="relative">
                  <ProximityRing pct={pct} isNearby={!!isNearby} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Bike
                      size={20}
                      className={cn(isNearby ? 'text-emerald-600' : 'text-blue-500')}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Pulse dot + name */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={cn(
                      'h-2 w-2 rounded-full shrink-0 transition-colors duration-300',
                      pulseOn ? (isNearby ? 'bg-emerald-500' : 'bg-blue-500') : (isNearby ? 'bg-emerald-300' : 'bg-blue-300'),
                    )} />
                    <span className={cn('text-xs font-bold truncate', isNearby ? 'text-emerald-800' : 'text-blue-800')}>
                      {isNearby ? 'Fahrer fast da!' : (tracking.driverName ? `${tracking.driverName} unterwegs` : 'Fahrer unterwegs')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {tracking.etaMinRemaining != null && tracking.etaMinRemaining > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-400 shrink-0" />
                        <span className="text-sm font-black text-gray-800 tabular-nums">
                          {tracking.etaMinRemaining} min
                        </span>
                      </div>
                    )}
                    {tracking.distanceM != null && (
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-600">
                          {tracking.distanceM < 1000
                            ? `${Math.round(tracking.distanceM)} m`
                            : `${(tracking.distanceM / 1000).toFixed(1)} km`}
                        </span>
                      </div>
                    )}
                    {tracking.bearingDeg != null && (
                      <div className="flex items-center gap-1">
                        <Navigation
                          size={12}
                          className="text-blue-400"
                          style={{ transform: `rotate(${tracking.bearingDeg}deg)` }}
                        />
                      </div>
                    )}
                    {tracking.stopsBefore != null && tracking.stopsBefore > 0 && (
                      <span className="text-[10px] text-amber-600 font-bold">
                        +{tracking.stopsBefore} Stop{tracking.stopsBefore !== 1 ? 's' : ''} vor dir
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        isNearby ? 'bg-emerald-500' : 'bg-blue-400',
                      )}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {isNearby && (
                <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
                  <Zap size={13} className="text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-800">
                    Weniger als 500m entfernt — Bitte bereit sein!
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
