'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, ChefHat, Bike, Home, Circle } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface Props {
  status: OrderStatus;
  bestellt_am: string | null;
  geschaetzte_lieferung_min?: number | null;
  fahrer_name?: string | null;
  eta_min?: number | null;
  className?: string;
}

interface Step {
  id: OrderStatus | 'pickup';
  label: string;
  sublabel?: string;
  icon: typeof Circle;
}

const STEPS: Step[] = [
  { id: 'bestätigt',    label: 'Bestätigt',      sublabel: 'Bestellung eingegangen',   icon: CheckCircle2 },
  { id: 'in_zubereitung', label: 'Zubereitung', sublabel: 'Deine Bestellung wird gemacht', icon: ChefHat },
  { id: 'pickup',        label: 'Abgeholt',      sublabel: 'Fahrer hat übernommen',    icon: Bike },
  { id: 'unterwegs',     label: 'Unterwegs',     sublabel: 'Wird geliefert',           icon: Bike },
  { id: 'geliefert',     label: 'Geliefert',     sublabel: 'Guten Appetit!',           icon: Home },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'neu':
    case 'bestätigt':       return 0;
    case 'in_zubereitung':  return 1;
    case 'fertig':          return 2;
    case 'unterwegs':       return 3;
    case 'geliefert':       return 4;
    default:                return 0;
  }
}

function CountdownBadge({ targetMs, now }: { targetMs: number; now: number }) {
  const diff = Math.max(0, Math.floor((targetMs - now) / 1000));
  const min = Math.floor(diff / 60);
  const sec = diff % 60;
  if (diff === 0) return <span className="text-matcha-600 font-bold text-xs">Jeden Moment…</span>;
  return (
    <span className="font-mono text-sm font-black tabular-nums text-matcha-700">
      {min}:{String(sec).padStart(2, '0')}
    </span>
  );
}

export function OrderJourneyTimeline({ status, bestellt_am, geschaetzte_lieferung_min, fahrer_name, eta_min, className }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (status === 'storniert') return null;

  const currentStep = getStepIndex(status);
  const bestelltMs = bestellt_am ? new Date(bestellt_am).getTime() : now;
  const etaMs = geschaetzte_lieferung_min
    ? bestelltMs + geschaetzte_lieferung_min * 60_000
    : null;
  const liveEtaMs = eta_min != null ? now + eta_min * 60_000 : etaMs;

  return (
    <div className={cn('rounded-2xl border bg-white p-4', className)}>
      {/* ETA display */}
      {liveEtaMs && status !== 'geliefert' && (
        <div className="mb-4 rounded-xl bg-matcha-50 border border-matcha-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-matcha-600 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">
              Voraussichtliche Lieferzeit
            </div>
            <CountdownBadge targetMs={liveEtaMs} now={now} />
          </div>
          {fahrer_name && status === 'unterwegs' && (
            <div className="text-right">
              <div className="text-[9px] text-muted-foreground">Fahrer</div>
              <div className="text-xs font-bold">{fahrer_name}</div>
            </div>
          )}
        </div>
      )}

      {status === 'geliefert' && (
        <div className="mb-4 rounded-xl bg-matcha-100 border border-matcha-300 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-matcha-700">Geliefert – Guten Appetit! 🎉</span>
        </div>
      )}

      {/* Timeline steps */}
      <div className="relative">
        {/* Connecting line */}
        <div
          className="absolute left-4 top-4 bottom-4 w-0.5 bg-muted"
          aria-hidden
        />
        {/* Progress line */}
        <div
          className="absolute left-4 top-4 w-0.5 bg-matcha-500 transition-all duration-700"
          style={{ height: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          aria-hidden
        />

        <div className="space-y-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = i < currentStep;
            const active = i === currentStep;
            const pending = i > currentStep;

            return (
              <div key={step.id} className="relative flex items-start gap-3 pl-0">
                {/* Icon circle */}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  done    ? 'border-matcha-500 bg-matcha-500 text-white' :
                  active  ? 'border-matcha-500 bg-white text-matcha-600 shadow-md shadow-matcha-100' :
                             'border-muted bg-white text-muted-foreground',
                )}>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className={cn('h-4 w-4', active && 'animate-pulse')} />
                  )}
                </div>

                {/* Label */}
                <div className={cn('pt-0.5', pending && 'opacity-40')}>
                  <div className={cn(
                    'text-xs font-bold',
                    active ? 'text-matcha-700' : done ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {step.label}
                    {active && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-matcha-100 px-1.5 py-0.5 text-[8px] font-bold text-matcha-700">
                        <span className="h-1 w-1 rounded-full bg-matcha-500 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{step.sublabel}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
