'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

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
  prepStartedAt: string | null;
}

const STEPS = [
  { keys: ['neu', 'bestätigt'] as OrderStatus[],       label: 'Bestätigt',   icon: CheckCircle2, color: 'text-blue-500',    bg: 'bg-blue-500' },
  { keys: ['in_zubereitung', 'fertig'] as OrderStatus[], label: 'Küche',     icon: ChefHat,      color: 'text-orange-500',  bg: 'bg-orange-500' },
  { keys: ['abgeholt', 'unterwegs'] as OrderStatus[],   label: 'Unterwegs',  icon: Bike,         color: 'text-indigo-500',  bg: 'bg-indigo-500' },
  { keys: ['geliefert'] as OrderStatus[],               label: 'Geliefert',  icon: Package,      color: 'text-emerald-500', bg: 'bg-emerald-500' },
];

function currentStep(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].keys.includes(status)) return i;
  }
  return 0;
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_MSGS: Partial<Record<OrderStatus, string>> = {
  neu:            'Bestellung eingegangen…',
  bestätigt:      'Bestätigt! Küche wird informiert.',
  in_zubereitung: 'Wird gerade frisch zubereitet!',
  fertig:         'Fertig! Fahrer kommt gleich.',
  abgeholt:       'Fahrer hat abgeholt!',
  unterwegs:      'Fahrer ist unterwegs zu dir!',
  geliefert:      '🎉 Geliefert! Guten Hunger!',
};

export function StorefrontPhase2712DynamischeEtaLiveFortschrittTrack({
  orderId, locationId, initialStatus = 'bestätigt', initialEtaMin, driverName, bestellnummer,
}: Props) {
  const [track, setTrack] = useState<TrackData>({
    status: initialStatus,
    etaMin: initialEtaMin ?? 30,
    driverName: driverName ?? null,
    prepStartedAt: null,
  });
  const [tick, setTick] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prevStatus = useRef(initialStatus);

  // 1-sec countdown tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll for updates
  useEffect(() => {
    if (!orderId || !locationId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}&location_id=${locationId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.status && json.status !== prevStatus.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
          prevStatus.current = json.status;
        }
        setTrack({
          status: json.status ?? initialStatus,
          etaMin: json.eta_min ?? null,
          driverName: json.driver_name ?? null,
          prepStartedAt: json.prep_started_at ?? null,
        });
      } catch {
        // keep current state
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId, locationId, initialStatus]);

  const step = currentStep(track.status);
  const etaSec = track.etaMin !== null ? track.etaMin * 60 - tick : null;
  const isDelivered = track.status === 'geliefert';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-300',
      isDelivered ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white',
      pulse && 'ring-2 ring-indigo-300 ring-offset-1',
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-900">
              {bestellnummer ? `Bestellung ${bestellnummer}` : 'Deine Bestellung'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{STATUS_MSGS[track.status] ?? 'Wird verarbeitet…'}</p>
          </div>
          {etaSec !== null && !isDelivered && (
            <div className="text-right">
              <p className="text-xs font-bold text-indigo-600 font-mono">{fmtCountdown(Math.max(0, etaSec))}</p>
              <p className="text-[9px] text-gray-400">verbleibend</p>
            </div>
          )}
          {isDelivered && (
            <Sparkles className="w-5 h-5 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Step Track */}
      <div className="px-4 pb-4">
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200 z-0">
            <div
              className="h-full bg-indigo-400 transition-all duration-700"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            const pending = i > step;
            return (
              <div key={s.label} className="relative z-10 flex flex-col items-center gap-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  done   && 'bg-indigo-500 border-indigo-500 text-white',
                  active && `${s.bg} border-transparent text-white shadow-md ${pulse ? 'scale-110' : ''}`,
                  pending && 'bg-white border-gray-300 text-gray-300',
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={cn(
                  'text-[9px] font-medium transition-colors duration-300',
                  done   && 'text-indigo-500',
                  active && `${s.color} font-bold`,
                  pending && 'text-gray-300',
                )}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info when on route */}
      {(track.status === 'unterwegs' || track.status === 'abgeholt') && (
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-gray-100">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
            <Bike className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-800 truncate">
              {track.driverName ?? 'Dein Fahrer'} ist unterwegs
            </p>
            {etaSec !== null && etaSec > 0 && (
              <p className="text-[9px] text-gray-500">ca. {Math.ceil(etaSec / 60)} min bis zu dir</p>
            )}
          </div>
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </div>
      )}

      {/* ETA bar */}
      {!isDelivered && track.etaMin !== null && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-[9px] text-gray-400">ETA</span>
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.max(5, 100 - (Math.max(0, etaSec ?? 0) / (track.etaMin * 60)) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[9px] font-semibold text-indigo-600">{track.etaMin} min</span>
          </div>
        </div>
      )}
    </div>
  );
}
