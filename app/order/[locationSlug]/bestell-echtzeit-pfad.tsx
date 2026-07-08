'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Check, ChefHat, Package, Truck, Clock, AlertCircle } from 'lucide-react';

type OrderStatus =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert';

type Stage = {
  status: OrderStatus;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
};

const STAGES: Stage[] = [
  { status: 'bestätigt',      label: 'Bestätigt',   sublabel: 'Küche informiert',   icon: <Check className="h-4 w-4" /> },
  { status: 'in_zubereitung', label: 'Zubereitung', sublabel: 'Köche arbeiten',     icon: <ChefHat className="h-4 w-4" /> },
  { status: 'fertig',         label: 'Bereit',      sublabel: 'Fahrer abholen',     icon: <Package className="h-4 w-4" /> },
  { status: 'unterwegs',      label: 'Unterwegs',   sublabel: 'Fahrer auf dem Weg', icon: <Truck className="h-4 w-4" /> },
  { status: 'geliefert',      label: 'Geliefert',   sublabel: 'Guten Appetit!',     icon: <Check className="h-4 w-4" /> },
];

const STATUS_ORDER: Record<string, number> = {
  bestätigt: 0, in_zubereitung: 1, fertig: 2, unterwegs: 3, geliefert: 4,
};

interface Props {
  orderId: string;
  initialStatus?: string;
  initialEtaMin?: number;
}

export function BestellungEchtzeitPfad({ orderId, initialStatus = 'bestätigt', initialEtaMin = 35 }: Props) {
  const supabase = createClient();
  const [status, setStatus] = useState(initialStatus);
  const [etaMin, setEtaMin] = useState(initialEtaMin);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startTs] = useState(Date.now());

  // Tick for countdown
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startTs) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTs]);

  // Realtime status updates
  useEffect(() => {
    const ch = supabase
      .channel(`order-pfad-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const r = payload.new as any;
          if (r.status) setStatus(r.status);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const currentIdx = STATUS_ORDER[status] ?? 0;
  const done = status === 'geliefert';

  const remainSec = Math.max(0, etaMin * 60 - elapsedSec);
  const remainMin = Math.floor(remainSec / 60);
  const remainSecPart = remainSec % 60;
  const progressPct = Math.min(100, Math.round((elapsedSec / (etaMin * 60)) * 100));

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header with countdown */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 border-b',
        done ? 'bg-matcha-50' : 'bg-card',
      )}>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          done ? 'bg-matcha-500' : progressPct > 80 ? 'bg-amber-100' : 'bg-matcha-100',
        )}>
          {done
            ? <Check className="h-5 w-5 text-white" />
            : progressPct > 80
              ? <AlertCircle className="h-5 w-5 text-amber-600" />
              : <Clock className="h-5 w-5 text-matcha-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">
            {done ? 'Bestellung geliefert' : `Noch ca. ${remainMin}:${String(remainSecPart).padStart(2, '0')} Min`}
          </div>
          <div className="text-xs text-muted-foreground">
            {done ? 'Guten Appetit!' : STAGES[currentIdx]?.sublabel ?? 'In Bearbeitung'}
          </div>
        </div>
        {!done && (
          <div className="shrink-0 text-right">
            <div className="text-xs font-black tabular-nums text-matcha-600">{progressPct}%</div>
            <div className="text-[9px] text-muted-foreground">Fortschritt</div>
          </div>
        )}
      </div>

      {/* Progress track */}
      {!done && (
        <div className="px-4 pt-2 pb-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stage steps */}
      <div className="px-4 py-3">
        <div className="relative flex items-start gap-0">
          {/* connecting line */}
          <div className="absolute left-[15px] top-[16px] bottom-[16px] w-0.5 bg-muted" />

          <div className="flex flex-col gap-3 w-full">
            {STAGES.map((stage, idx) => {
              const isDone = STATUS_ORDER[status] > idx;
              const isActive = STATUS_ORDER[status] === idx;
              const isFuture = STATUS_ORDER[status] < idx;

              return (
                <div key={stage.status} className="flex items-center gap-3 relative">
                  {/* Circle */}
                  <div className={cn(
                    'relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                    isDone   ? 'bg-matcha-500 border-matcha-500 text-white' :
                    isActive ? 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-200' :
                               'bg-white border-muted text-muted-foreground',
                  )}>
                    {isDone
                      ? <Check className="h-3.5 w-3.5" />
                      : isActive
                        ? <span className="animate-pulse">{stage.icon}</span>
                        : stage.icon
                    }
                  </div>

                  {/* Label */}
                  <div className={cn(
                    'flex-1 transition-all',
                    isFuture ? 'opacity-40' : 'opacity-100',
                  )}>
                    <div className={cn(
                      'text-sm font-bold leading-tight',
                      isActive ? 'text-matcha-700' : isDone ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {stage.label}
                    </div>
                    {isActive && (
                      <div className="text-xs text-matcha-600 mt-0.5">{stage.sublabel}</div>
                    )}
                  </div>

                  {isActive && (
                    <span className="shrink-0 inline-flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
