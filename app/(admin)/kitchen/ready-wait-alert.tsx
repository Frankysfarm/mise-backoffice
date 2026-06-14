'use client';

/**
 * KitchenReadyWaitAlert — Wärme-Risiko-Band für fertige Bestellungen
 *
 * Zeigt Bestellungen die auf Abholung warten, mit Farbkodierung:
 *  - Grün  (< 5 Min)  → frisch fertig
 *  - Amber (5–12 Min) → Wärme-Risiko
 *  - Rot   (> 12 Min) → Qualitätsproblem, sofort handeln
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame, Thermometer } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  fertig_am: string | null;
  typ: string;
};

function useReadyOrders() {
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('customer_orders')
        .select('id, bestellnummer, kunde_name, fertig_am, typ')
        .eq('status', 'fertig')
        .not('fertig_am', 'is', null)
        .order('fertig_am', { ascending: true })
        .limit(20);
      if (!cancelled && data) setOrders(data as ReadyOrder[]);
    };

    load();
    const iv = setInterval(load, 20_000);

    const ch = supabase
      .channel('ready-wait-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return orders;
}

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);
  return t;
}

type HeatLevel = 'fresh' | 'warm' | 'risk';

function heatLevel(fertigAt: string | null): { level: HeatLevel; waitMin: number } {
  if (!fertigAt) return { level: 'fresh', waitMin: 0 };
  const waitMin = Math.floor((Date.now() - new Date(fertigAt).getTime()) / 60_000);
  if (waitMin > 12) return { level: 'risk', waitMin };
  if (waitMin > 5)  return { level: 'warm', waitMin };
  return { level: 'fresh', waitMin };
}

const HEAT_STYLES: Record<HeatLevel, { bg: string; text: string; border: string; dot: string }> = {
  fresh: { bg: 'bg-matcha-800/50', text: 'text-matcha-200', border: 'border-matcha-600/40', dot: 'bg-matcha-400' },
  warm:  { bg: 'bg-amber-900/40',  text: 'text-amber-200',  border: 'border-amber-500/50',  dot: 'bg-amber-400'  },
  risk:  { bg: 'bg-red-900/50',    text: 'text-red-200',    border: 'border-red-500/60',    dot: 'bg-red-400'    },
};

export function KitchenReadyWaitAlert() {
  useTick();
  const orders = useReadyOrders();

  if (orders.length === 0) return null;

  const riskOrders  = orders.filter((o) => heatLevel(o.fertig_am).level === 'risk');
  const warmOrders  = orders.filter((o) => heatLevel(o.fertig_am).level === 'warm');
  const freshOrders = orders.filter((o) => heatLevel(o.fertig_am).level === 'fresh');

  const hasCritical = riskOrders.length > 0;

  return (
    <div className={cn(
      'rounded-2xl border p-3 space-y-2 transition-all',
      hasCritical
        ? 'border-red-500/50 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
        : 'border-amber-500/30 bg-amber-950/30',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Thermometer className={cn('h-4 w-4 shrink-0', hasCritical ? 'text-red-400 animate-pulse' : 'text-amber-400')} />
        <span className={cn('text-xs font-black uppercase tracking-wider', hasCritical ? 'text-red-300' : 'text-amber-300')}>
          Wartet auf Abholung · {orders.length}
        </span>
        {hasCritical && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-black text-red-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {riskOrders.length} kalt!
          </span>
        )}
      </div>

      {/* Zeilen */}
      <div className="space-y-1">
        {orders.map((order) => {
          const { level, waitMin } = heatLevel(order.fertig_am);
          const style = HEAT_STYLES[level];
          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all',
                style.bg, style.border,
                level === 'risk' && 'animate-pulse',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0 flex-none', style.dot)} />
              <span className={cn('flex-1 text-xs font-bold truncate', style.text)}>
                #{order.bestellnummer} · {order.kunde_name}
              </span>
              <span className={cn(
                'flex items-center gap-1 text-[10px] font-black tabular-nums shrink-0',
                level === 'risk' ? 'text-red-300' : level === 'warm' ? 'text-amber-300' : 'text-matcha-300',
              )}>
                {level === 'risk' ? <Flame className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                {waitMin} Min
              </span>
              {level === 'fresh' && (
                <CheckCircle2 className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 pt-0.5">
        {[
          { dot: 'bg-matcha-400', label: '< 5 Min', sublabel: 'Frisch' },
          { dot: 'bg-amber-400',  label: '5–12 Min', sublabel: 'Warm halten' },
          { dot: 'bg-red-400',    label: '> 12 Min', sublabel: 'Kalt-Risiko!' },
        ].map(({ dot, label, sublabel }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
            <span className="text-[9px] text-matcha-400 leading-none">
              {sublabel} <span className="text-matcha-600">({label})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
