'use client';

/**
 * Phase 2605 — ETA Live Tracking Final (Storefront)
 *
 * Dynamische ETA-Anzeige mit Bestell-Phasen-Fortschritt,
 * Fahrer-Nähe-Indikator und Live-Countdown.
 * Bestätigt, Küche, Fahrer unterwegs, Geliefert.
 * 30-Sek-Polling + 1-Sek-Countdown-Tick.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package } from 'lucide-react';

export type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'abgeholt';

interface OrderData {
  id: string;
  status: OrderStatus;
  bestellt_am: string | null;
  geschaetzte_lieferzeit_min: number | null;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_lat: number | null;
  fahrer_lng: number | null;
}

interface Props {
  orderId: string;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
}

type Phase = { key: OrderStatus; label: string; icon: React.ReactNode };

const PHASES: Phase[] = [
  { key: 'bestätigt',      label: 'Bestätigt',      icon: <Package className="w-4 h-4" /> },
  { key: 'in_zubereitung', label: 'In Küche',        icon: <ChefHat className="w-4 h-4" /> },
  { key: 'unterwegs',      label: 'Unterwegs',       icon: <Bike className="w-4 h-4" /> },
  { key: 'geliefert',      label: 'Geliefert',       icon: <CheckCircle2 className="w-4 h-4" /> },
];

function phaseIndex(status: OrderStatus): number {
  const map: Record<string, number> = {
    neu: 0, bestätigt: 1, in_zubereitung: 2, fertig: 2, unterwegs: 3, geliefert: 4, abgeholt: 4,
  };
  return map[status] ?? 0;
}

function EtaCountdown({ etaMin, tick }: { etaMin: number | null; tick: number }) {
  if (etaMin === null) return <span className="text-muted-foreground">—</span>;
  if (etaMin <= 0) return <span className="text-matcha-600 font-black">Gleich da!</span>;
  const m = Math.floor(etaMin);
  return (
    <span className="font-black tabular-nums text-2xl text-foreground">
      {m} <span className="text-base font-semibold text-muted-foreground">Min</span>
    </span>
  );
}

export function StorefrontPhase2605EtaLiveTrackingFinal({ orderId, initialStatus, initialEtaMin }: Props) {
  const supabase = createClient();
  const [order, setOrder] = useState<Partial<OrderData>>({
    id: orderId,
    status: initialStatus ?? 'bestätigt',
    eta_min: initialEtaMin ?? null,
  });
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('customer_orders')
      .select('id, status, bestellt_am, geschaetzte_lieferzeit_min, eta_min')
      .eq('id', orderId)
      .maybeSingle();
    if (data) setOrder(prev => ({ ...prev, ...data }));
  }, [orderId]); // eslint-disable-line

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30_000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`order-tracking-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]); // eslint-disable-line

  const status = (order.status ?? 'bestätigt') as OrderStatus;
  const currentPhaseIdx = phaseIndex(status);
  const isDelivered = ['geliefert', 'abgeholt'].includes(status);
  const etaMin = order.eta_min ?? order.geschaetzte_lieferzeit_min ?? null;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card shadow-sm overflow-hidden">
      {/* ETA hero */}
      {!isDelivered && (
        <div className="px-5 py-4 bg-gradient-to-r from-matcha-50 to-emerald-50 dark:from-matcha-950/30 dark:to-emerald-950/20 border-b border-matcha-100 dark:border-matcha-900">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Geschätzte Ankunft</p>
          <div className="flex items-end gap-2">
            <EtaCountdown etaMin={etaMin} tick={tick} />
            <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Live
            </div>
          </div>
        </div>
      )}

      {isDelivered && (
        <div className="px-5 py-4 bg-matcha-50 dark:bg-matcha-950/20 border-b border-matcha-200 dark:border-matcha-800">
          <div className="flex items-center gap-2 text-matcha-700 dark:text-matcha-300">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">Bestellung geliefert!</span>
          </div>
        </div>
      )}

      {/* Phase progress */}
      <div className="px-5 py-4">
        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-100 dark:bg-stone-800 z-0" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-400 dark:bg-matcha-600 z-0 transition-all duration-700"
            style={{ width: `${Math.min(100, ((currentPhaseIdx - 1) / (PHASES.length - 1)) * 100)}%` }}
          />

          <div className="relative z-10 flex justify-between">
            {PHASES.map((phase, i) => {
              const phIdx = i + 1;
              const done = currentPhaseIdx > phIdx;
              const active = currentPhaseIdx === phIdx;
              return (
                <div key={phase.key} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / PHASES.length}%` }}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                    done
                      ? 'bg-matcha-500 border-matcha-500 text-white'
                      : active
                      ? 'bg-white dark:bg-stone-900 border-matcha-400 dark:border-matcha-600 text-matcha-600 dark:text-matcha-400 shadow-sm'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-300 dark:text-stone-600',
                  )}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : phase.icon}
                  </div>
                  <span className={cn(
                    'text-[10px] text-center leading-tight',
                    done || active ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Driver info when on the way */}
      {status === 'unterwegs' && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900/40 border border-stone-100 dark:border-stone-800 text-sm">
            <Bike className="w-4 h-4 text-matcha-600 shrink-0" />
            <span className="text-foreground font-medium">Fahrer ist unterwegs</span>
            {etaMin && etaMin <= 5 && (
              <span className="ml-auto text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                Fast da!
              </span>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="w-3 h-3" />
        Live-Tracking · 30-Sek-Update
      </div>
    </div>
  );
}
