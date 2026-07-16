'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Package, Truck, CheckCircle2 } from 'lucide-react';

interface Props {
  orderId: string;
  locationSlug: string;
  className?: string;
}

type OrderPhase = 'waiting' | 'preparing' | 'ready' | 'on_route' | 'delivered';

interface StatusData {
  phase: OrderPhase;
  eta_min: number;
  prep_min: number;
}

const MOCK: StatusData = {
  phase: 'preparing',
  eta_min: 18,
  prep_min: 15,
};

const PHASE_STEPS: { phase: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { phase: 'waiting',   label: 'Eingegangen',  icon: <Package className="h-4 w-4" /> },
  { phase: 'preparing', label: 'Zubereitung',  icon: <ChefHat className="h-4 w-4" /> },
  { phase: 'ready',     label: 'Bereit',        icon: <CheckCircle2 className="h-4 w-4" /> },
  { phase: 'delivered', label: 'Geliefert',    icon: <CheckCircle2 className="h-4 w-4" /> },
];

const PHASE_ORDER: OrderPhase[] = ['waiting', 'preparing', 'ready', 'on_route', 'delivered'];

const PHASE_LABEL: Record<OrderPhase, string> = {
  waiting:   'Bestellung eingegangen',
  preparing: 'Wird zubereitet',
  ready:     'Bereit zur Abholung',
  on_route:  'Unterwegs zu dir',
  delivered: 'Geliefert!',
};

const CIRCLE_R = 54;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

export function StorefrontPhase2011DynamischeEtaCountdownBoard({
  orderId,
  locationSlug,
  className,
}: Props) {
  const [data, setData] = useState<StatusData>(MOCK);
  const [countdown, setCountdown] = useState<number>(MOCK.eta_min * 60);
  const [totalSec, setTotalSec] = useState<number>(MOCK.eta_min * 60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/storefront/${encodeURIComponent(locationSlug)}/order-status?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setData(d as StatusData);
            const secs = (d as StatusData).eta_min * 60;
            setCountdown(secs);
            setTotalSec(secs);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!orderId) return null;

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-stone-200 bg-white p-5 animate-pulse', className)}>
        <div className="h-5 w-40 bg-stone-100 rounded mb-3" />
        <div className="h-32 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  const phaseIndex = PHASE_ORDER.indexOf(data.phase);
  const stepIndex = PHASE_STEPS.findIndex((s) => s.phase === data.phase);

  const fmtCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const progress = totalSec > 0 ? countdown / totalSec : 0;
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 pt-4 pb-2 border-b border-matcha-200">
        <p className="text-xs font-semibold text-matcha-600 uppercase tracking-wider">Live-ETA</p>
        <p className="text-sm font-bold text-matcha-800">{PHASE_LABEL[data.phase]}</p>
      </div>

      {/* Countdown circle */}
      <div className="flex flex-col items-center py-5 gap-2">
        <div className="relative flex items-center justify-center">
          <svg width="136" height="136" viewBox="0 0 136 136" className="-rotate-90">
            {/* Background track */}
            <circle
              cx="68"
              cy="68"
              r={CIRCLE_R}
              fill="none"
              stroke="#d1fae5"
              strokeWidth="10"
            />
            {/* Animated progress arc */}
            <circle
              cx="68"
              cy="68"
              r={CIRCLE_R}
              fill="none"
              stroke="#4ade80"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              className="drop-shadow-sm"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            {countdown > 0 ? (
              <>
                <span className="font-mono text-3xl font-black tabular-nums text-matcha-800 leading-none">
                  {fmtCountdown(countdown)}
                </span>
                <span className="text-[10px] font-semibold text-matcha-500 mt-0.5">verbleibend</span>
              </>
            ) : (
              <>
                <span className="text-3xl">🎉</span>
                <span className="text-[10px] font-semibold text-matcha-600 mt-0.5">Fertig!</span>
              </>
            )}
          </div>
        </div>

        {/* ETA info */}
        {data.eta_min > 0 && countdown > 0 && (
          <p className="text-xs text-matcha-600 font-medium">
            ca. {Math.ceil(countdown / 60)} Min bis zur Lieferung
          </p>
        )}
      </div>

      {/* Phase dots */}
      <div className="px-5 pb-4">
        <div className="flex items-center">
          {PHASE_STEPS.map((step, i) => {
            const stepPhaseIndex = PHASE_ORDER.indexOf(step.phase);
            const isDone = phaseIndex > stepPhaseIndex;
            const isActive = step.phase === data.phase ||
              (data.phase === 'on_route' && step.phase === 'ready');
            return (
              <div key={step.phase} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                    isDone
                      ? 'bg-matcha-500 border-matcha-500 text-white'
                      : isActive
                        ? 'bg-white border-matcha-500 text-matcha-500'
                        : 'bg-white border-stone-200 text-stone-300',
                  )}>
                    {isActive && !isDone ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-matcha-500 animate-pulse" />
                    ) : (
                      <span className={cn('scale-75', isDone ? 'text-white' : '')}>{step.icon}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-semibold text-center w-14 leading-tight',
                    isDone || isActive ? 'text-matcha-700' : 'text-stone-400',
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < PHASE_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all',
                    isDone ? 'bg-matcha-400' : 'bg-stone-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Motivating text + live pulse */}
      <div className="flex items-center justify-between px-5 pb-3">
        <p className="text-[11px] text-matcha-600 font-medium italic">
          Deine Bestellung ist in guten Händen!
        </p>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-matcha-500" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-matcha-500" />
          </span>
          <span className="text-[9px] text-stone-400">live</span>
        </div>
      </div>
    </div>
  );
}
