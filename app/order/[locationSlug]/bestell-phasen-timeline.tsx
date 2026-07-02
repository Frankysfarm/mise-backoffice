'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Bike, Package, ShoppingBag } from 'lucide-react';

interface Props {
  status: string; // order status
  etaMin?: number | null;
  orderedAt?: string | null;
  className?: string;
}

type Phase = {
  key: string;
  label: string;
  icon: React.ReactNode;
  statuses: string[]; // order statuses that map to this phase being active/done
};

const PHASES: Phase[] = [
  {
    key: 'received',
    label: 'Bestellt',
    icon: <ShoppingBag className="h-4 w-4" />,
    statuses: ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'],
  },
  {
    key: 'confirmed',
    label: 'Bestätigt',
    icon: <Check className="h-4 w-4" />,
    statuses: ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'],
  },
  {
    key: 'cooking',
    label: 'In Zubereitung',
    icon: <ChefHat className="h-4 w-4" />,
    statuses: ['in_zubereitung', 'fertig', 'unterwegs', 'geliefert'],
  },
  {
    key: 'ready',
    label: 'Abholbereit',
    icon: <Package className="h-4 w-4" />,
    statuses: ['fertig', 'unterwegs', 'geliefert'],
  },
  {
    key: 'delivery',
    label: 'Unterwegs',
    icon: <Bike className="h-4 w-4" />,
    statuses: ['unterwegs', 'geliefert'],
  },
];

type PhaseState = 'done' | 'active' | 'upcoming';

function getPhaseState(phase: Phase, currentStatus: string): PhaseState {
  if (currentStatus === 'geliefert') return 'done';
  const activeStatuses = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'];
  const currentIdx = activeStatuses.indexOf(currentStatus);
  const phaseActive = phase.statuses.includes(currentStatus);
  const phaseDone = phase.statuses.some(s => {
    const idx = activeStatuses.indexOf(s);
    return idx !== -1 && idx < currentIdx;
  });
  if (phaseDone && !phaseActive) return 'done';
  if (phaseActive) {
    // If there's a higher status already active, this is done
    const phaseStatuses = phase.statuses;
    const currentInPhase = phaseStatuses.indexOf(currentStatus);
    if (currentInPhase === 0) return 'active';
    return 'done';
  }
  return 'upcoming';
}

export function BestellPhasenTimeline({ status, etaMin, orderedAt, className }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!orderedAt) return;
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(orderedAt).getTime()) / 60_000));
    };
    update();
    const iv = setInterval(update, 30_000);
    return () => clearInterval(iv);
  }, [orderedAt]);

  if (status === 'storniert' || status === 'abgelehnt') return null;

  const activePhaseIdx = PHASES.findIndex(p => p.statuses[0] === status ||
    (status === 'neu' && p.key === 'received') ||
    (status === 'bestätigt' && p.key === 'confirmed') ||
    (status === 'in_zubereitung' && p.key === 'cooking') ||
    (status === 'fertig' && p.key === 'ready') ||
    (status === 'unterwegs' && p.key === 'delivery') ||
    (status === 'geliefert' && p.key === 'delivery')
  );

  return (
    <div className={cn('rounded-2xl bg-white border border-stone-100 p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-stone-800">Bestellstatus</span>
        {etaMin != null && status !== 'geliefert' && (
          <span className="text-xs font-bold text-matcha-700 bg-matcha-50 rounded-full px-2.5 py-0.5">
            ~{etaMin} Min
          </span>
        )}
        {status === 'geliefert' && (
          <span className="text-xs font-bold text-matcha-700 bg-matcha-50 rounded-full px-2.5 py-0.5">
            ✓ Geliefert
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-stone-100" />

        <div className="space-y-3">
          {PHASES.map((phase, idx) => {
            let state: PhaseState = 'upcoming';
            if (status === 'geliefert') {
              state = 'done';
            } else if (idx < activePhaseIdx) {
              state = 'done';
            } else if (idx === activePhaseIdx) {
              state = 'active';
            } else {
              state = 'upcoming';
            }

            return (
              <div key={phase.key} className="relative flex items-center gap-3">
                {/* Dot */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-500',
                    state === 'done' ? 'bg-matcha-500 text-white' :
                    state === 'active' ? 'bg-matcha-600 text-white ring-4 ring-matcha-200 animate-pulse' :
                    'bg-stone-100 text-stone-400',
                  )}
                >
                  {state === 'done' ? <Check className="h-4 w-4" /> : phase.icon}
                </div>

                {/* Label */}
                <div className={cn(
                  'text-sm transition-all duration-300',
                  state === 'active' ? 'font-bold text-stone-900' :
                  state === 'done' ? 'font-medium text-matcha-600 line-through decoration-matcha-300' :
                  'text-stone-400',
                )}>
                  {phase.label}
                  {state === 'active' && (
                    <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500 animate-ping" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ETA info */}
      {orderedAt && elapsed > 0 && status !== 'geliefert' && (
        <div className="text-[11px] text-stone-400 pt-1 border-t border-stone-50">
          Bestellung aufgegeben vor {elapsed} Min{elapsed !== 1 ? '' : ''}
        </div>
      )}
    </div>
  );
}
