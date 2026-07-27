'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  driverName?: string | null;
}

interface TrackData {
  status: OrderStatus;
  eta_min: number | null;
  driver_name: string | null;
  driver_distance_km: number | null;
}

const STEPS: { keys: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { keys: ['neu', 'bestätigt'],           label: 'Bestätigt',   icon: <CheckCircle2 className="h-4 w-4" /> },
  { keys: ['in_zubereitung', 'fertig'],   label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { keys: ['abgeholt', 'unterwegs'],      label: 'Unterwegs',   icon: <Bike className="h-4 w-4" /> },
  { keys: ['geliefert'],                  label: 'Geliefert',   icon: <Package className="h-4 w-4" /> },
];

function stepIndex(status: OrderStatus) {
  for (let i = 0; i < STEPS.length; i++) { if (STEPS[i].keys.includes(status)) return i; }
  return 0;
}

const STATUS_MSG: Record<OrderStatus, string> = {
  neu:            'Bestellung eingegangen…',
  bestätigt:      'Bestätigt! Küche bereitet vor.',
  in_zubereitung: 'Wird frisch zubereitet…',
  fertig:         'Fertig — Fahrer holt ab!',
  abgeholt:       'Fahrer hat abgeholt!',
  unterwegs:      'Dein Fahrer ist auf dem Weg!',
  geliefert:      'Geliefert! Guten Hunger! 🎉',
  cancelled:      'Bestellung storniert.',
};

const POLL_MS = 30_000;

export function Phase1000LiveEtaLieferstatusCockpit({
  orderId,
  locationId,
  initialStatus = 'bestätigt',
  initialEtaMin = 30,
  driverName,
}: Props) {
  const [data, setData] = useState<TrackData>({
    status: initialStatus,
    eta_min: initialEtaMin,
    driver_name: driverName ?? null,
    driver_distance_km: null,
  });
  const [countdown, setCountdown] = useState((initialEtaMin ?? 30) * 60);

  useEffect(() => {
    if (!orderId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/order/track?order_id=${orderId}&location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) { setData(json); if (json.eta_min !== null) setCountdown(json.eta_min * 60); }
      } catch { /* keep last state */ }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId, locationId]);

  useEffect(() => {
    if (data.status === 'geliefert' || data.status === 'cancelled') return;
    const id = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1_000);
    return () => clearInterval(id);
  }, [data.status]);

  const currentStep = stepIndex(data.status);
  const mm = Math.floor(countdown / 60).toString().padStart(2, '0');
  const ss = (countdown % 60).toString().padStart(2, '0');
  const delivered = data.status === 'geliefert';
  const cancelled = data.status === 'cancelled';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Status-Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        delivered ? 'bg-emerald-500' : cancelled ? 'bg-red-400' : 'bg-indigo-600',
      )}>
        <p className="text-sm font-bold text-white">{STATUS_MSG[data.status]}</p>
        {!delivered && !cancelled && (
          <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2 py-1">
            <Clock className="w-3.5 h-3.5 text-white" />
            <span className="font-mono text-sm font-black text-white tabular-nums">{mm}:{ss}</span>
          </div>
        )}
      </div>

      {/* Fortschritts-Stepper */}
      {!cancelled && (
        <div className="flex items-start justify-between px-4 py-4 gap-1">
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    done   ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-300' :
                    active ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 animate-pulse' :
                             'bg-gray-100 text-gray-300',
                  )}>
                    {step.icon}
                  </div>
                  <span className={cn(
                    'text-[10px] text-center font-semibold leading-tight',
                    done ? 'text-emerald-600' : active ? 'text-indigo-600' : 'text-gray-300',
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mt-4 rounded-full transition-all', done ? 'bg-emerald-300' : 'bg-gray-100')} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Fahrer-Info */}
      {(data.driver_name || data.driver_distance_km !== null) && !delivered && !cancelled && (
        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-3 bg-gray-50">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <Bike className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-800">{data.driver_name ?? 'Dein Fahrer'}</p>
            {data.driver_distance_km !== null && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {data.driver_distance_km.toFixed(1)} km entfernt
              </p>
            )}
          </div>
        </div>
      )}

      {/* ETA Footer */}
      {!delivered && !cancelled && data.eta_min !== null && (
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Voraussichtliche Lieferung</span>
          <span className="text-xs font-bold text-indigo-600">in ca. {data.eta_min} Minuten</span>
        </div>
      )}
    </div>
  );
}
