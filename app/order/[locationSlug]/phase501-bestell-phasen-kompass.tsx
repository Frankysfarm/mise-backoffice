'use client';

/**
 * Phase 501 — Bestell-Phasen-Kompass
 *
 * Animierter 5-Stufen-Kompass für die Kunden-Tracking-Seite:
 * Bestellt → In Zubereitung → Fertig → Beim Fahrer → Geliefert
 *
 * - Aktive Phase wird pulsierend hervorgehoben
 * - Abgeschlossene Phasen in matcha-grün
 * - Ausstehende Phasen in grau
 * - ETA-Anzeige beim Fahrer-Schritt
 */

import { cn } from '@/lib/utils';
import { Check, ChefHat, Package, Bike, CheckCircle2 } from 'lucide-react';

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | 'storniert'
  | 'abgebrochen';

interface Props {
  status: OrderStatus;
  etaMin?: number | null;
  driverName?: string | null;
}

interface Phase {
  key: string;
  label: string;
  subLabel?: (props: Props) => string | null;
  icon: typeof Package;
  statuses: OrderStatus[];
}

const PHASES: Phase[] = [
  {
    key: 'bestellt',
    label: 'Bestellt',
    icon: Package,
    statuses: ['neu', 'bestätigt'],
  },
  {
    key: 'zubereitung',
    label: 'Zubereitung',
    icon: ChefHat,
    statuses: ['in_zubereitung'],
  },
  {
    key: 'fertig',
    label: 'Fertig',
    icon: Check as typeof Package,
    statuses: ['fertig'],
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    icon: Bike,
    statuses: ['unterwegs'],
    subLabel: ({ etaMin, driverName }) => {
      if (driverName && etaMin) return `${driverName} · ~${etaMin} Min`;
      if (etaMin) return `~${etaMin} Min`;
      if (driverName) return driverName;
      return null;
    },
  },
  {
    key: 'geliefert',
    label: 'Geliefert',
    icon: CheckCircle2,
    statuses: ['geliefert'],
  },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  neu:            0,
  bestätigt:      0,
  in_zubereitung: 1,
  fertig:         2,
  unterwegs:      3,
  geliefert:      4,
  storniert:      -1,
  abgebrochen:    -1,
};

function getPhaseIndex(status: OrderStatus): number {
  return STATUS_ORDER[status] ?? -1;
}

export function Phase501BestellPhasenKompass({ status, etaMin, driverName }: Props) {
  if (status === 'storniert' || status === 'abgebrochen') return null;

  const activeIdx = getPhaseIndex(status);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between relative">
        {/* Connector line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-stone-100 z-0" />

        {PHASES.map((phase, idx) => {
          const done   = idx < activeIdx;
          const active = idx === activeIdx;
          const Icon   = phase.icon;
          const sub    = phase.subLabel?.({ status, etaMin, driverName });

          return (
            <div
              key={phase.key}
              className="relative z-10 flex flex-col items-center gap-1.5 flex-1"
            >
              {/* Circle */}
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  done
                    ? 'bg-matcha-500 border-matcha-500 text-white'
                    : active
                      ? 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-100'
                      : 'bg-stone-50 border-stone-200 text-stone-300',
                  active && 'animate-pulse',
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Label */}
              <div className="text-center">
                <div
                  className={cn(
                    'text-[10px] font-bold leading-tight',
                    done ? 'text-matcha-600' : active ? 'text-stone-800' : 'text-stone-300',
                  )}
                >
                  {phase.label}
                </div>
                {active && sub && (
                  <div className="text-[9px] text-stone-400 mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[72px]">
                    {sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
