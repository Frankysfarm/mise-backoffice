'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Bike, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'eingegangen' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | string;

type Props = {
  status: Status | null;
  etaMinutes: number | null;
  orderedAt: string | null;
  className?: string;
};

const STATUS_STEPS = [
  { key: 'eingegangen',    label: 'Bestellt',       icon: Clock },
  { key: 'in_zubereitung', label: 'Küche',          icon: ChefHat },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: Bike },
  { key: 'geliefert',      label: 'Geliefert',      icon: CheckCircle2 },
];

const STATUS_RANK: Record<string, number> = {
  eingegangen: 0, bestätigt: 0, confirmed: 0,
  in_zubereitung: 1, cooking: 1,
  fertig: 2, ready: 2,
  unterwegs: 2, on_route: 2, in_delivery: 2,
  geliefert: 3, delivered: 3,
};

export function StorefrontPhase1697EtaCountdownBanner({ status, etaMinutes, orderedAt, className }: Props) {
  const [secLeft, setSecLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!orderedAt || !etaMinutes) { setSecLeft(null); return; }
    const targetMs = new Date(orderedAt).getTime() + etaMinutes * 60_000;
    const update = () => setSecLeft(Math.max(0, Math.floor((targetMs - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [orderedAt, etaMinutes]);

  if (!status) return null;

  const rank = STATUS_RANK[status] ?? 0;
  const isDelivered = rank >= 3;

  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className={cn('rounded-xl border bg-matcha-50 border-matcha-200 overflow-hidden', className)}>
      {/* Countdown row */}
      {!isDelivered && secLeft !== null && (
        <div className="flex items-center justify-center gap-2 bg-matcha-600 px-4 py-2">
          <Clock className="h-4 w-4 text-white/80" />
          <span className="text-white font-mono text-lg font-black tabular-nums">
            {fmtCountdown(secLeft)}
          </span>
          <span className="text-white/80 text-xs">verbleibend</span>
        </div>
      )}
      {isDelivered && (
        <div className="flex items-center justify-center gap-2 bg-matcha-600 px-4 py-2">
          <CheckCircle2 className="h-4 w-4 text-white" />
          <span className="text-white font-bold text-sm">Guten Appetit!</span>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center justify-between px-4 py-3">
        {STATUS_STEPS.map((step, idx) => {
          const active = rank === idx;
          const done = rank > idx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                done  ? 'bg-matcha-500 text-white' :
                active ? 'bg-matcha-600 text-white ring-2 ring-matcha-300' :
                         'bg-white border-2 border-muted text-muted-foreground',
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn(
                'text-[10px] font-semibold text-center leading-tight',
                done || active ? 'text-matcha-700' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
              {idx < STATUS_STEPS.length - 1 && (
                <div className="hidden" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
