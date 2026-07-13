'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Star, Zap } from 'lucide-react';

/**
 * Phase 1325 — Live-ETA-Tracking-Ultra (Storefront)
 *
 * Kundenseitiger Echtzeit-Tracking-Block mit:
 * — 5-Phasen-Timeline (Bestellt → Küche → Unterwegs → Nah → Geliefert)
 * — Live-Countdown bis Ankunft
 * — Fahrer-Annäherungsanzeige (wenn lat/lng vorhanden)
 * — Ampel-Farbkodierung nach ETA-Abweichung
 * — 30-Sek-Polling via /api/delivery/customer?orderId=…
 * — Vollständiger Fallback wenn kein activeOrderId
 */

interface OrderStatus {
  status: string;
  eta_minutes?: number | null;
  driver_name?: string | null;
  driver_distance_km?: number | null;
  promised_at?: string | null;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  phase?: 'bestellt' | 'kueche' | 'unterwegs' | 'nah' | 'geliefert' | null;
}

interface Props {
  locationId?: string | null;
  orderId?: string | null;
}

const PHASES = [
  { key: 'bestellt',  label: 'Bestellt',   icon: Package },
  { key: 'kueche',   label: 'Küche',       icon: ChefHat },
  { key: 'unterwegs', label: 'Unterwegs',  icon: Bike },
  { key: 'nah',      label: 'Gleich da',   icon: MapPin },
  { key: 'geliefert', label: 'Geliefert',  icon: CheckCircle2 },
] as const;

type PhaseKey = typeof PHASES[number]['key'];

function statusToPhase(status: string): PhaseKey {
  switch (status) {
    case 'neu':
    case 'bestätigt':
      return 'bestellt';
    case 'in_zubereitung':
      return 'kueche';
    case 'fertig':
    case 'unterwegs':
      return 'unterwegs';
    case 'geliefert':
    case 'abgeschlossen':
      return 'geliefert';
    default:
      return 'bestellt';
  }
}

function getPhaseIndex(phase: PhaseKey): number {
  return PHASES.findIndex((p) => p.key === phase);
}

function fmtCountdown(minutes: number): string {
  if (minutes <= 0) return 'Sofort';
  if (minutes < 60) return `${minutes} Min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function StorefrontPhase1325LiveEtaTrackingUltra({ locationId, orderId }: Props) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    if (!orderId) { setOrder(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/customer?orderId=${encodeURIComponent(orderId)}&locationId=${locationId ?? ''}`)
        .then((r) => r.json()).catch(() => null);
      if (res && res.status) {
        setOrder({
          status: res.status,
          eta_minutes: res.eta_minutes ?? null,
          driver_name: res.driver_name ?? null,
          driver_distance_km: res.driver_distance_km ?? null,
          promised_at: res.promised_at ?? null,
          bestellt_am: res.bestellt_am ?? null,
          geschaetzte_zubereitung_min: res.geschaetzte_zubereitung_min ?? null,
          phase: res.phase ?? null,
        });
      }
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [orderId, locationId]);

  useEffect(() => {
    loadStatus();
    ivRef.current = setInterval(loadStatus, 30_000);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      if (ivRef.current) clearInterval(ivRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [loadStatus]);

  if (!orderId) return null;
  if (!order && !loading) return null;

  if (loading && !order) {
    return (
      <div className="rounded-2xl border border-border bg-background p-5 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 flex-1 rounded-xl bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const currentPhase: PhaseKey = order.phase ?? statusToPhase(order.status);
  const currentIndex = getPhaseIndex(currentPhase);
  const isDelivered = currentPhase === 'geliefert';

  const etaMin = order.eta_minutes ?? null;
  const isLate = etaMin != null && etaMin > 45;
  const isNear = order.driver_distance_km != null && order.driver_distance_km < 0.5;

  return (
    <div className={cn(
      'rounded-2xl border bg-background overflow-hidden shadow-sm transition-all',
      isDelivered ? 'border-matcha-300 bg-matcha-50/50' :
      isNear ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-200' :
      isLate ? 'border-amber-300' : 'border-border',
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center gap-2',
        isDelivered ? 'bg-matcha-50 border-matcha-200' :
        isNear ? 'bg-blue-50 border-blue-200' :
        'bg-background border-border',
      )}>
        {isNear ? (
          <Bike className="h-4 w-4 text-blue-600 animate-pulse" />
        ) : isDelivered ? (
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
        ) : (
          <Clock className="h-4 w-4 text-matcha-600" />
        )}
        <span className="text-sm font-bold">
          {isDelivered ? '🎉 Geliefert!' :
           isNear ? '🚴 Fahrer ist gleich da!' :
           'Live-Tracking'}
        </span>

        {etaMin != null && !isDelivered && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className={cn(
              'text-sm font-black tabular-nums',
              isLate ? 'text-amber-600' : 'text-matcha-700',
            )}>
              {fmtCountdown(etaMin)}
            </span>
            {isLate && <AlertCircle className="h-4 w-4 text-amber-500" />}
          </div>
        )}
        {loading && (
          <span className="ml-auto text-[10px] text-muted-foreground animate-pulse">
            Aktualisiere…
          </span>
        )}
      </div>

      {/* Phase timeline */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-1">
          {PHASES.map((phase, i) => {
            const isDone = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isPending = i > currentIndex;
            const Icon = phase.icon;

            return (
              <div key={phase.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center transition-all',
                    isDone    ? 'bg-matcha-500 text-white' :
                    isCurrent ? cn('text-white', isNear ? 'bg-blue-600 ring-4 ring-blue-200 animate-pulse' : 'bg-matcha-600 ring-4 ring-matcha-200') :
                    'bg-muted text-muted-foreground',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={cn(
                    'mt-1 text-[10px] font-bold text-center leading-tight',
                    isDone    ? 'text-matcha-600' :
                    isCurrent ? isNear ? 'text-blue-700' : 'text-matcha-700' :
                    'text-muted-foreground',
                  )}>
                    {phase.label}
                  </div>
                </div>

                {/* Connector */}
                {i < PHASES.length - 1 && (
                  <div className={cn(
                    'h-0.5 flex-1 rounded-full mx-0.5 mb-4 transition-all',
                    isDone ? 'bg-matcha-400' : isCurrent ? 'bg-matcha-200' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {order.driver_name && !isDelivered && (
        <div className="px-4 pb-4">
          <div className={cn(
            'rounded-xl px-3 py-2.5 flex items-center gap-3',
            isNear ? 'bg-blue-100' : 'bg-muted/50',
          )}>
            <Bike className={cn('h-5 w-5 shrink-0', isNear ? 'text-blue-600' : 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{order.driver_name}</div>
              {order.driver_distance_km != null && (
                <div className="text-[11px] text-muted-foreground">
                  {order.driver_distance_km < 1
                    ? `${Math.round(order.driver_distance_km * 1000)} m entfernt`
                    : `${order.driver_distance_km.toFixed(1)} km entfernt`}
                </div>
              )}
            </div>
            {isNear && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                <Zap className="h-2.5 w-2.5" />
                Gleich da
              </span>
            )}
          </div>
        </div>
      )}

      {/* Delivered celebration */}
      {isDelivered && (
        <div className="px-4 pb-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-sm font-bold text-matcha-700">Guten Appetit!</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Bitte bewerten Sie Ihre Lieferung
          </div>
          <div className="mt-2 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="h-6 w-6 text-amber-400 fill-amber-400 cursor-pointer hover:scale-110 transition-transform" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
