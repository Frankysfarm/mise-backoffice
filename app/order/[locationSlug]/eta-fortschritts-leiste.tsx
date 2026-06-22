'use client';

import { useEffect, useState } from 'react';
import { Check, ChefHat, Bike, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderPhase = 'bestellt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

const PHASES: { key: OrderPhase; label: string; icon: React.ReactNode; minDur: number }[] = [
  { key: 'bestellt',    label: 'Bestätigt',  icon: <Package className="h-3.5 w-3.5" />,  minDur: 1 },
  { key: 'zubereitung', label: 'Küche',      icon: <ChefHat className="h-3.5 w-3.5" />, minDur: 12 },
  { key: 'abholung',   label: 'Abholung',   icon: <Bike className="h-3.5 w-3.5" />,     minDur: 3 },
  { key: 'unterwegs',  label: 'Unterwegs',  icon: <MapPin className="h-3.5 w-3.5" />,   minDur: 10 },
  { key: 'geliefert',  label: 'Angekommen', icon: <Check className="h-3.5 w-3.5" />,    minDur: 0 },
];

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex(p => p.key === phase);
}

export function EtaFortschrittsLeiste({
  currentPhase,
  etaMin,
  className,
}: {
  currentPhase: OrderPhase;
  etaMin?: number | null;
  className?: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (currentPhase === 'geliefert') return;
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, [currentPhase]);

  const activeIdx = phaseIndex(currentPhase);

  return (
    <div className={cn('w-full', className)}>
      {/* ETA label */}
      {etaMin != null && currentPhase !== 'geliefert' && (
        <div className="text-center mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-matcha-100 border border-matcha-200 px-3 py-1 text-sm font-black text-matcha-800">
            <Bike className="h-3.5 w-3.5" />
            ca. {etaMin} Min
          </span>
        </div>
      )}
      {currentPhase === 'geliefert' && (
        <div className="text-center mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-matcha-600 text-white px-3 py-1 text-sm font-black">
            <Check className="h-3.5 w-3.5" />
            Geliefert!
          </span>
        </div>
      )}

      {/* Step rail */}
      <div className="relative flex items-start justify-between">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted/60 z-0">
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${(activeIdx / (PHASES.length - 1)) * 100}%` }}
          />
        </div>

        {PHASES.map((phase, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          const future = idx > activeIdx;
          return (
            <div key={phase.key} className="relative z-10 flex flex-col items-center gap-1" style={{ flex: 1 }}>
              {/* Circle */}
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                done   ? 'bg-matcha-500 border-matcha-500 text-white' :
                active ? 'bg-white border-matcha-500 text-matcha-600 shadow-md ring-2 ring-matcha-200' :
                         'bg-white border-muted text-muted-foreground',
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : phase.icon}
              </div>

              {/* Label */}
              <span className={cn(
                'text-[9px] font-bold text-center leading-tight',
                done ? 'text-matcha-600' : active ? 'text-matcha-700' : 'text-muted-foreground',
              )}>
                {phase.label}
              </span>

              {/* Active pulse */}
              {active && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-matcha-400 animate-ping" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
