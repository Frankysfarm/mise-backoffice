'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Truck, ChefHat, Package, Clock } from 'lucide-react';

const STEPS = [
  { key: 'bestätigt',     label: 'Bestätigt',   icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'fertig',        label: 'Fertig',       icon: Package },
  { key: 'unterwegs',     label: 'Unterwegs',    icon: Truck },
  { key: 'geliefert',     label: 'Geliefert',    icon: CheckCircle2 },
] as const;

type StepKey = typeof STEPS[number]['key'];

function stepIndex(status: string | null): number {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

interface LiveDriverTrackerProps {
  orderId: string;
  initialStatus?: string | null;
}

export function LiveDriverTracker({ orderId, initialStatus }: LiveDriverTrackerProps) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/events`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.status) setStatus(data.status);
        }
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 30000);

    const supabase = createClient();
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload) => {
          if (!cancelled && payload.new?.status) setStatus(payload.new.status as string);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const currentIdx = stepIndex(status);
  const isDelivered = status === 'geliefert';
  const isUnterwegs = status === 'unterwegs';

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border',
      isDelivered ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-card',
    )}>
      {isDelivered ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
          <div className="rounded-full bg-emerald-500 p-4">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-800">Geliefert!</div>
            <div className="text-sm text-emerald-600 mt-0.5">Ihre Bestellung ist angekommen.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider">Lieferstatus</span>
          </div>

          {isUnterwegs && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b">
              <Truck className="h-5 w-5 text-blue-600 animate-bounce" />
              <span className="text-sm font-bold text-blue-800">Fahrer ist unterwegs!</span>
            </div>
          )}

          <div className="px-4 py-4">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted -z-0" />
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
                    <div className={cn(
                      'rounded-full p-1.5 border-2 transition-colors',
                      done
                        ? active
                          ? 'bg-matcha-500 border-matcha-500 text-white'
                          : 'bg-matcha-100 border-matcha-300 text-matcha-700'
                        : 'bg-white border-border text-muted-foreground',
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className={cn(
                      'text-[9px] font-semibold text-center leading-tight',
                      done ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
