'use client';

/**
 * Phase 587 — Storefront: Bestell-ETA-Komfort-Banner v2
 *
 * Erweiterter ETA-Banner mit getrennter Küchen- und Fahrerphase.
 * Zeigt Fortschritts-Leiste + aktuelle Phase + ETA je Phase.
 *
 * Props: orderStatus, etaMin, orderedAt, locationId
 * Ticker: 30s
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, CheckCircle2, Clock, Package, Truck } from 'lucide-react';

type OrderStatus =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'bereit'
  | 'unterwegs'
  | 'geliefert'
  | string;

interface Props {
  orderStatus?: OrderStatus | null;
  etaMin?: number | null;
  orderedAt?: string | null;
  kitchenMin?: number | null;
  deliveryMin?: number | null;
}

interface PhaseConfig {
  key: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  statuses: Set<string>;
}

const PHASES: PhaseConfig[] = [
  {
    key: 'bestätigt',
    label: 'Bestätigt',
    sublabel: 'Bestellung angenommen',
    icon: <Package className="h-4 w-4" />,
    statuses: new Set(['bestätigt', 'confirmed', 'neu']),
  },
  {
    key: 'in_zubereitung',
    label: 'Küche',
    sublabel: 'Wird zubereitet',
    icon: <ChefHat className="h-4 w-4" />,
    statuses: new Set(['in_zubereitung', 'in_preparation', 'bereit']),
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    sublabel: 'Fahrer auf dem Weg',
    icon: <Truck className="h-4 w-4" />,
    statuses: new Set(['unterwegs', 'on_the_way']),
  },
  {
    key: 'geliefert',
    label: 'Geliefert',
    sublabel: 'Guten Appetit!',
    icon: <CheckCircle2 className="h-4 w-4" />,
    statuses: new Set(['geliefert', 'delivered']),
  },
];

function getPhaseIndex(status: string | null | undefined): number {
  if (!status) return 0;
  const idx = PHASES.findIndex(p => p.statuses.has(status));
  return idx >= 0 ? idx : 0;
}

function elapsedMin(orderedAt: string | null | undefined): number {
  if (!orderedAt) return 0;
  return Math.floor((Date.now() - new Date(orderedAt).getTime()) / 60_000);
}

function fmtCountdown(remaining: number): string {
  if (remaining <= 0) return 'Gleich da!';
  if (remaining < 60) return `${remaining} Min`;
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return `${h}h ${m}min`;
}

export function Phase587BestellEtaKomfortBanner({
  orderStatus,
  etaMin,
  orderedAt,
  kitchenMin,
  deliveryMin,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const currentPhaseIdx = getPhaseIndex(orderStatus);
  const isDelivered = currentPhaseIdx >= 3;
  const elapsed = elapsedMin(orderedAt);
  const totalEta = etaMin ?? (kitchenMin && deliveryMin ? kitchenMin + deliveryMin : null);
  const remaining = totalEta !== null ? Math.max(0, totalEta - elapsed) : null;

  // Derived per-phase ETAs
  const kitchenEta = kitchenMin ?? (totalEta !== null ? Math.round(totalEta * 0.5) : null);
  const driverEta  = deliveryMin ?? (totalEta !== null ? Math.round(totalEta * 0.5) : null);

  const progressPct = (() => {
    if (isDelivered) return 100;
    if (totalEta && elapsed > 0) return Math.min(95, Math.round((elapsed / totalEta) * 100));
    return (currentPhaseIdx / (PHASES.length - 1)) * 80;
  })();

  if (isDelivered) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-matcha-600 shrink-0" />
        <div>
          <div className="text-sm font-bold text-matcha-800">Bestellung geliefert!</div>
          <div className="text-xs text-matcha-600">Wir wünschen guten Appetit.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700 rounded-r-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* ETA headline */}
        {remaining !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-matcha-600" />
              <span className="text-sm font-bold text-foreground">Noch ca.</span>
            </div>
            <span className="text-xl font-black tabular-nums text-matcha-700">
              {fmtCountdown(remaining)}
            </span>
          </div>
        )}

        {/* Phase steps */}
        <div className="flex items-center gap-0">
          {PHASES.map((phase, idx) => {
            const isActive   = idx === currentPhaseIdx;
            const isComplete = idx < currentPhaseIdx;
            const isLast     = idx === PHASES.length - 1;

            return (
              <div key={phase.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  {/* Icon bubble */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isComplete ? 'bg-matcha-500 border-matcha-500 text-white' :
                    isActive   ? 'bg-matcha-100 border-matcha-500 text-matcha-700 animate-pulse' :
                                 'bg-muted border-border text-muted-foreground',
                  )}>
                    {phase.icon}
                  </div>
                  {/* Label */}
                  <div className={cn(
                    'mt-1 text-center',
                    isActive ? 'text-matcha-700' : isComplete ? 'text-matcha-600' : 'text-muted-foreground',
                  )}>
                    <div className="text-[9px] font-bold leading-tight">{phase.label}</div>
                    {isActive && (
                      <div className="text-[8px] opacity-80 leading-tight">{phase.sublabel}</div>
                    )}
                  </div>
                </div>
                {/* Connector */}
                {!isLast && (
                  <div className={cn(
                    'h-0.5 flex-shrink-0 mx-0.5 w-4',
                    idx < currentPhaseIdx ? 'bg-matcha-500' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Per-phase breakdown */}
        {(kitchenEta !== null || driverEta !== null) && currentPhaseIdx < 3 && (
          <div className="flex gap-3 pt-1 border-t">
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <ChefHat className="h-3 w-3 text-amber-600" />
                <span className="text-[10px] text-muted-foreground font-medium">Küche</span>
              </div>
              <div className={cn(
                'text-sm font-black tabular-nums',
                currentPhaseIdx <= 1 ? 'text-amber-700' : 'text-muted-foreground line-through',
              )}>
                {kitchenEta !== null ? `~${kitchenEta} Min` : '—'}
              </div>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Truck className="h-3 w-3 text-matcha-600" />
                <span className="text-[10px] text-muted-foreground font-medium">Fahrer</span>
              </div>
              <div className={cn(
                'text-sm font-black tabular-nums',
                currentPhaseIdx >= 2 ? 'text-matcha-700' : 'text-muted-foreground',
              )}>
                {driverEta !== null ? `~${driverEta} Min` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
