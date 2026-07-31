'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Bike, CheckCircle2, ChefHat, Package, Navigation, Zap } from 'lucide-react';

type TrackingStatus = 'bestätigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface TrackingData {
  status: TrackingStatus;
  eta_min?: number | null;
  fahrer_name?: string | null;
  fahrer_distanz_km?: number | null;
  zubereitung_start?: string | null;
  estimated_prep_min?: number | null;
  letzte_aktualisierung?: string | null;
}

interface Props {
  orderId: string;
  bestellnummer?: string | null;
  className?: string;
}

const STATUS_STEPS: { key: TrackingStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'bestätigt',    label: 'Bestätigt',    icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { key: 'bereit',       label: 'Abholbereit',  icon: <Package className="w-4 h-4" /> },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: <Bike className="w-4 h-4" /> },
  { key: 'geliefert',   label: 'Geliefert',    icon: <CheckCircle2 className="w-4 h-4" /> },
];

const STATUS_IDX: Record<TrackingStatus, number> = {
  bestätigt: 0, in_zubereitung: 1, bereit: 2, unterwegs: 3, geliefert: 4,
};

const MOCK: TrackingData = {
  status: 'unterwegs',
  eta_min: 8,
  fahrer_name: 'Marco R.',
  fahrer_distanz_km: 1.4,
  zubereitung_start: new Date(Date.now() - 15 * 60_000).toISOString(),
  estimated_prep_min: 15,
  letzte_aktualisierung: new Date().toISOString(),
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function fmtMin(min: number | null | undefined) {
  if (min == null) return '–';
  return `${min} Min`;
}

export function StorefrontPhase5120LiveTrackingHubV6({ orderId, bestellnummer, className }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(false);
  const now = useNow();

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) setData(json);
      }
    } catch { } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const stepIdx = STATUS_IDX[data.status] ?? 0;
  const isDelivered = data.status === 'geliefert';

  // Prep countdown
  const prepRestSec = (() => {
    if (!data.zubereitung_start || !data.estimated_prep_min) return null;
    const startMs = new Date(data.zubereitung_start).getTime();
    const totalMs = data.estimated_prep_min * 60_000;
    return Math.max(0, Math.ceil((startMs + totalMs - now) / 1_000));
  })();

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Live-Tracking</span>
          {bestellnummer && <span className="text-xs text-gray-400">{bestellnummer}</span>}
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />}
      </div>

      {/* ETA Hero */}
      {!isDelivered && data.eta_min != null && (
        <div className="px-4 py-4 flex items-center gap-4 border-b border-gray-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 shrink-0">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 leading-none">{data.eta_min}</div>
              <div className="text-[9px] text-blue-400 mt-0.5">Min</div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Geschätzte Lieferzeit</div>
            {data.fahrer_name && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Bike className="w-3.5 h-3.5 text-blue-400" />
                {data.fahrer_name}
                {data.fahrer_distanz_km != null && (
                  <span className="text-gray-400 ml-1">· {data.fahrer_distanz_km} km entfernt</span>
                )}
              </div>
            )}
            {data.status === 'in_zubereitung' && prepRestSec != null && (
              <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <ChefHat className="w-3 h-3" />
                <span>Noch {Math.ceil(prepRestSec / 60)} Min in Zubereitung</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivered */}
      {isDelivered && (
        <div className="px-4 py-4 flex items-center gap-3 bg-emerald-50 border-b border-emerald-100">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <div>
            <div className="text-sm font-semibold text-emerald-800">Geliefert!</div>
            <div className="text-xs text-emerald-600">Guten Appetit 🎉</div>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between relative">
          {/* connector line */}
          <div className="absolute top-4 left-4 right-4 h-px bg-gray-200 z-0">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(stepIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
            />
          </div>

          {STATUS_STEPS.map((step, i) => {
            const isDone = i < stepIdx;
            const isActive = i === stepIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 z-10" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                  isDone ? 'bg-blue-500 border-blue-500 text-white' :
                  isActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200 scale-110' :
                  'bg-white border-gray-200 text-gray-300',
                )}>
                  {step.icon}
                </div>
                <span className={cn('text-[9px] text-center leading-tight',
                  isActive ? 'text-blue-600 font-semibold' :
                  isDone ? 'text-gray-500' : 'text-gray-300',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status detail */}
      {data.status === 'unterwegs' && data.fahrer_name && (
        <div className="mx-4 mb-4 rounded-xl bg-blue-50 border border-blue-100 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <Bike className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-blue-800">{data.fahrer_name} ist unterwegs</div>
            {data.fahrer_distanz_km != null && (
              <div className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                Noch {data.fahrer_distanz_km} km bis zu dir
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-blue-700">{fmtMin(data.eta_min)}</div>
          </div>
        </div>
      )}

      <div className="px-4 pb-2 text-center text-[10px] text-gray-300">
        30-Sek-Polling · Live-Tracking · Mock-Fallback
      </div>
    </div>
  );
}
