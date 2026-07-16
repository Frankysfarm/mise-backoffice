'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Truck, Zap } from 'lucide-react';

/**
 * Phase 2001 — Vertrauens-Lieferzeit-Badge (Storefront)
 *
 * Dynamisches Badge, das dem Kunden auf der Storefront zeigt:
 * - Wann seine Bestellung voraussichtlich ankommt (XX:XX Uhr)
 * - Konfidenz-Level (hoch / mittel / niedrig)
 * - Live-Aktualisierung alle 30 Sekunden
 * - Visueller Puls wenn Fahrer nahe ist
 *
 * Props: etaMinutes (ETA in Minuten, aus der Parent-Komponente)
 */

interface Props {
  etaMinutes?: number | null;
  orderStatus?: string | null;
  driverNearby?: boolean;
  className?: string;
}

function etaArrivalTime(minutes: number): string {
  const arrival = new Date(Date.now() + minutes * 60 * 1000);
  return arrival.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function confidenceLabel(minutes: number): { label: string; color: string } {
  if (minutes <= 5) return { label: 'Sehr genau', color: 'text-green-400' };
  if (minutes <= 20) return { label: 'Genau', color: 'text-matcha-400' };
  if (minutes <= 40) return { label: 'Schätzung', color: 'text-yellow-400' };
  return { label: 'Vorläufig', color: 'text-neutral-500' };
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; pulse: boolean }> = {
  pending: { label: 'Bestellung eingegangen', icon: <Clock className="w-3.5 h-3.5" />, pulse: false },
  confirmed: { label: 'Bestätigt', icon: <CheckCircle2 className="w-3.5 h-3.5" />, pulse: false },
  in_progress: { label: 'Wird zubereitet', icon: <Zap className="w-3.5 h-3.5" />, pulse: true },
  zubereitung: { label: 'Wird zubereitet', icon: <Zap className="w-3.5 h-3.5" />, pulse: true },
  ready: { label: 'Fertig — wartet auf Fahrer', icon: <MapPin className="w-3.5 h-3.5" />, pulse: true },
  on_the_way: { label: 'Fahrer ist unterwegs', icon: <Truck className="w-3.5 h-3.5" />, pulse: true },
  delivering: { label: 'Fahrer ist unterwegs', icon: <Truck className="w-3.5 h-3.5" />, pulse: true },
  unterwegs: { label: 'Fahrer ist unterwegs', icon: <Truck className="w-3.5 h-3.5" />, pulse: true },
};

export function StorefrontPhase2001VertrauensLieferzeitBadge({ etaMinutes, orderStatus, driverNearby, className }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const arrival = useMemo(() => (etaMinutes != null ? etaArrivalTime(etaMinutes) : null), [etaMinutes, now]);
  const confidence = useMemo(() => (etaMinutes != null ? confidenceLabel(etaMinutes) : null), [etaMinutes]);
  const statusInfo = orderStatus ? STATUS_LABELS[orderStatus] ?? null : null;

  if (!etaMinutes && !statusInfo) return null;

  const isNearby = driverNearby || (etaMinutes != null && etaMinutes <= 3);

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        isNearby
          ? 'bg-green-950/50 border-green-700/60'
          : 'bg-neutral-900/80 border-neutral-700/50',
        className,
      )}
    >
      {/* Status row */}
      {statusInfo && (
        <div className={cn('flex items-center gap-2 text-sm', isNearby ? 'text-green-300' : 'text-neutral-300')}>
          <span className={cn(statusInfo.pulse && 'animate-pulse')}>{statusInfo.icon}</span>
          <span>{statusInfo.label}</span>
          {isNearby && (
            <span className="ml-auto text-xs font-medium text-green-400 animate-pulse">Fast da!</span>
          )}
        </div>
      )}

      {/* ETA */}
      {arrival && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Ankunft um</div>
            <div className={cn('text-2xl font-bold tabular-nums', isNearby ? 'text-green-300' : 'text-neutral-100')}>
              {arrival}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-neutral-500">in</div>
            <div className="text-lg font-semibold text-neutral-200 tabular-nums">{Math.max(0, Math.round(etaMinutes ?? 0))} min</div>
            {confidence && (
              <div className={cn('text-[10px]', confidence.color)}>{confidence.label}</div>
            )}
          </div>
        </div>
      )}

      {/* Progress dots */}
      {orderStatus && (
        <div className="flex items-center gap-1">
          {['pending', 'in_progress', 'ready', 'on_the_way', 'delivered'].map((s, i) => {
            const stages = ['pending', 'confirmed', 'in_progress', 'zubereitung', 'ready', 'on_the_way', 'delivering', 'unterwegs', 'delivered'];
            const currentIdx = stages.indexOf(orderStatus ?? '');
            const stageIdx = stages.indexOf(s);
            const active = stageIdx <= currentIdx;
            return (
              <div
                key={s}
                className={cn(
                  'h-1 rounded-full flex-1 transition-all duration-500',
                  active ? (isNearby ? 'bg-green-500' : 'bg-matcha-500') : 'bg-neutral-700',
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
