'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Package, Bike, Home } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'angenommen' | 'in_zubereitung'
  | 'fertig' | 'unterwegs' | 'geliefert' | 'abgeschlossen';

interface Props {
  orderId: string;
  initialStatus?: OrderStatus;
}

const STEPS: {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  statuses: OrderStatus[];
}[] = [
  {
    id: 'accepted',
    label: 'Angenommen',
    sublabel: 'Deine Bestellung ist eingegangen',
    icon: CheckCircle2,
    statuses: ['bestätigt', 'angenommen'],
  },
  {
    id: 'cooking',
    label: 'In Zubereitung',
    sublabel: 'Die Küche bereitet dein Essen zu',
    icon: ChefHat,
    statuses: ['in_zubereitung'],
  },
  {
    id: 'ready',
    label: 'Fertig',
    sublabel: 'Essen ist fertig und wartet auf Abholung',
    icon: Package,
    statuses: ['fertig'],
  },
  {
    id: 'ontheway',
    label: 'Unterwegs',
    sublabel: 'Fahrer ist auf dem Weg zu dir',
    icon: Bike,
    statuses: ['unterwegs'],
  },
  {
    id: 'delivered',
    label: 'Zugestellt',
    sublabel: 'Guten Appetit!',
    icon: Home,
    statuses: ['geliefert', 'abgeschlossen'],
  },
];

function getStepIndex(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if ((STEPS[i].statuses as string[]).includes(status)) return i;
  }
  if (status === 'neu') return 0;
  return -1;
}

export function OrderStatusStepBand({ orderId, initialStatus = 'bestätigt' }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/tracking`, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      if (d.status) setStatus(d.status as OrderStatus);
      if (d.eta_min != null) setEtaMin(Math.round(d.eta_min));
    } catch {}
  }, [orderId]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, [poll]);

  const activeIdx = getStepIndex(status);
  const isTerminal = status === 'geliefert' || status === 'abgeschlossen';

  if (activeIdx < 0) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-soft overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-matcha-100 w-full">
        <div
          className="h-full bg-matcha-500 transition-all duration-1000 rounded-full"
          style={{ width: `${Math.round(((activeIdx + 1) / STEPS.length) * 100)}%` }}
        />
      </div>

      {/* ETA header */}
      {!isTerminal && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-100 bg-matcha-50/60">
          <Clock className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
          <span className="text-[11px] font-bold text-matcha-700">
            {etaMin != null
              ? etaMin <= 5 ? 'Ankunft in wenigen Minuten' : `Voraussichtlich in ca. ${etaMin} Min`
              : 'Bestellung wird bearbeitet…'}
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="px-4 py-3">
        <div className="relative flex items-start gap-0">
          {STEPS.map((step, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            const upcoming = i > activeIdx;
            const Icon = step.icon;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                {/* Connector line */}
                <div className="relative w-full flex items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        'absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-0.5',
                        done || active ? 'bg-matcha-400' : 'bg-matcha-100',
                      )}
                    />
                  )}
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5',
                        done ? 'bg-matcha-400' : 'bg-matcha-100',
                      )}
                    />
                  )}

                  {/* Icon circle */}
                  <div className={cn(
                    'relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-700',
                    done
                      ? 'border-matcha-400 bg-matcha-400'
                      : active
                      ? 'border-matcha-500 bg-white shadow-md shadow-matcha-200 scale-110'
                      : 'border-matcha-200 bg-white',
                  )}>
                    <Icon className={cn(
                      'h-3.5 w-3.5 transition-colors',
                      done ? 'text-white' : active ? 'text-matcha-600' : 'text-matcha-300',
                      active && 'animate-pulse',
                    )} />
                  </div>
                </div>

                {/* Label */}
                <div className="mt-1.5 text-center px-0.5">
                  <div className={cn(
                    'text-[9px] font-bold leading-tight',
                    done ? 'text-matcha-500' : active ? 'text-matcha-700 font-black' : 'text-matcha-300',
                  )}>
                    {step.label}
                  </div>
                  {active && (
                    <div className="text-[8px] text-matcha-500 mt-0.5 leading-tight hidden sm:block">
                      {step.sublabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Active step sublabel on mobile */}
        {activeIdx >= 0 && (
          <div className="mt-2.5 text-center sm:hidden">
            <span className="text-[11px] text-matcha-600 font-medium">
              {STEPS[activeIdx]?.sublabel}
            </span>
          </div>
        )}
      </div>

      {isTerminal && (
        <div className="border-t border-matcha-100 bg-matcha-50 px-4 py-3 text-center">
          <span className="text-[12px] font-bold text-matcha-600">
            🎉 Zugestellt — Guten Appetit!
          </span>
        </div>
      )}
    </div>
  );
}
