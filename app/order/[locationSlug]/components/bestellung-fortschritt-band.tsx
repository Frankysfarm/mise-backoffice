'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Clock, Package, Truck } from 'lucide-react';

type Stage = {
  status: string;
  label: string;
  icon: React.ElementType;
};

const STAGES: Stage[] = [
  { status: 'bestätigt',      label: 'Bestätigt',   icon: Check    },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat  },
  { status: 'fertig',         label: 'Bereit',      icon: Package  },
  { status: 'unterwegs',      label: 'Unterwegs',   icon: Truck    },
  { status: 'geliefert',      label: 'Geliefert',   icon: Check    },
];

const STATUS_IDX: Record<string, number> = {
  'neu': 0, 'bestätigt': 0, 'in_zubereitung': 1,
  'fertig': 2, 'unterwegs': 3, 'geliefert': 4,
};

function fmtCountdown(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'gleich';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} Min`;
  return `${s} Sek`;
}

interface Props {
  orderId: string;
  initialStatus: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  isDelivery: boolean;
}

export function BestellungFortschrittBand({ orderId, initialStatus, etaEarliest, etaLatest, isDelivery }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [eta, setEta] = useState(etaEarliest);
  const [, setTick] = useState(0);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`bestellung-fortschritt-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (row.status) setStatus(row.status as string);
          if (row.eta_earliest) setEta(row.eta_earliest as string);
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [orderId, supabase]);

  const stages = isDelivery ? STAGES : STAGES.filter(s => s.status !== 'unterwegs');
  const currentIdx = STATUS_IDX[status] ?? 0;
  const delivered = status === 'geliefert';

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-4">
      {/* Progress dots */}
      <div className="relative flex items-center justify-between mb-3">
        {/* Track line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-100 mx-6" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-matcha-500 transition-all duration-1000 mx-6"
          style={{ width: `${(currentIdx / (stages.length - 1)) * 100}%` }}
        />

        {stages.map((stage, i) => {
          const done = i < currentIdx || delivered;
          const active = i === currentIdx && !delivered;
          const Icon = stage.icon;
          return (
            <div key={stage.status} className="relative z-10 flex flex-col items-center gap-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                done || delivered
                  ? 'bg-matcha-500 border-matcha-600'
                  : active
                  ? 'bg-white border-matcha-500 ring-2 ring-matcha-200 shadow-md'
                  : 'bg-white border-gray-200',
              )}>
                {active ? (
                  <div className="w-2 h-2 rounded-full bg-matcha-500 animate-pulse" />
                ) : (
                  <Icon
                    size={14}
                    className={done || delivered ? 'text-white' : 'text-gray-300'}
                  />
                )}
              </div>
              <span className={cn(
                'text-[9px] font-semibold text-center leading-tight max-w-[48px]',
                active ? 'text-matcha-700' : done || delivered ? 'text-matcha-500' : 'text-gray-300',
              )}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ETA row */}
      {!delivered && eta && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Clock size={11} className="text-matcha-500" />
          <span className="text-xs text-gray-600">
            Ankunft{' '}
            <span className="font-black text-matcha-700 tabular-nums">
              {fmtCountdown(eta)}
            </span>
            {etaLatest && eta !== etaLatest && (
              <span className="text-gray-400 ml-1">
                – {fmtCountdown(etaLatest)}
              </span>
            )}
          </span>
        </div>
      )}
      {delivered && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Check size={12} className="text-matcha-500" />
          <span className="text-xs font-semibold text-matcha-700">Erfolgreich geliefert!</span>
        </div>
      )}
    </div>
  );
}
