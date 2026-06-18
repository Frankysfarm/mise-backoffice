'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Bike, ChefHat, Package, Home } from 'lucide-react';

type StepId = 'bestaetigt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface Step {
  id: StepId;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { id: 'bestaetigt',  label: 'Bestätigt',     sublabel: 'Deine Bestellung ist eingegangen',  icon: CheckCircle2 },
  { id: 'zubereitung', label: 'Zubereitung',   sublabel: 'Die Küche bereitet dein Essen zu',  icon: ChefHat },
  { id: 'bereit',      label: 'Abholbereit',   sublabel: 'Warten auf Fahrer',                  icon: Package },
  { id: 'unterwegs',   label: 'Unterwegs',     sublabel: 'Dein Fahrer ist auf dem Weg',        icon: Bike },
  { id: 'geliefert',   label: 'Angekommen',    sublabel: 'Genieß dein Essen!',                 icon: Home },
];

function statusToStep(status: string): StepId {
  switch (status) {
    case 'neu':
    case 'bestätigt': return 'bestaetigt';
    case 'in_zubereitung': return 'zubereitung';
    case 'bereit':
    case 'abholbereit': return 'bereit';
    case 'unterwegs':
    case 'on_route': return 'unterwegs';
    case 'geliefert':
    case 'abgeschlossen': return 'geliefert';
    default: return 'bestaetigt';
  }
}

interface Props {
  orderStatus: string;
  etaMin?: number | null;
  updatedAt?: string | null;
  compact?: boolean;
}

export function LiveBestellZeitleiste({ orderStatus, etaMin, updatedAt, compact = false }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const activeId = statusToStep(orderStatus);
  const activeIdx = STEPS.findIndex((s) => s.id === activeId);
  const isComplete = activeId === 'geliefert';

  const minutesSinceUpdate = updatedAt
    ? Math.floor((now - new Date(updatedAt).getTime()) / 60000)
    : null;

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white overflow-hidden', compact ? 'p-3' : 'p-4 sm:p-5')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-stone-800">Live-Status</span>
        </div>
        {etaMin !== null && etaMin !== undefined && !isComplete && (
          <span className="rounded-full bg-matcha-50 border border-matcha-200 px-2.5 py-0.5 text-xs font-black text-matcha-700 tabular-nums">
            ~{etaMin} Min
          </span>
        )}
        {isComplete && (
          <span className="rounded-full bg-matcha-50 border border-matcha-200 px-2.5 py-0.5 text-xs font-black text-matcha-700">
            Geliefert ✓
          </span>
        )}
      </div>

      {/* Step timeline */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-stone-100" />
        {/* Progress fill */}
        <div
          className="absolute left-4 top-4 w-0.5 bg-matcha-400 transition-all duration-1000"
          style={{
            height: activeIdx > 0
              ? `${(activeIdx / (STEPS.length - 1)) * (compact ? 90 : 100)}%`
              : '0%',
          }}
        />

        <div className="space-y-3 relative">
          {STEPS.map((step, idx) => {
            const isDone = idx < activeIdx;
            const isActive = idx === activeIdx;
            const isFuture = idx > activeIdx;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                    isDone
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : isActive
                      ? 'border-matcha-500 bg-white text-matcha-600 shadow-sm shadow-matcha-200 ring-2 ring-matcha-100'
                      : 'border-stone-200 bg-white text-stone-300',
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className={cn('h-3.5 w-3.5', isActive && 'animate-pulse')} />
                  )}
                </div>

                {/* Labels */}
                <div className={cn('flex-1 pt-0.5', isFuture && 'opacity-40')}>
                  <div className={cn('text-sm font-bold', isActive ? 'text-matcha-700' : isDone ? 'text-stone-700' : 'text-stone-400')}>
                    {step.label}
                    {isActive && (
                      <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
                    )}
                  </div>
                  {(isActive || isDone || !compact) && (
                    <div className="text-xs text-stone-400">{step.sublabel}</div>
                  )}
                </div>

                {/* Timestamp placeholder for active */}
                {isActive && minutesSinceUpdate !== null && minutesSinceUpdate < 60 && (
                  <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums pt-1">
                    vor {minutesSinceUpdate}m
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
