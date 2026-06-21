'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Package, Truck, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Phase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Milestone {
  phase: Phase;
  label: string;
  icon: React.ElementType;
  timestamp: string | null;
}

interface Props {
  orderId: string;
  initialStatus?: string | null;
}

const PHASE_ORDER: Phase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

const ICONS: Record<Phase, React.ElementType> = {
  bestätigt: Check,
  in_zubereitung: ChefHat,
  fertig: Package,
  unterwegs: Truck,
  geliefert: Star,
};

const LABELS: Record<Phase, string> = {
  bestätigt: 'Angenommen',
  in_zubereitung: 'Zubereitung',
  fertig: 'Bereit',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
};

function phaseIndex(status: string | null | undefined): number {
  const map: Record<string, number> = {
    neu: 0, bestätigt: 0, angenommen: 0,
    in_zubereitung: 1, preparing: 1,
    fertig: 2, ready: 2,
    unterwegs: 3, out_for_delivery: 3, picked_up: 3,
    geliefert: 4, delivered: 4, completed: 4,
  };
  return map[status ?? ''] ?? 0;
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function LiveBestellstatusTimeline({ orderId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus ?? 'neu');
  const [milestones, setMilestones] = useState<Partial<Record<Phase, string>>>({});

  useEffect(() => {
    if (!orderId) return;
    const supabase = createClient();

    supabase
      .from('customer_orders')
      .select('status, bestellt_am, zubereitung_gestartet_am, fertig_am, abgeholt_am, geliefert_am')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStatus(data.status ?? 'neu');
        const ts: Partial<Record<Phase, string>> = {};
        if (data.bestellt_am) ts.bestätigt = data.bestellt_am;
        if (data.zubereitung_gestartet_am) ts.in_zubereitung = data.zubereitung_gestartet_am;
        if (data.fertig_am) ts.fertig = data.fertig_am;
        if (data.abgeholt_am) ts.unterwegs = data.abgeholt_am;
        if (data.geliefert_am) ts.geliefert = data.geliefert_am;
        setMilestones(ts);
      });

    const ch = supabase
      .channel(`order-timeline-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const d = payload.new as Record<string, string | null>;
        setStatus(d.status ?? status);
        setMilestones((prev) => {
          const ts = { ...prev };
          if (d.bestellt_am && !ts.bestätigt) ts.bestätigt = d.bestellt_am;
          if (d.zubereitung_gestartet_am) ts.in_zubereitung = d.zubereitung_gestartet_am;
          if (d.fertig_am) ts.fertig = d.fertig_am;
          if (d.abgeholt_am) ts.unterwegs = d.abgeholt_am;
          if (d.geliefert_am) ts.geliefert = d.geliefert_am;
          return ts;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  const currentIdx = phaseIndex(status);

  return (
    <div className="py-2">
      <div className="flex items-start">
        {PHASE_ORDER.map((phase, idx) => {
          const Icon = ICONS[phase];
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const ts = fmtTime(milestones[phase] ?? null);

          return (
            <div key={phase} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx < PHASE_ORDER.length - 1 && (
                <div className="absolute top-4 left-1/2 w-full h-0.5 z-0">
                  <div className={cn(
                    'h-full transition-all duration-700',
                    idx < currentIdx ? 'bg-matcha-500' : 'bg-stone-200',
                  )} />
                </div>
              )}

              {/* Icon bubble */}
              <div className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                isDone
                  ? 'border-matcha-500 bg-matcha-500 text-white'
                  : isActive
                    ? 'border-matcha-500 bg-white text-matcha-600 shadow-md ring-4 ring-matcha-100'
                    : 'border-stone-200 bg-white text-stone-300',
              )}>
                <Icon className="h-3.5 w-3.5" />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-matcha-400 border-2 border-white animate-pulse" />
                )}
              </div>

              {/* Label + time */}
              <div className="mt-1.5 text-center px-1">
                <div className={cn(
                  'text-[10px] font-bold leading-tight',
                  isDone || isActive ? 'text-foreground' : 'text-stone-300',
                )}>
                  {LABELS[phase]}
                </div>
                {ts && (
                  <div className="text-[9px] text-muted-foreground tabular-nums mt-0.5">{ts}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
