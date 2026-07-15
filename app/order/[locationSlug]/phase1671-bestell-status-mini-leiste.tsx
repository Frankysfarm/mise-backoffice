'use client';

import React from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'unterwegs' | 'geliefert' | 'abgeholt' | string;

type StepDef = {
  statuses: string[];
  label: string;
  Icon: React.ElementType;
};

const STEPS: StepDef[] = [
  { statuses: ['neu', 'bestätigt'],       label: 'Bestätigt',   Icon: CheckCircle2 },
  { statuses: ['in_zubereitung'],         label: 'Zubereitung', Icon: ChefHat },
  { statuses: ['fertig'],                 label: 'Bereit',      Icon: Package },
  { statuses: ['unterwegs'],              label: 'Unterwegs',   Icon: Truck },
  { statuses: ['geliefert', 'abgeholt'],  label: 'Geliefert',   Icon: MapPin },
];

function stepIndex(status: string): number {
  return STEPS.findIndex(s => s.statuses.includes(status));
}

export function StorefrontPhase1671BestellStatusMiniLeiste({
  orderStatus,
  etaMinutes,
  className,
}: {
  orderStatus: OrderStatus | null;
  etaMinutes?: number | null;
  className?: string;
}) {
  if (!orderStatus) return null;
  const currentIdx = stepIndex(orderStatus);
  if (currentIdx === -1) return null;

  const isDelivered = ['geliefert', 'abgeholt'].includes(orderStatus);

  return (
    <div className={cn('rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm', className)}>
      {/* ETA row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-saffron shrink-0" />
          <span className="text-[11px] font-bold text-stone-600">
            {isDelivered
              ? '🎉 Geliefert!'
              : etaMinutes !== null && etaMinutes !== undefined
                ? `~${etaMinutes} Min verbleibend`
                : 'In Bearbeitung…'
            }
          </span>
        </div>
        {!isDelivered && (
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
            {STEPS[currentIdx]?.label ?? ''}
          </span>
        )}
      </div>

      {/* Step dots */}
      <div className="relative flex items-center justify-between">
        {/* Background line */}
        <div className="absolute top-2.5 left-2.5 right-2.5 h-0.5 bg-stone-100">
          <div
            className={cn('h-full transition-all duration-700', isDelivered ? 'bg-matcha-500' : 'bg-saffron')}
            style={{ width: currentIdx >= 0 ? `${(currentIdx / (STEPS.length - 1)) * 100}%` : '0%' }}
          />
        </div>

        {STEPS.map((step, i) => {
          const Icon = step.Icon;
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={i} className="relative z-10 flex flex-col items-center gap-1">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                isDone
                  ? 'bg-matcha-500 border-matcha-500 text-white'
                  : isCurrent
                    ? isDelivered
                      ? 'bg-matcha-500 border-matcha-500 text-white'
                      : 'bg-saffron border-saffron text-white scale-110 shadow-sm shadow-saffron/30'
                    : 'bg-white border-stone-200 text-stone-300',
              )}>
                <Icon className="h-2.5 w-2.5" />
              </div>
              <span className={cn(
                'text-[8px] font-bold leading-none text-center',
                isDone ? 'text-matcha-600' : isCurrent ? (isDelivered ? 'text-matcha-600' : 'text-saffron') : 'text-stone-300',
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
