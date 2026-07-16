'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  orderId: string;
  locationSlug: string;
  className?: string;
}

type OrderPhase = 'waiting' | 'preparing' | 'ready' | 'on_route' | 'delivered';

interface StatusData {
  phase: OrderPhase;
  eta_min: number;
  driver_name: string | null;
}

const MOCK: StatusData = {
  phase: 'on_route',
  eta_min: 8,
  driver_name: 'Max M.',
};

const STEPS: { phase: OrderPhase; label: string }[] = [
  { phase: 'waiting',   label: 'Bestätigt'  },
  { phase: 'preparing', label: 'Zubereitung' },
  { phase: 'on_route',  label: 'Unterwegs'  },
  { phase: 'delivered', label: 'Geliefert'  },
];

const PHASE_ORDER: OrderPhase[] = ['waiting', 'preparing', 'ready', 'on_route', 'delivered'];

export function StorefrontPhase2012LiveTrackingStatusKarte({
  orderId,
  locationSlug,
  className,
}: Props) {
  const [data, setData] = useState<StatusData>(MOCK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/storefront/${encodeURIComponent(locationSlug)}/order-status?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d as StatusData);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  if (!orderId) return null;

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-stone-200 bg-white p-4 animate-pulse', className)}>
        <div className="h-4 w-48 bg-stone-100 rounded mb-3" />
        <div className="h-8 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  const currentPhaseIndex = PHASE_ORDER.indexOf(data.phase);

  const getStepState = (stepPhase: OrderPhase) => {
    const stepIndex = PHASE_ORDER.indexOf(stepPhase);
    if (stepIndex < currentPhaseIndex) return 'done';
    if (stepPhase === data.phase) return 'active';
    return 'pending';
  };

  // Progress bar: fill proportional to steps completed
  const totalSteps = STEPS.length - 1;
  const activeStepIndex = STEPS.findIndex((s) => s.phase === data.phase);
  const progressPct = activeStepIndex >= 0
    ? Math.round((activeStepIndex / totalSteps) * 100)
    : 0;

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white overflow-hidden', className)}>
      {/* Driver chip — shown when on_route */}
      {data.phase === 'on_route' && data.driver_name && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 bg-matcha-50 border border-matcha-200 rounded-xl px-3 py-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-matcha-500" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-matcha-500" />
            </span>
            <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
            <span className="text-sm font-bold text-matcha-800 flex-1">
              {data.driver_name}
              {data.eta_min > 0 && (
                <span className="font-normal text-matcha-600"> · ~{data.eta_min} Min</span>
              )}
            </span>
            <Clock className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start">
          {STEPS.map((step, i) => {
            const state = getStepState(step.phase);
            return (
              <div key={step.phase} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className={cn(
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    state === 'done'
                      ? 'bg-matcha-500 border-matcha-500'
                      : state === 'active'
                        ? 'bg-white border-matcha-500'
                        : 'bg-white border-stone-200',
                  )}>
                    {state === 'done' && (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                    {state === 'active' && (
                      <span className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-semibold text-center leading-tight px-0.5',
                    state === 'pending' ? 'text-stone-400' : 'text-matcha-700',
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all',
                    getStepState(STEPS[i + 1].phase) !== 'pending' || state === 'done'
                      ? 'bg-matcha-300'
                      : 'bg-stone-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-matcha-400 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* "Jetzt verfolgen" subtle link */}
      {data.phase === 'on_route' && data.driver_name && (
        <div className="px-4 pb-3">
          <button className="text-[11px] text-matcha-500 font-medium underline underline-offset-2 hover:text-matcha-700 transition-colors">
            Jetzt verfolgen
          </button>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-4 pb-3">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-matcha-500" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-matcha-500" />
        </span>
        <span className="text-[10px] text-stone-400">Live-Status · aktualisiert alle 30s</span>
      </div>
    </div>
  );
}
