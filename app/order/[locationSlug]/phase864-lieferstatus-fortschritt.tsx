'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Bike, Package, Clock } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | string;

interface Props {
  orderId: string | null;
  currentStatus: OrderStatus | null;
}

interface Step {
  key: string;
  label: string;
  icon: React.ReactNode;
  statuses: string[];
}

const STEPS: Step[] = [
  { key: 'bestellt', label: 'Bestellt', icon: <Clock className="h-3.5 w-3.5" />, statuses: ['neu', 'bestätigt'] },
  { key: 'kueche', label: 'Küche', icon: <ChefHat className="h-3.5 w-3.5" />, statuses: ['in_zubereitung'] },
  { key: 'fertig', label: 'Fertig', icon: <Package className="h-3.5 w-3.5" />, statuses: ['fertig'] },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="h-3.5 w-3.5" />, statuses: ['unterwegs'] },
  { key: 'geliefert', label: 'Geliefert', icon: <CheckCircle2 className="h-3.5 w-3.5" />, statuses: ['geliefert'] },
];

function getStepIndex(status: string | null): number {
  if (!status) return 0;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

export function Phase864LieferstatusFortschritt({ orderId, currentStatus }: Props) {
  const [status, setStatus] = useState<string | null>(currentStatus);

  useEffect(() => { setStatus(currentStatus); }, [currentStatus]);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && json?.status) setStatus(json.status);
        }
      } catch { /* ignore */ }
    }
    poll();
    const iv = setInterval(poll, 20_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  const activeIdx = getStepIndex(status);
  const isDelivered = status === 'geliefert';

  if (!status || status === 'storniert') return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="text-xs font-bold text-foreground">Bestellstatus</div>

      {/* Step indicator */}
      <div className="relative flex items-center justify-between">
        {/* connecting line */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted -z-0" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-matcha-500 transition-all duration-700 -z-0"
          style={{ width: activeIdx === 0 ? '0%' : `${(activeIdx / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done ? 'bg-matcha-500 border-matcha-500 text-white' :
                active ? 'bg-matcha-100 border-matcha-500 text-matcha-700 ring-2 ring-matcha-200 ring-offset-1' :
                'bg-background border-border text-muted-foreground',
              )}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
              </div>
              <span className={cn(
                'text-[10px] font-semibold text-center leading-tight max-w-[48px]',
                active ? 'text-matcha-700' : done ? 'text-matcha-600' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <div className={cn(
        'text-center text-xs font-semibold py-1.5 rounded-xl',
        isDelivered ? 'text-matcha-700 bg-matcha-50' : 'text-amber-700 bg-amber-50',
      )}>
        {isDelivered ? '🎉 Deine Bestellung wurde geliefert!' :
         status === 'unterwegs' ? '🛵 Fahrer ist unterwegs zu dir' :
         status === 'fertig' ? '📦 Bestellung wird gleich abgeholt' :
         status === 'in_zubereitung' ? '👨‍🍳 Deine Bestellung wird zubereitet' :
         '✅ Bestellung bestätigt'}
      </div>
    </div>
  );
}
