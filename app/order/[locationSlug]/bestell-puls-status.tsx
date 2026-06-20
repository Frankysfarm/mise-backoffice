'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Package, Truck, Clock } from 'lucide-react';

const PHASES = [
  { key: 'bestätigt',      label: 'Angenommen',  icon: Check,    color: 'bg-matcha-500' },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat,  color: 'bg-amber-500'  },
  { key: 'fertig',         label: 'Bereit',       icon: Package,  color: 'bg-blue-500'   },
  { key: 'unterwegs',      label: 'Unterwegs',   icon: Truck,    color: 'bg-matcha-600' },
] as const;

type Phase = typeof PHASES[number]['key'];

interface Props {
  orderId: string;
  bestellnummer: string;
  etaMinutes: number;
  isDelivery: boolean;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

export function BestellPulsStatus({ orderId, bestellnummer, etaMinutes, isDelivery }: Props) {
  useTick();
  const [status, setStatus] = useState<Phase>('bestätigt');
  const [mounted, setMounted] = useState(Date.now());

  useEffect(() => {
    setMounted(Date.now());
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
          if (res.ok) {
            const data = await res.json();
            if (data?.status && !cancelled) setStatus(data.status as Phase);
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [orderId]);

  const currentIdx = PHASES.findIndex((p) => p.key === status);
  const elapsedMin = Math.floor((Date.now() - mounted) / 60_000);
  const remainMin = Math.max(0, etaMinutes - elapsedMin);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground font-mono">Bestellung #{bestellnummer}</div>
          <div className="text-sm font-bold text-foreground">Live-Status</div>
        </div>
        {isDelivery && remainMin > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
            <Clock size={14} className="text-matcha-600" />
            <div>
              <div className="text-[9px] text-matcha-600 font-semibold">ETA</div>
              <div className="font-mono text-sm font-black text-matcha-700 tabular-nums">{remainMin} Min</div>
            </div>
          </div>
        )}
      </div>

      {/* Phase indicators */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[14px] top-[14px] bottom-[14px] w-0.5 bg-border" />
        <div
          className="absolute left-[14px] top-[14px] w-0.5 bg-matcha-500 transition-all duration-1000"
          style={{ height: currentIdx > 0 ? `${(currentIdx / (PHASES.length - 1)) * 100}%` : '0%' }}
        />

        <div className="relative space-y-3">
          {PHASES.map((phase, idx) => {
            const Icon = phase.icon;
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <div className={cn(
                  'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                  done  ? 'bg-matcha-500 border-matcha-500'                   : '',
                  active ? `${phase.color} border-transparent`                : '',
                  !done && !active ? 'bg-card border-border'                  : '',
                )}>
                  <Icon size={13} className={cn(done || active ? 'text-white' : 'text-muted-foreground')} />
                  {active && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: 'currentColor' }} />
                  )}
                </div>
                <div className={cn(
                  'flex-1 text-sm font-semibold transition-colors',
                  done ? 'text-matcha-600' : active ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {phase.label}
                  {active && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  )}
                </div>
                {done && (
                  <Check size={13} className="text-matcha-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Fortschritt</span>
          <span>{Math.round(((currentIdx + 1) / PHASES.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${((currentIdx + 1) / PHASES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
