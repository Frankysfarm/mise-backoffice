'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Truck, CheckCircle2, ChefHat, Navigation2 } from 'lucide-react';

type Phase = 'prep' | 'pickup' | 'driving' | 'nearby' | 'delivered';

interface Props {
  orderId?: string;
  initialEtaMin?: number;
  phase?: Phase;
  className?: string;
}

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.ReactNode; color: string; pulse: boolean }> = {
  prep:      { label: 'Wird zubereitet',   icon: <ChefHat className="h-4 w-4" />,       color: 'text-amber-600',  pulse: false },
  pickup:    { label: 'Fahrer unterwegs',  icon: <Truck className="h-4 w-4" />,          color: 'text-blue-600',   pulse: false },
  driving:   { label: 'Auf dem Weg',       icon: <Navigation2 className="h-4 w-4" />,    color: 'text-matcha-700', pulse: false },
  nearby:    { label: 'Fast da!',          icon: <Truck className="h-4 w-4" />,          color: 'text-matcha-700', pulse: true  },
  delivered: { label: 'Angekommen!',       icon: <CheckCircle2 className="h-4 w-4" />,   color: 'text-matcha-600', pulse: false },
};

export function EtaLiveCountdown({ orderId, initialEtaMin, phase = 'driving', className }: Props) {
  const [remainingSec, setRemainingSec] = useState((initialEtaMin ?? 30) * 60);
  const [currentPhase, setCurrentPhase] = useState<Phase>(phase);
  const [liveEtaMin, setLiveEtaMin] = useState(initialEtaMin);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick countdown every second
  useEffect(() => {
    if (currentPhase === 'delivered') return;
    intervalRef.current = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentPhase]);

  // Poll live ETA every 30s
  useEffect(() => {
    if (!orderId || currentPhase === 'delivered') return;
    const poll = () => {
      fetch(`/api/delivery/orders/${orderId}/tracking`)
        .then((r) => r.json())
        .then((j) => {
          if (j.phase) setCurrentPhase(j.phase as Phase);
          if (typeof j.etaMin === 'number') {
            setLiveEtaMin(j.etaMin);
            setRemainingSec(j.etaMin * 60);
          }
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [orderId, currentPhase]);

  const cfg = PHASE_CONFIG[currentPhase];

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  // Urgency: <5min = green, <10min = amber, else blue
  const urgency = currentPhase === 'delivered'
    ? 'matcha'
    : currentPhase === 'nearby'
      ? 'matcha'
      : mins < 5
        ? 'matcha'
        : mins < 10
          ? 'amber'
          : 'blue';

  const urgencyClasses = {
    matcha: { ring: 'ring-matcha-400',  bg: 'bg-matcha-50',  num: 'text-matcha-700', bar: 'bg-matcha-500' },
    amber:  { ring: 'ring-amber-400',   bg: 'bg-amber-50',   num: 'text-amber-700',  bar: 'bg-amber-500'  },
    blue:   { ring: 'ring-blue-300',    bg: 'bg-blue-50',    num: 'text-blue-700',   bar: 'bg-blue-500'   },
  };
  const uc = urgencyClasses[urgency];

  if (currentPhase === 'delivered') {
    return (
      <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 flex items-center gap-3 px-4 py-3', className)}>
        <CheckCircle2 className="h-6 w-6 text-matcha-500 shrink-0" />
        <div>
          <div className="text-sm font-black text-matcha-800">Bestellung angekommen!</div>
          <div className="text-[11px] text-matcha-600">Guten Appetit 🎉</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border overflow-hidden', `ring-2 ${uc.ring}`, uc.bg, className)}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Phase icon */}
        <div className={cn('shrink-0', cfg.color, cfg.pulse && 'animate-pulse')}>
          {cfg.icon}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-[11px] font-bold uppercase tracking-wider', cfg.color)}>
            {cfg.label}
          </div>
          {liveEtaMin !== undefined && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Geschätzte Ankunft in ~{liveEtaMin} Min
            </div>
          )}
        </div>

        {/* Countdown clock */}
        <div className={cn('shrink-0 font-mono text-xl font-black tabular-nums', uc.num)}>
          {String(mins).padStart(2, '0')}
          <span className={cn('text-sm', mins < 5 ? 'animate-pulse' : '')}>:</span>
          {String(secs).padStart(2, '0')}
        </div>
      </div>

      {/* Progress bar — depletes as time passes */}
      {initialEtaMin !== undefined && (
        <div className="h-1.5 bg-black/10">
          <div
            className={cn('h-full transition-all duration-1000 ease-linear', uc.bar)}
            style={{
              width: `${Math.max(2, Math.min(100, (remainingSec / ((initialEtaMin ?? 30) * 60)) * 100))}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
