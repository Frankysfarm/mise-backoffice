'use client';

import { cn } from '@/lib/utils';
import { ChefHat, Package, Truck, Check } from 'lucide-react';

type OrderStatus =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert';

interface Props {
  status: string;
  isDelivery: boolean;
  etaMinutes: number;
}

const DELIVERY_PHASES = [
  {
    key: 'preparation',
    label: 'Zubereitung',
    icon: ChefHat,
    activeStatuses: ['bestätigt', 'in_zubereitung'],
    doneStatuses: ['fertig', 'unterwegs', 'geliefert'],
  },
  {
    key: 'handoff',
    label: 'Abholung',
    icon: Package,
    activeStatuses: ['fertig'],
    doneStatuses: ['unterwegs', 'geliefert'],
  },
  {
    key: 'delivery',
    label: 'Unterwegs',
    icon: Truck,
    activeStatuses: ['unterwegs'],
    doneStatuses: ['geliefert'],
  },
] as const;

const PICKUP_PHASES = [
  {
    key: 'preparation',
    label: 'Zubereitung',
    icon: ChefHat,
    activeStatuses: ['bestätigt', 'in_zubereitung'],
    doneStatuses: ['fertig', 'abgeholt'],
  },
  {
    key: 'ready',
    label: 'Abholbereit',
    icon: Package,
    activeStatuses: ['fertig'],
    doneStatuses: ['abgeholt'],
  },
  {
    key: 'done',
    label: 'Abgeholt',
    icon: Check,
    activeStatuses: ['abgeholt'],
    doneStatuses: [],
  },
] as const;

// Each phase gets a rough fraction of total eta
const PHASE_FRACTIONS = [0.55, 0.1, 0.35] as const;

export function BestellPhasenBand({ status, isDelivery, etaMinutes }: Props) {
  const phases = isDelivery ? DELIVERY_PHASES : PICKUP_PHASES;

  return (
    <div className="w-full mt-4">
      {/* Phase strip */}
      <div className="flex items-start gap-0">
        {phases.map((phase, i) => {
          const isActive = (phase.activeStatuses as readonly string[]).includes(status);
          const isDone = (phase.doneStatuses as readonly string[]).includes(status);
          const phaseEta = Math.round(etaMinutes * PHASE_FRACTIONS[i]);

          return (
            <div key={phase.key} className="flex-1 relative flex flex-col items-center">
              {/* Connector line (before icon, except first) */}
              {i > 0 && (
                <div className="absolute top-4 right-1/2 w-full h-0.5 z-0">
                  <div
                    className={cn(
                      'h-full transition-colors duration-500',
                      isDone || isActive ? 'bg-accent' : 'bg-white/15',
                    )}
                  />
                </div>
              )}

              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                  isDone
                    ? 'bg-accent border-accent text-matcha-900'
                    : isActive
                    ? 'bg-accent/20 border-accent text-accent shadow-[0_0_12px_rgba(74,230,138,0.4)]'
                    : 'bg-white/5 border-white/15 text-white/25',
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <phase.icon className="h-3.5 w-3.5" />
                )}
                {/* Pulse animation for active phase */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-accent/30" />
                )}
              </div>

              {/* Label */}
              <div className={cn(
                'mt-1.5 text-center',
                isDone
                  ? 'text-accent'
                  : isActive
                  ? 'text-white'
                  : 'text-white/30',
              )}>
                <div className="text-[10px] font-bold">{phase.label}</div>
                {isActive && phaseEta > 0 && (
                  <div className="text-[9px] text-accent/80 font-medium tabular-nums mt-0.5">
                    ~{phaseEta} Min
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
