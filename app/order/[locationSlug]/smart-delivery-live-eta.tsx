'use client';

/**
 * SmartDeliveryLiveEta
 * Storefront-Komponente für dynamische ETA und Live-Tracking.
 * Zeigt dem Kunden Echtzeit-Lieferzeit mit Fahrer-Position und Status-Timeline.
 */

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Clock, MapPin, ChefHat, Bike, Package, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingStatus {
  status: 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'on_way' | 'nearby' | 'delivered';
  eta_min: number | null;
  eta_label: string;
  driver_name?: string;
  driver_rating?: number;
  driver_distance_km?: number;
  kitchen_progress_pct?: number;
  stops_before?: number;
}

const STATUS_STEPS: { key: TrackingStatus['status']; label: string; icon: React.ReactNode }[] = [
  { key: 'confirmed', label: 'Bestätigt', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'preparing', label: 'In Zubereitung', icon: <ChefHat className="w-3.5 h-3.5" /> },
  { key: 'ready', label: 'Fertig', icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'picked_up', label: 'Abgeholt', icon: <Bike className="w-3.5 h-3.5" /> },
  { key: 'on_way', label: 'Unterwegs', icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'delivered', label: 'Zugestellt', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

const STATUS_ORDER: Record<TrackingStatus['status'], number> = {
  confirmed: 0, preparing: 1, ready: 2, picked_up: 3, on_way: 4, nearby: 4, delivered: 5,
};

function useTracking(orderId: string | null) {
  const [tracking, setTracking] = useState<TrackingStatus>({
    status: 'preparing',
    eta_min: 18,
    eta_label: 'ca. 18 Min.',
    driver_name: 'Ahmed K.',
    driver_rating: 4.9,
    kitchen_progress_pct: 45,
    stops_before: 0,
  });

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) setTracking(await r.json());
    } catch {}
  }, [orderId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  return tracking;
}

function EtaRing({ etaMin }: { etaMin: number }) {
  const urgent = etaMin <= 5;
  const soonColor = etaMin <= 10 ? '#22c55e' : '#f59e0b';

  return (
    <div className={cn(
      'w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all',
      urgent ? 'border-green-400 bg-green-50 animate-[pulse_1s_ease-in-out_infinite]' : 'border-saffron bg-saffron/10'
    )}>
      <div className="text-center">
        <div className="text-2xl font-black tabular-nums" style={{ color: urgent ? '#16a34a' : '#b45309' }}>
          {etaMin}
        </div>
        <div className="text-[9px] font-semibold text-stone-500 leading-tight">Min.</div>
      </div>
    </div>
  );
}

export function SmartDeliveryLiveEta({ orderId }: { orderId?: string | null }) {
  const tracking = useTracking(orderId ?? null);
  const currentStepIdx = STATUS_ORDER[tracking.status] ?? 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-saffron/10 to-white px-4 py-3 border-b border-stone-100">
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-0.5">Live-Tracking</div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            tracking.status === 'delivered' ? 'bg-green-500' : 'bg-saffron animate-pulse'
          )} />
          <span className="text-sm font-bold text-stone-800">
            {tracking.status === 'delivered' ? 'Zugestellt!' : 'Deine Bestellung kommt'}
          </span>
        </div>
      </div>

      {/* ETA Display */}
      {tracking.status !== 'delivered' && tracking.eta_min !== null && (
        <div className="flex items-center gap-4 px-4 py-4">
          <EtaRing etaMin={tracking.eta_min} />
          <div>
            <div className="text-xs text-stone-500 mb-0.5">Voraussichtliche Lieferzeit</div>
            <div className="text-lg font-black text-stone-800">{tracking.eta_label}</div>
            {tracking.driver_name && (
              <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                <Bike className="w-3 h-3 text-matcha-500" />
                {tracking.driver_name}
                {tracking.driver_rating && (
                  <span className="flex items-center gap-0.5 text-amber-500 font-semibold ml-1">
                    <Star className="w-2.5 h-2.5" />{tracking.driver_rating}
                  </span>
                )}
              </div>
            )}
            {tracking.driver_distance_km !== undefined && (
              <div className="text-xs text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {tracking.driver_distance_km < 1
                  ? `${Math.round(tracking.driver_distance_km * 1000)}m entfernt`
                  : `${tracking.driver_distance_km.toFixed(1)}km entfernt`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kitchen Progress */}
      {tracking.status === 'preparing' && tracking.kitchen_progress_pct !== undefined && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-stone-500 flex items-center gap-1">
              <ChefHat className="w-3 h-3" />Küche bereitet vor
            </span>
            <span className="text-[10px] font-bold text-stone-700">{tracking.kitchen_progress_pct}%</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-saffron to-amber-400 rounded-full transition-all duration-1000"
              style={{ width: `${tracking.kitchen_progress_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stops Before */}
      {tracking.stops_before !== undefined && tracking.stops_before > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] text-stone-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-blue-500" />
            {tracking.stops_before === 1 ? '1 Stopp' : `${tracking.stops_before} Stopps`} vor deiner Lieferung
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="px-4 pb-4">
        <div className="flex items-center">
          {STATUS_STEPS.map((step, i) => {
            const stepIdx = STATUS_ORDER[step.key];
            const isDone = stepIdx < currentStepIdx;
            const isCurrent = stepIdx === currentStepIdx;
            const isPending = stepIdx > currentStepIdx;
            const isLast = i === STATUS_STEPS.length - 1;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                    isDone && 'bg-green-500 border-green-500 text-white',
                    isCurrent && 'bg-saffron border-saffron text-white ring-2 ring-saffron/30',
                    isPending && 'bg-white border-stone-200 text-stone-300',
                  )}>
                    {step.icon}
                  </div>
                  <span className={cn(
                    'text-[8px] font-medium text-center leading-tight w-14 truncate',
                    isDone && 'text-green-600',
                    isCurrent && 'text-stone-800 font-bold',
                    isPending && 'text-stone-300',
                  )}>
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className={cn('flex-1 h-0.5 mb-4 mx-1', isDone ? 'bg-green-400' : 'bg-stone-100')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivered State */}
      {tracking.status === 'delivered' && (
        <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
          <div className="text-sm font-bold text-green-800">Zugestellt!</div>
          <div className="text-xs text-green-600 mt-0.5">Guten Appetit!</div>
        </div>
      )}

      <div className="px-4 pb-3 text-[9px] text-stone-300 text-center">
        Live-Tracking · automatische Aktualisierung · mise
      </div>
    </div>
  );
}
