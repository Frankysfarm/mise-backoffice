'use client';

import { useEffect, useState } from 'react';
import { Check, ChefHat, Clock, MapPin, Package, Truck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = {
  status: string;
  label: string;
  icon: React.ElementType;
  color: string;
};

const STEPS: Step[] = [
  { status: 'bestätigt',      label: 'Bestätigt',    icon: Check,    color: 'bg-blue-500'    },
  { status: 'in_zubereitung', label: 'Zubereitung',  icon: ChefHat,  color: 'bg-amber-500'   },
  { status: 'fertig',         label: 'Fertig',       icon: Package,  color: 'bg-matcha-500'  },
  { status: 'unterwegs',      label: 'Unterwegs',    icon: Truck,    color: 'bg-blue-600'    },
  { status: 'geliefert',      label: 'Geliefert',    icon: Star,     color: 'bg-emerald-500' },
];

const STATUS_STEP_INDEX: Record<string, number> = {
  neu: -1,
  bestätigt: 0,
  angenommen: 0,
  in_zubereitung: 1,
  preparing: 1,
  fertig: 2,
  ready: 2,
  unterwegs: 3,
  out_for_delivery: 3,
  picked_up: 3,
  geliefert: 4,
  delivered: 4,
  completed: 4,
};

interface Event {
  status: string;
  ts: string;
}

interface Props {
  orderId: string;
  currentStatus: string;
  events?: Event[];
  className?: string;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function useRelativeTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${diff} Min`;
  const h = Math.floor(diff / 60);
  return `vor ${h} Std`;
}

export function OrderStatusZeitleiste({ orderId, currentStatus, events = [], className }: Props) {
  useRelativeTick();
  const [liveEvents, setLiveEvents] = useState<Event[]>(events);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/events`);
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (Array.isArray(data?.events)) setLiveEvents(data.events);
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  const currentIdx = STATUS_STEP_INDEX[currentStatus] ?? -1;

  // Build event map: status → timestamp
  const eventMap = new Map<string, string>();
  for (const e of liveEvents) {
    if (!eventMap.has(e.status)) eventMap.set(e.status, e.ts);
  }

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Bestellverlauf
        </span>
      </div>

      <div className="px-4 py-3">
        <ol className="relative space-y-0">
          {STEPS.map((step, i) => {
            const isCompleted = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const isLast = i === STEPS.length - 1;
            const Icon = step.icon;
            const eventTs = eventMap.get(step.status);

            return (
              <li key={step.status} className="flex gap-3 pb-4 last:pb-0 relative">
                {/* Vertical line */}
                {!isLast && (
                  <div className={cn(
                    'absolute left-[13px] top-7 bottom-0 w-0.5 rounded-full',
                    isCompleted ? 'bg-matcha-300' : 'bg-muted',
                  )} />
                )}

                {/* Icon circle */}
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-300',
                  isCompleted
                    ? cn('text-white shadow-sm', step.color)
                    : 'bg-muted text-muted-foreground',
                  isCurrent && 'ring-2 ring-offset-1 ring-matcha-400',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Label + time */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2 pt-0.5">
                  <span className={cn(
                    'text-sm font-semibold',
                    isCompleted ? 'text-foreground' : 'text-muted-foreground',
                    isCurrent && 'font-bold',
                  )}>
                    {step.label}
                    {isCurrent && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-matcha-100 px-1.5 py-0.5 text-[9px] font-black text-matcha-700 animate-pulse">
                        Live
                      </span>
                    )}
                  </span>

                  {eventTs && (
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-foreground tabular-nums">
                        {fmtTime(eventTs)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {relativeTime(eventTs)}
                      </div>
                    </div>
                  )}

                  {!eventTs && !isCompleted && (
                    <span className="text-[10px] text-muted-foreground/50">–</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
