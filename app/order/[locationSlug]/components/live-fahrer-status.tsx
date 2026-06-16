'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Package, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingStatus = 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | null;

interface TrackingData {
  status: TrackingStatus;
  etaMin: number | null;
  driverName: string | null;
  driverLat: number | null;
  driverLng: number | null;
  orderLat: number | null;
  orderLng: number | null;
  updatedAt: string | null;
}

interface Props {
  orderId: string;
  initialStatus?: string | null;
}

const STEPS: { key: TrackingStatus | 'bestätigt'; label: string; Icon: React.ElementType }[] = [
  { key: 'in_zubereitung', label: 'Wird zubereitet', Icon: Package },
  { key: 'fertig',         label: 'Bereit zur Abholung', Icon: Clock },
  { key: 'unterwegs',     label: 'Fahrer unterwegs', Icon: Bike },
  { key: 'geliefert',     label: 'Geliefert', Icon: CheckCircle2 },
];

const STATUS_ORDER: Record<string, number> = {
  neu: 0, bestätigt: 0, in_zubereitung: 1, fertig: 2, unterwegs: 3, geliefert: 4,
};

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}

export function LiveFahrerStatus({ orderId, initialStatus }: Props) {
  const [data, setData] = useState<TrackingData>({
    status: (initialStatus as TrackingStatus) ?? null,
    etaMin: null,
    driverName: null,
    driverLat: null,
    driverLng: null,
    orderLat: null,
    orderLng: null,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const now = useNow(30_000);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${encodeURIComponent(orderId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          setData({
            status: (json.status as TrackingStatus) ?? null,
            etaMin: json.eta_min ?? json.etaMin ?? null,
            driverName: json.driver_name ?? json.driverName ?? null,
            driverLat: json.driver_lat ?? null,
            driverLng: json.driver_lng ?? null,
            orderLat: json.order_lat ?? null,
            orderLng: json.order_lng ?? null,
            updatedAt: json.updated_at ?? null,
          });
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  const currentStep = STATUS_ORDER[data.status ?? ''] ?? 0;

  const etaText = useMemo(() => {
    if (!data.etaMin) return null;
    if (data.etaMin <= 1) return 'Gleich da!';
    return `~${data.etaMin} Min`;
  }, [data.etaMin]);

  const freshness = data.updatedAt
    ? Math.round((now - new Date(data.updatedAt).getTime()) / 60_000)
    : null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-3 w-32 bg-stone-100 rounded mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-8 bg-stone-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.status || data.status === null) return null;

  const isDelivered = data.status === 'geliefert';

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-colors duration-500',
      isDelivered
        ? 'border-matcha-200 bg-matcha-50'
        : 'border-stone-200 bg-white',
    )}>
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className={cn('h-4 w-4 shrink-0', isDelivered ? 'text-matcha-600' : 'text-stone-500')} />
          <span className="text-xs font-bold text-stone-700">Live-Tracking</span>
        </div>
        {etaText && !isDelivered && (
          <div className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1">
            <Timer className="h-3 w-3 text-stone-500" />
            <span className="text-[11px] font-bold text-stone-700 tabular-nums">{etaText}</span>
          </div>
        )}
        {freshness !== null && freshness < 3 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-matcha-500 animate-pulse" />
            <span className="text-[10px] text-matcha-600 font-medium">Live</span>
          </div>
        )}
      </div>

      {/* Step timeline */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, idx) => {
          const stepOrder = STATUS_ORDER[step.key ?? ''] ?? 0;
          const done = currentStep > stepOrder;
          const active = currentStep === stepOrder;
          return (
            <React.Fragment key={step.key ?? idx}>
              <div className={cn(
                'flex flex-col items-center gap-1 flex-1',
                done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-40',
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  done
                    ? 'bg-matcha-500 text-white'
                    : active
                    ? 'bg-stone-800 text-white ring-2 ring-stone-800 ring-offset-1'
                    : 'bg-stone-100 text-stone-400',
                )}>
                  <step.Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight font-medium',
                  active ? 'text-stone-800 font-bold' : done ? 'text-matcha-700' : 'text-stone-400',
                )}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-shrink-0 w-4 mb-4 rounded-full transition-colors',
                  currentStep > stepOrder ? 'bg-matcha-500' : 'bg-stone-200',
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Driver info */}
      {data.driverName && data.status === 'unterwegs' && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-200 px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 shrink-0">
            {data.driverName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-stone-800 truncate">{data.driverName}</div>
            <div className="text-[10px] text-stone-500">Dein Fahrer</div>
          </div>
          {data.driverLat && data.orderLat && (
            <div className="shrink-0 flex items-center gap-1 text-[10px] text-stone-500">
              <MapPin className="h-3 w-3" />
              <span>unterwegs</span>
            </div>
          )}
        </div>
      )}

      {/* Delivered */}
      {isDelivered && (
        <div className="flex items-center gap-2 rounded-xl bg-matcha-100 border border-matcha-300 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-[12px] font-bold text-matcha-800">Deine Bestellung wurde geliefert!</span>
        </div>
      )}
    </div>
  );
}
