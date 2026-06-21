'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, ChefHat, Bike, CheckCircle2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = {
  key: string;
  label: string;
  icon: React.ReactNode;
  ts: string | null;
  done: boolean;
  active: boolean;
};

type Props = {
  orderId: string;
  bestellnummer: string;
};

type OrderData = {
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  eta_earliest: string | null;
  eta_latest: string | null;
};

/* ETA-Verlaufs-Timeline: zeigt alle Phasen einer Lieferbestellung mit Zeitstempeln.
   Abonniert Echtzeit-Updates via Supabase Realtime. */
export function EtaVerlaufTimeline({ orderId, bestellnummer }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!orderId) return;

    supabase
      .from('customer_orders')
      .select('status,bestellt_am,fertig_am,geschaetzte_zubereitung_min,eta_earliest,eta_latest')
      .eq('id', orderId)
      .maybeSingle()
      .then((res: { data: unknown }) => { if (res.data) setOrder(res.data as OrderData); });

    const channel = supabase
      .channel(`eta-timeline-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          if (payload.new) setOrder(payload.new as unknown as OrderData);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (!order) return null;

  const statusOrder = ['neu', 'angenommen', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];
  const currentIdx = statusOrder.indexOf(order.status);

  const fmtTime = (ts: string | null) => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const phases: Phase[] = [
    {
      key: 'bestellt',
      label: 'Bestellt',
      icon: <Package className="h-3.5 w-3.5" />,
      ts: fmtTime(order.bestellt_am),
      done: currentIdx >= 0,
      active: currentIdx === 0,
    },
    {
      key: 'zubereitung',
      label: 'In Zubereitung',
      icon: <ChefHat className="h-3.5 w-3.5" />,
      ts: order.geschaetzte_zubereitung_min && order.bestellt_am
        ? `~${fmtTime(new Date(new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000).toISOString())}`
        : null,
      done: currentIdx >= 2,
      active: currentIdx === 2,
    },
    {
      key: 'fertig',
      label: 'Fertig zur Abholung',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      ts: fmtTime(order.fertig_am),
      done: currentIdx >= 3,
      active: currentIdx === 3,
    },
    {
      key: 'unterwegs',
      label: 'Fahrer unterwegs',
      icon: <Bike className="h-3.5 w-3.5" />,
      ts: order.eta_earliest ? `ETA ${fmtTime(order.eta_earliest)}${order.eta_latest ? '–' + fmtTime(order.eta_latest) : ''}` : null,
      done: currentIdx >= 4,
      active: currentIdx === 4,
    },
    {
      key: 'geliefert',
      label: 'Geliefert',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      ts: null,
      done: currentIdx >= 5,
      active: false,
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Lieferstatus · #{bestellnummer}
        </span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3.5 top-4 bottom-4 w-px bg-stone-200" />

        <div className="space-y-4">
          {phases.map((phase) => (
            <div key={phase.key} className="flex items-start gap-3 relative">
              {/* Dot */}
              <div
                className={cn(
                  'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  phase.done
                    ? 'border-matcha-500 bg-matcha-500 text-white'
                    : phase.active
                    ? 'border-matcha-400 bg-matcha-50 text-matcha-600 animate-pulse'
                    : 'border-stone-200 bg-white text-stone-300',
                )}
              >
                {phase.icon}
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <div
                  className={cn(
                    'text-sm font-bold',
                    phase.done ? 'text-foreground' : phase.active ? 'text-matcha-700' : 'text-stone-300',
                  )}
                >
                  {phase.label}
                </div>
                {phase.ts && (
                  <div className={cn('text-[11px]', phase.done ? 'text-muted-foreground' : 'text-matcha-600 font-semibold')}>
                    {phase.ts}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
