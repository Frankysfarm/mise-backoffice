'use client';

import { useEffect, useState } from 'react';
import { Check, ChefHat, Clock, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = {
  key: string;
  label: string;
  icon: typeof Check;
};

const STEPS: Step[] = [
  { key: 'bestätigt',      label: 'Angenommen',  icon: Check   },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'fertig',         label: 'Bereit',      icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',   icon: Truck   },
  { key: 'geliefert',      label: 'Geliefert',   icon: Check   },
];

const STATUS_STEP: Record<string, number> = {
  'neu':           0,
  'bestätigt':     1,
  'in_zubereitung':2,
  'fertig':        3,
  'unterwegs':     4,
  'geliefert':     5,
};

interface Props {
  status: string;
  etaMinutes: number;
  orderedAt?: string | null;
  className?: string;
}

function getEtaSecs(etaMinutes: number, orderedAt?: string | null): number {
  const base = orderedAt ? new Date(orderedAt).getTime() : Date.now();
  const target = base + etaMinutes * 60 * 1000;
  return Math.round((target - Date.now()) / 1000);
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BestellEtaProgress({ status, etaMinutes, orderedAt, className }: Props) {
  const [secsLeft, setSecsLeft] = useState(() => getEtaSecs(etaMinutes, orderedAt));

  useEffect(() => {
    const iv = setInterval(() => {
      setSecsLeft(getEtaSecs(etaMinutes, orderedAt));
    }, 1000);
    return () => clearInterval(iv);
  }, [etaMinutes, orderedAt]);

  const currentStep = STATUS_STEP[status] ?? 0;
  const isDelivered = status === 'geliefert';
  const isLate = secsLeft < 0 && !isDelivered;

  return (
    <div className={cn('rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4', className)}>
      {/* ETA Countdown */}
      <div className="text-center mb-4">
        {isDelivered ? (
          <div className="text-2xl font-black text-matcha-300">Geliefert! 🎉</div>
        ) : (
          <>
            <div className={cn('text-3xl font-black tabular-nums', isLate ? 'text-red-300' : 'text-white')}>
              {isLate ? '+' : ''}{fmtCountdown(Math.abs(secsLeft))}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mt-0.5">
              {isLate ? 'Etwas verspätet' : 'Geschätzte Restzeit'}
            </div>
          </>
        )}
      </div>

      {/* Step Progress */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-3.5 left-0 right-0 h-px bg-white/20 mx-7" />
        <div
          className="absolute top-3.5 left-0 h-px bg-matcha-400 mx-7 transition-all duration-700"
          style={{
            width: `calc(${Math.min(100, ((currentStep - 1) / (STEPS.length - 1)) * 100)}% )`,
            right: 'auto',
          }}
        />

        <div className="relative flex justify-between">
          {STEPS.map((step, i) => {
            const stepNum = i + 1;
            const done = currentStep > stepNum;
            const active = currentStep === stepNum;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={cn(
                    'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                    done && 'bg-matcha-500 border-matcha-500',
                    active && 'bg-amber-500 border-amber-400 ring-2 ring-amber-400/40',
                    !done && !active && 'bg-white/10 border-white/20',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', done || active ? 'text-white' : 'text-white/30')} />
                </div>
                <span className={cn(
                  'text-center text-[8px] font-semibold leading-tight',
                  done && 'text-matcha-300',
                  active && 'text-amber-300',
                  !done && !active && 'text-white/30',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated time label */}
      {!isDelivered && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/50">
          <Clock className="h-3 w-3" />
          <span>Lieferzeit ca. {etaMinutes} Min ab Bestellung</span>
        </div>
      )}
    </div>
  );
}
