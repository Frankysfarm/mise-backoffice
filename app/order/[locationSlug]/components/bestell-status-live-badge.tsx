'use client';

import * as React from 'react';
import { CheckCircle2, ChefHat, Package, Bike, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  status: string | null;
  isDelivery: boolean;
  className?: string;
}

type Step = { key: string; label: string; icon: React.ReactNode };

const DELIVERY_STEPS: Step[] = [
  { key: 'received',    label: 'Bestellung eingegangen', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'preparing',  label: 'In Zubereitung',         icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'ready',      label: 'Fertig verpackt',        icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'delivering', label: 'Unterwegs',              icon: <Bike className="h-3.5 w-3.5" /> },
  { key: 'done',       label: 'Geliefert',              icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const PICKUP_STEPS: Step[] = [
  { key: 'received',   label: 'Bestellung eingegangen', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'preparing',  label: 'In Zubereitung',         icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'ready',      label: 'Abholbereit',            icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'done',       label: 'Abgeholt',               icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

function statusToStep(status: string | null, isDelivery: boolean): number {
  const s = (status ?? '').toLowerCase();
  if (!s || s === 'neu' || s === 'angenommen' || s === 'bestätigt') return 0;
  if (s === 'in_zubereitung' || s === 'cooking') return 1;
  if (s === 'fertig' || s === 'ready' || s === 'bereit') return 2;
  if (isDelivery && (s === 'unterwegs' || s === 'on_route' || s === 'geliefert_start')) return 3;
  if (s === 'geliefert' || s === 'abgeholt' || s === 'done' || s === 'completed') return isDelivery ? 4 : 3;
  return 0;
}

export function BestellStatusLiveBadge({ status, isDelivery, className }: Props) {
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const activeIdx = statusToStep(status, isDelivery);

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white px-4 py-3', className)}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        Bestellstatus
      </div>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => {
          const done    = i < activeIdx;
          const active  = i === activeIdx;
          const pending = i > activeIdx;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                  done    ? 'bg-matcha-500 text-white' :
                  active  ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400 ring-offset-1' :
                            'bg-stone-100 text-stone-300',
                )}>
                  {step.icon}
                </div>
                <div className={cn(
                  'text-center text-[8px] font-semibold leading-tight px-0.5',
                  done ? 'text-matcha-600' : active ? 'text-matcha-700 font-bold' : 'text-stone-300',
                )}>
                  {step.label}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  'mt-3.5 h-0.5 flex-shrink w-4',
                  i < activeIdx ? 'bg-matcha-400' : 'bg-stone-100',
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
