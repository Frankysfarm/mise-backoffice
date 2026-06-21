'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Package, Truck, Home } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PHASES = [
  { status: 'bestätigt',      label: 'Angenommen',  icon: Check,    color: 'bg-blue-500' },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat,  color: 'bg-orange-500' },
  { status: 'fertig',         label: 'Bereit',      icon: Package,  color: 'bg-amber-500' },
  { status: 'unterwegs',      label: 'Unterwegs',   icon: Truck,    color: 'bg-matcha-500' },
  { status: 'geliefert',      label: 'Geliefert',   icon: Home,     color: 'bg-matcha-600' },
] as const;

type Phase = typeof PHASES[number]['status'];

interface Props {
  orderId: string;
  initialStatus: Phase | string;
  isDelivery?: boolean;
}

function phaseIndex(status: string): number {
  return PHASES.findIndex(p => p.status === status);
}

export function BestellLivePhasenAnzeige({ orderId, initialStatus, isDelivery = true }: Props) {
  const [status, setStatus] = useState<string>(initialStatus);
  const supabase = createClient();

  useEffect(() => {
    if (!orderId) return;
    const ch = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const newStatus = payload.new?.status as string | undefined;
          if (newStatus) setStatus(newStatus);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, supabase]);

  const currentIdx = phaseIndex(status);
  const visiblePhases = isDelivery ? PHASES : PHASES.filter(p => p.status !== 'unterwegs' && p.status !== 'geliefert');

  if (currentIdx === -1) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Bestellstatus · Live
      </div>

      <div className="relative flex items-center justify-between">
        {/* Connecting line */}
        <div className="absolute inset-x-0 top-5 h-0.5 bg-muted mx-6" />
        <div
          className="absolute top-5 h-0.5 bg-matcha-500 transition-all duration-700 mx-6"
          style={{
            width: currentIdx <= 0
              ? '0%'
              : `${(currentIdx / (visiblePhases.length - 1)) * 100}%`,
          }}
        />

        {visiblePhases.map((phase, i) => {
          const phaseIdx = phaseIndex(phase.status);
          const done = phaseIdx < currentIdx;
          const active = phaseIdx === currentIdx;
          const upcoming = phaseIdx > currentIdx;
          const Icon = phase.icon;

          return (
            <div key={phase.status} className="relative flex flex-col items-center gap-2 z-10">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center transition-all duration-500',
                done ? 'bg-matcha-500 text-white' :
                active ? `${phase.color} text-white ring-4 ring-matcha-200 animate-pulse` :
                'bg-muted text-muted-foreground',
              )}>
                {done
                  ? <Check size={16} strokeWidth={3} />
                  : <Icon size={16} />}
              </div>
              <span className={cn(
                'text-[9px] font-bold text-center leading-tight max-w-[48px]',
                active ? 'text-foreground' : done ? 'text-matcha-600' : 'text-muted-foreground',
              )}>
                {phase.label}
              </span>
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full mt-1 rounded-full bg-matcha-500 px-1.5 py-0.5 text-[8px] font-black text-white whitespace-nowrap">
                  jetzt
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase message */}
      <div className="mt-8 rounded-xl bg-muted/50 px-3 py-2 text-center">
        <p className="text-xs font-semibold text-foreground">
          {status === 'bestätigt' ? 'Deine Bestellung wurde angenommen 🎉' :
           status === 'in_zubereitung' ? 'Dein Essen wird gerade zubereitet 👨‍🍳' :
           status === 'fertig' ? 'Bereit zur Abholung — Fahrer kommt gleich 📦' :
           status === 'unterwegs' ? 'Dein Fahrer ist unterwegs 🚴' :
           status === 'geliefert' ? 'Geliefert! Guten Appetit 🍽️' :
           'Bestellung wird bearbeitet…'}
        </p>
      </div>
    </div>
  );
}
