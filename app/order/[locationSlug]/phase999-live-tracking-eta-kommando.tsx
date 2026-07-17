'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, RefreshCw, Zap,
} from 'lucide-react';

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

const PHASE_STEPS: { key: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { key: ['neu', 'bestätigt'],                    label: 'Bestätigt',   icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: ['in_zubereitung', 'fertig'],             label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { key: ['abgeholt', 'unterwegs'],                label: 'Unterwegs',   icon: <Bike className="h-4 w-4" /> },
  { key: ['geliefert'],                            label: 'Geliefert',   icon: <Package className="h-4 w-4" /> },
];

function phaseIndex(status: OrderStatus): number {
  for (let i = 0; i < PHASE_STEPS.length; i++) {
    if (PHASE_STEPS[i].key.includes(status)) return i;
  }
  return 0;
}

function formatCountdown(totalSec: number): { mm: string; ss: string } {
  const abs = Math.abs(totalSec);
  return {
    mm: Math.floor(abs / 60).toString().padStart(2, '0'),
    ss: (abs % 60).toString().padStart(2, '0'),
  };
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  neu:            'Deine Bestellung ist eingegangen.',
  bestätigt:      'Bestellung bestätigt!',
  in_zubereitung: 'Wird gerade zubereitet…',
  fertig:         'Fertig — Fahrer kommt!',
  abgeholt:       'Fahrer hat abgeholt!',
  unterwegs:      'Dein Fahrer ist unterwegs!',
  geliefert:      'Geliefert! Guten Hunger!',
  cancelled:      'Bestellung storniert.',
};

export function Phase999LiveTrackingEtaKommando({
  orderId,
  locationId,
  initialStatus = 'bestätigt',
  initialEtaMin = 30,
  driverName,
  bestellnummer,
}: Props) {
  const [data, setData] = useState<TrackData>({
    status: initialStatus,
    etaMin: initialEtaMin,
    driverName: driverName ?? null,
    driverDistanceKm: null,
    prepStartedAt: null,
    prepMin: null,
  });
  const [countdownSec, setCountdownSec] = useState<number>((initialEtaMin ?? 30) * 60);
  const [pulse, setPulse] = useState(false);
  const etaSetAt = useRef<number>(Date.now());
  const baseEtaSec = useRef<number>((initialEtaMin ?? 30) * 60);

  // Poll for updates
  useEffect(() => {
    if (!orderId || !locationId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/track?order_id=${orderId}&location_id=${locationId}`);
        if (!res.ok) return;
        const json: TrackData = await res.json();
        if (!cancelled) {
          setData(json);
          if (json.etaMin !== null) {
            baseEtaSec.current = json.etaMin * 60;
            etaSetAt.current = Date.now();
          }
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId, locationId]);

  // Countdown ticker
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Math.round((Date.now() - etaSetAt.current) / 1000);
      setCountdownSec(Math.max(0, baseEtaSec.current - elapsed));
      setPulse(p => !p);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const currentPhase = phaseIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const isCancelled = data.status === 'cancelled';
  const { mm, ss } = formatCountdown(countdownSec);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-matcha-600 px-4 py-3 flex items-center gap-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform',
          pulse && !isDelivered && 'scale-110',
        )}>
          <Bike className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm">Live-Tracking</div>
          {bestellnummer && (
            <div className="text-matcha-200 text-[11px]">Bestellung #{bestellnummer}</div>
          )}
        </div>
        {orderId && locationId && (
          <button
            onClick={() => {}}
            className="flex items-center gap-1 text-[10px] text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" />Live
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Phase Steps */}
        <div className="flex items-start gap-0">
          {PHASE_STEPS.map((phase, idx) => {
            const isDone = idx < currentPhase;
            const isActive = idx === currentPhase;
            const isFuture = idx > currentPhase;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div className={cn(
                    'absolute left-0 right-[50%] top-4 h-0.5 -translate-y-px',
                    isDone || isActive ? 'bg-matcha-500' : 'bg-muted',
                  )} />
                )}
                {idx < PHASE_STEPS.length - 1 && (
                  <div className={cn(
                    'absolute left-[50%] right-0 top-4 h-0.5 -translate-y-px',
                    isDone ? 'bg-matcha-500' : 'bg-muted',
                  )} />
                )}

                {/* Icon circle */}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  isDone   ? 'bg-matcha-500 border-matcha-500 text-white' :
                  isActive ? cn('bg-white border-matcha-500 text-matcha-600', pulse && 'shadow-lg shadow-matcha-200') :
                             'bg-white border-muted text-muted-foreground',
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
                </div>

                <div className={cn(
                  'mt-1.5 text-[10px] text-center font-medium leading-tight',
                  isActive ? 'text-matcha-700 font-bold' : isFuture ? 'text-muted-foreground' : 'text-matcha-600',
                )}>
                  {phase.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Message */}
        <div className={cn(
          'text-center text-sm font-semibold',
          isDelivered ? 'text-matcha-700' : isCancelled ? 'text-red-500' : 'text-foreground',
        )}>
          {STATUS_LABELS[data.status]}
        </div>

        {/* Countdown (only when actively delivering) */}
        {!isDelivered && !isCancelled && countdownSec > 0 && (
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-1 bg-matcha-50 border border-matcha-200 rounded-2xl px-5 py-3">
              <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
              <div className="flex items-end gap-0.5">
                <span className="font-mono text-3xl font-black tabular-nums text-matcha-800">{mm}</span>
                <span className={cn(
                  'font-mono text-2xl font-black tabular-nums text-matcha-600 mb-0.5 transition-opacity',
                  pulse ? 'opacity-100' : 'opacity-0',
                )}>:</span>
                <span className="font-mono text-3xl font-black tabular-nums text-matcha-800">{ss}</span>
              </div>
              <span className="text-[11px] text-matcha-600 ml-1">Min</span>
            </div>
          </div>
        )}

        {/* Delivered celebration */}
        {isDelivered && (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-100 border-2 border-matcha-300">
              <Package className="h-8 w-8 text-matcha-600" />
            </div>
            <div className="text-lg font-black text-matcha-700">Guten Hunger! 🎉</div>
          </div>
        )}

        {/* Driver info */}
        {data.driverName && (data.status === 'unterwegs' || data.status === 'abgeholt') && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 border border-matcha-200 shrink-0">
              <Bike className="h-4 w-4 text-matcha-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{data.driverName}</div>
              <div className="text-[11px] text-muted-foreground">Dein Fahrer</div>
            </div>
            {data.driverDistanceKm !== null && (
              <div className="shrink-0 text-right">
                <div className="text-sm font-black text-matcha-700">{data.driverDistanceKm.toFixed(1)} km</div>
                <div className="text-[10px] text-muted-foreground">entfernt</div>
              </div>
            )}
          </div>
        )}

        {/* Prep progress bar */}
        {(data.status === 'in_zubereitung') && data.prepStartedAt && data.prepMin && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><ChefHat className="h-3 w-3" />Zubereitung</span>
              <span>{data.prepMin} Min geplant</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                style={{
                  width: `${Math.min(100, ((Date.now() - new Date(data.prepStartedAt).getTime()) / (data.prepMin * 60000)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Live pulse indicator */}
        {!isDelivered && !isCancelled && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <div className={cn(
              'h-2 w-2 rounded-full bg-matcha-500 transition-opacity',
              pulse ? 'opacity-100' : 'opacity-40',
            )} />
            Live-Tracking aktiv
            <Zap className="h-3 w-3 text-matcha-500" />
          </div>
        )}
      </div>
    </div>
  );
}
