'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, ChefHat, Package, CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  orderId: string;
  initialStatus?: string;
  initialEtaMin?: number | null;
}

type Phase = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const PHASES: { key: Phase; label: string; icon: typeof ChefHat; desc: string }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',        icon: CheckCircle2, desc: 'Bestellung angenommen' },
  { key: 'in_zubereitung', label: 'In Zubereitung',   icon: ChefHat,      desc: 'Küche bereitet zu' },
  { key: 'fertig',         label: 'Fertig',            icon: Package,      desc: 'Warte auf Fahrer' },
  { key: 'unterwegs',      label: 'Unterwegs',         icon: Bike,         desc: 'Fahrer ist unterwegs' },
  { key: 'geliefert',      label: 'Geliefert',         icon: CheckCircle2, desc: 'Guten Appetit!' },
];

const PHASE_ORDER: Phase[] = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(status: string): number {
  return PHASE_ORDER.indexOf(status as Phase);
}

export function Phase930DynamischeEtaLive({ orderId, initialStatus = 'neu', initialEtaMin }: Props) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`order-eta-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}`
      }, (payload: any) => {
        const row = payload.new as any;
        if (row.status) setStatus(row.status);
        if (row.eta_earliest) {
          const mins = Math.max(0, Math.ceil((new Date(row.eta_earliest).getTime() - Date.now()) / 60_000));
          setEtaMin(mins);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const displayEta = etaMin !== null ? Math.max(0, etaMin - elapsed) : null;
  const currentIdx = phaseIndex(status);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* ETA header */}
      <div className="bg-matcha-600 text-white px-4 py-4 text-center">
        {displayEta !== null && displayEta > 0 ? (
          <>
            <div className="text-3xl font-bold">{displayEta} Min</div>
            <div className="text-sm text-matcha-100 mt-1">Geschätzte Lieferzeit</div>
          </>
        ) : status === 'geliefert' ? (
          <div className="flex items-center justify-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Geliefert — Guten Appetit!
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-matcha-100">
            <Loader2 className="w-4 h-4 animate-spin" />
            Berechne ETA...
          </div>
        )}
      </div>

      {/* Phase timeline */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-stone-100" />

          <div className="flex flex-col gap-3">
            {PHASES.map((phase, i) => {
              const phIdx = PHASE_ORDER.indexOf(phase.key);
              const isDone = currentIdx > phIdx;
              const isCurrent = currentIdx === phIdx;
              const Icon = phase.icon;

              return (
                <div key={phase.key} className="relative flex items-start gap-3 pl-0">
                  {/* Icon circle */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-none border-2 relative z-10',
                    isDone ? 'bg-matcha-500 border-matcha-500 text-white' :
                    isCurrent ? 'bg-white border-saffron text-saffron animate-pulse' :
                    'bg-white border-stone-200 text-stone-300'
                  )}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>

                  {/* Text */}
                  <div className="pt-1">
                    <div className={cn('text-sm font-medium',
                      isDone ? 'text-matcha-700' : isCurrent ? 'text-stone-900' : 'text-stone-400'
                    )}>
                      {phase.label}
                    </div>
                    {isCurrent && (
                      <div className="text-xs text-saffron-dark font-medium">{phase.desc}</div>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="ml-auto text-[10px] text-saffron bg-saffron/10 px-2 py-0.5 rounded-full font-medium mt-1">
                      Aktuell
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 py-2 border-t border-stone-100 text-[10px] text-stone-400">
        <div className="w-1.5 h-1.5 rounded-full bg-matcha-500 animate-pulse" />
        Live-Tracking aktiv
      </div>
    </div>
  );
}
