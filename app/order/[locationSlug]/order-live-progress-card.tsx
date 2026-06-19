'use client';

import { useState, useEffect } from 'react';
import {
  Inbox,
  Bell,
  ChefHat,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Bike,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  bestellnummer: string;
  initialStatus?: string | null;
  initialEtaMin?: number | null;
}

interface TrackingData {
  status: string;
  eta_min: number | null;
  driver_name?: string | null;
  location_name?: string | null;
}

const STEPS = [
  { label: 'Eingegangen', Icon: Inbox },
  { label: 'Angenommen', Icon: Bell },
  { label: 'In Zubereitung', Icon: ChefHat },
  { label: 'Fertig', Icon: Package },
  { label: 'Unterwegs', Icon: Truck },
  { label: 'Geliefert', Icon: CheckCircle2 },
];

const STATUS_LABEL_MAP: Record<string, string> = {
  neu: 'Eingegangen...',
  bestätigt: 'Angenommen!',
  angenommen: 'Angenommen!',
  in_zubereitung: 'Wird zubereitet...',
  preparing: 'Wird zubereitet...',
  fertig: 'Fertig zur Abholung!',
  ready: 'Fertig zur Abholung!',
  unterwegs: 'Unterwegs zu dir!',
  out_for_delivery: 'Unterwegs zu dir!',
  picked_up: 'Unterwegs zu dir!',
  geliefert: 'Geliefert! Guten Appetit! 🎉',
  delivered: 'Geliefert! Guten Appetit! 🎉',
  completed: 'Geliefert! Guten Appetit! 🎉',
};

function statusToStep(status: string): number {
  switch (status) {
    case 'neu':
      return 0;
    case 'bestätigt':
    case 'angenommen':
      return 1;
    case 'in_zubereitung':
    case 'preparing':
      return 2;
    case 'fertig':
    case 'ready':
      return 3;
    case 'unterwegs':
    case 'out_for_delivery':
    case 'picked_up':
      return 4;
    case 'geliefert':
    case 'delivered':
    case 'completed':
      return 5;
    default:
      return 0;
  }
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1 h-1 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function OrderLiveProgressCard({
  orderId,
  bestellnummer,
  initialStatus,
  initialEtaMin,
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus ?? 'neu');
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  const currentStep = statusToStep(status);
  const isDelivered = currentStep === 5;
  const isUnterwegs = currentStep === 4;
  const showDots =
    !isDelivered && !['fertig', 'ready', 'angenommen', 'bestätigt', 'neu'].includes(status);

  useEffect(() => {
    let cancelled = false;

    async function fetchTracking() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (!res.ok) return;
        const data: TrackingData = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        setEtaMin(data.eta_min);
        if (data.driver_name != null) setDriverName(data.driver_name);
        if (data.location_name != null) setLocationName(data.location_name);
      } catch {
      }
    }

    fetchTracking();
    const interval = setInterval(fetchTracking, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  useEffect(() => {
    if (!etaMin || etaMin <= 0) return;
    const timer = setInterval(() => {
      setEtaMin((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [etaMin]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-progress-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Partial<TrackingData> & { status?: string; eta_min?: number | null };
          if (row.status) setStatus(row.status);
          if ('eta_min' in row) setEtaMin(row.eta_min ?? null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const statusLabel = STATUS_LABEL_MAP[status] ?? 'Bestellung läuft...';

  return (
    <div className="w-full rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 tracking-wide uppercase">
          Bestellung #{bestellnummer}
        </span>
        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live
        </span>
      </div>

      <div className="px-4 py-3">
        {isDelivered ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <span className="text-lg font-bold text-green-700">{statusLabel}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isUnterwegs ? (
              <Bike
                className="w-5 h-5 text-amber-500 animate-bounce"
                aria-hidden="true"
              />
            ) : null}
            <span className="text-base font-semibold text-gray-800">
              {statusLabel}
              {showDots && <AnimatedDots />}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-100 z-0" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-green-400 z-0 transition-all duration-700"
            style={{
              width:
                currentStep === 0
                  ? '0%'
                  : `${Math.min(100, (currentStep / (STEPS.length - 1)) * 100)}%`,
            }}
          />
          {STEPS.map(({ label, Icon }, idx) => {
            const completed = idx < currentStep;
            const active = idx === currentStep;
            const future = idx > currentStep;

            return (
              <div
                key={label}
                className="relative z-10 flex flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-500',
                    completed && 'bg-green-500 text-white',
                    active &&
                      'bg-amber-400 text-white ring-4 ring-amber-100 animate-pulse',
                    future && 'bg-gray-100 text-gray-400'
                  )}
                >
                  {completed ? (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium text-center leading-tight max-w-[44px]',
                    completed && 'text-green-600',
                    active && 'text-amber-600',
                    future && 'text-gray-400'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(etaMin != null && etaMin > 0) || driverName || locationName ? (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {etaMin != null && etaMin > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              ~{etaMin} Minuten
            </span>
          )}
          {driverName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
              Fahrer: {driverName}
            </span>
          )}
          {locationName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
              {locationName}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
