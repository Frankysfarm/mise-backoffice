'use client';

/**
 * BestellSchrittLeiste — Phase 427
 * Horizontale Schritt-Leiste für den Bestellstatus.
 * Zeigt alle Phasen einer Bestellung mit Animation der aktuellen Phase.
 */

import { cn } from '@/lib/utils';

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | string;

interface Step {
  key: string;
  emoji: string;
  label: string;
}

const STEPS: Step[] = [
  { key: 'neu',            emoji: '📋', label: 'Eingegangen'  },
  { key: 'bestätigt',      emoji: '✅', label: 'Angenommen'   },
  { key: 'in_zubereitung', emoji: '👨‍🍳', label: 'Zubereitung' },
  { key: 'fertig',         emoji: '📦', label: 'Fertig'       },
  { key: 'unterwegs',      emoji: '🛵', label: 'Unterwegs'    },
  { key: 'geliefert',      emoji: '🎉', label: 'Geliefert'    },
];

const STATUS_INDEX: Record<string, number> = {
  neu: 0, bestätigt: 1, in_zubereitung: 2, fertig: 3, unterwegs: 4, geliefert: 5,
};

interface Props {
  status: OrderStatus;
  className?: string;
}

export function BestellSchrittLeiste({ status, className }: Props) {
  const currentIdx = STATUS_INDEX[status] ?? 0;
  const isComplete = status === 'geliefert';

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="flex items-start gap-0 min-w-[340px]">
        {STEPS.map((step, idx) => {
          const done    = idx < currentIdx || isComplete;
          const active  = idx === currentIdx && !isComplete;
          const pending = idx > currentIdx && !isComplete;

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div className={cn(
                  'absolute left-0 top-4 right-1/2 h-0.5 -translate-y-1/2 z-0',
                  done || active ? 'bg-matcha-400' : 'bg-stone-200',
                )} />
              )}
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'absolute right-0 top-4 left-1/2 h-0.5 -translate-y-1/2 z-0',
                  done ? 'bg-matcha-400' : 'bg-stone-200',
                )} />
              )}

              {/* Dot */}
              <div className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm border-2 transition-all duration-500',
                done    ? 'bg-matcha-100 border-matcha-400 text-matcha-700'       :
                active  ? 'bg-white border-matcha-500 shadow-lg shadow-matcha-200/50 animate-pulse scale-110' :
                          'bg-stone-50 border-stone-200 text-stone-400',
              )}>
                {step.emoji}
              </div>

              {/* Label */}
              <div className={cn(
                'mt-1.5 text-center text-[10px] font-bold leading-tight px-0.5',
                done   ? 'text-matcha-600' :
                active ? 'text-matcha-700' :
                         'text-stone-400',
              )}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
