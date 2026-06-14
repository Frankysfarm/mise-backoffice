'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Clock, Package, Truck } from 'lucide-react';

const STEPS = [
  { key: 'bestätigt',      label: 'Bestätigt',     sublabel: 'Deine Bestellung ist eingegangen',       icon: Check },
  { key: 'in_zubereitung', label: 'Wird gekocht',   sublabel: 'Die Küche bereitet alles vor',           icon: ChefHat },
  { key: 'fertig',         label: 'Fertig',          sublabel: 'Bereit zur Abholung durch den Fahrer',   icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',       sublabel: 'Dein Fahrer ist auf dem Weg',            icon: Truck },
  { key: 'geliefert',      label: 'Geliefert',       sublabel: 'Guten Appetit!',                         icon: Check },
] as const;

const STATUS_INDEX: Record<string, number> = {
  'neu':            0,
  'bestätigt':      0,
  'in_zubereitung': 1,
  'fertig':         2,
  'unterwegs':      3,
  'geliefert':      4,
};

interface Props {
  status: string;
  etaMin?: number | null;
  className?: string;
}

export function BestellstatusAnimation({ status, etaMin, className }: Props) {
  const [animStep, setAnimStep] = useState(-1);
  const currentIdx = STATUS_INDEX[status] ?? 0;

  // Animate steps in on mount
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      setAnimStep(i);
      i++;
      if (i > currentIdx) clearInterval(iv);
    }, 180);
    return () => clearInterval(iv);
  }, [currentIdx]);

  return (
    <div className={cn('py-3', className)}>
      <div className="relative flex items-start justify-between">
        {/* Connector line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted mx-7" aria-hidden />
        <div
          className="absolute top-4 left-0 h-0.5 bg-matcha-500 mx-7 transition-all duration-700"
          style={{ right: `${((STEPS.length - 1 - currentIdx) / (STEPS.length - 1)) * 100}%` }}
          aria-hidden
        />

        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const future = idx > currentIdx;
          const visible = animStep >= idx;
          return (
            <div
              key={step.key}
              className={cn(
                'relative flex flex-col items-center gap-1.5 flex-1',
                'transition-all duration-300',
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
              )}
            >
              <div className={cn(
                'z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                done
                  ? 'border-matcha-500 bg-matcha-500 text-white'
                  : active
                  ? 'border-matcha-500 bg-white text-matcha-600 shadow-md shadow-matcha-500/20'
                  : 'border-muted bg-white text-muted-foreground',
                active && 'scale-110',
              )}>
                {active ? (
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75 animate-ping" />
                    <Icon size={14} />
                  </span>
                ) : (
                  <Icon size={12} />
                )}
              </div>
              <div className="text-center">
                <div className={cn(
                  'text-[9px] font-bold leading-tight',
                  done ? 'text-matcha-600' :
                  active ? 'text-foreground' :
                  future ? 'text-muted-foreground/50' : 'text-muted-foreground',
                )}>
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current step detail */}
      {STEPS[currentIdx] && (
        <div className="mt-4 rounded-xl border border-matcha-100 bg-matcha-50 px-4 py-2.5 text-center">
          <div className="text-xs font-bold text-matcha-800">{STEPS[currentIdx].sublabel}</div>
          {etaMin != null && status === 'unterwegs' && (
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-matcha-600 font-semibold">
              <Clock size={10} />
              Ankunft in ca. {etaMin} Minuten
            </div>
          )}
        </div>
      )}
    </div>
  );
}
