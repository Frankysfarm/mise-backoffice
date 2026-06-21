'use client';

import { useEffect, useState } from 'react';
import { ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type Urgency = 'kritisch' | 'dringend' | 'bald' | 'ok';

interface OrderWithUrgency {
  order: Order;
  timing: KitchenTiming | undefined;
  urgency: Urgency;
  label: string;
  secsToStart: number | null;
}

function getUrgency(secsToStart: number): Urgency {
  if (secsToStart < 0) return 'kritisch';
  if (secsToStart < 120) return 'dringend';
  if (secsToStart < 300) return 'bald';
  return 'ok';
}

function getLabel(urgency: Urgency, secsToStart: number): string {
  if (urgency === 'kritisch') return 'JETZT KOCHEN!';
  if (urgency === 'dringend') return `in ${Math.ceil(secsToStart / 60)}min`;
  if (urgency === 'bald') return `in ${Math.ceil(secsToStart / 60)}min`;
  return `in ${Math.floor(secsToStart / 60)}min`;
}

const URGENCY_CONFIG: Record<Urgency, { color: string; dot: string; bg: string; text: string }> = {
  kritisch: { color: 'bg-red-500', dot: 'bg-red-500', bg: 'bg-red-950/40', text: 'text-red-400' },
  dringend: { color: 'bg-orange-500', dot: 'bg-orange-500', bg: 'bg-orange-950/30', text: 'text-orange-400' },
  bald:     { color: 'bg-yellow-500', dot: 'bg-yellow-500', bg: 'bg-yellow-950/20', text: 'text-yellow-400' },
  ok:       { color: 'bg-green-500', dot: 'bg-green-500', bg: 'bg-green-950/20', text: 'text-green-400' },
};

const URGENCY_ORDER: Urgency[] = ['kritisch', 'dringend', 'bald', 'ok'];

export function KitchenKommandoZentrale({ orders, timings }: Props) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(o => o.status !== 'geliefert' && o.status !== 'storniert');

  const enriched: OrderWithUrgency[] = active.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    if (timing?.cook_start_at) {
      const secsToStart = (new Date(timing.cook_start_at).getTime() - Date.now()) / 1000;
      const urgency = getUrgency(secsToStart);
      const label = getLabel(urgency, secsToStart);
      return { order, timing, urgency, label, secsToStart };
    }
    return {
      order,
      timing,
      urgency: 'ok' as Urgency,
      label: order.geschaetzte_zubereitung_min ? `~${order.geschaetzte_zubereitung_min}min` : '—',
      secsToStart: null,
    };
  });

  const sorted = [...enriched].sort((a, b) => {
    const ai = URGENCY_ORDER.indexOf(a.urgency);
    const bi = URGENCY_ORDER.indexOf(b.urgency);
    if (ai !== bi) return ai - bi;
    const as = a.secsToStart ?? 9999;
    const bs = b.secsToStart ?? 9999;
    return as - bs;
  });

  const counts = {
    kritisch: enriched.filter(e => e.urgency === 'kritisch').length,
    dringend: enriched.filter(e => e.urgency === 'dringend').length,
    bald: enriched.filter(e => e.urgency === 'bald').length,
    ok: enriched.filter(e => e.urgency === 'ok').length,
  };

  return (
    <div className="rounded-xl bg-matcha-900 border border-matcha-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-[#4AE68A]" />
          <span className="font-bold text-matcha-50 text-sm">Kochkommando</span>
        </div>
        {counts.kritisch > 0 && (
          <span className="rounded-full bg-red-500 text-white text-xs font-black px-2 py-0.5 animate-pulse">
            {counts.kritisch} KRITISCH
          </span>
        )}
      </div>

      {/* Urgency bar */}
      {active.length > 0 && (
        <div className="flex h-2">
          {((['kritisch', 'dringend', 'bald', 'ok'] as Urgency[])).map(u => {
            const pct = active.length > 0 ? (counts[u] / active.length) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={u}
                className={cn('h-full transition-all', URGENCY_CONFIG[u].color)}
                style={{ width: `${pct}%` }}
                title={`${u}: ${counts[u]}`}
              />
            );
          })}
        </div>
      )}

      {/* Orders list */}
      <div className="max-h-72 overflow-y-auto divide-y divide-matcha-800">
        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-matcha-400 text-sm">
            Keine aktiven Bestellungen
          </div>
        ) : (
          sorted.map(({ order, timing, urgency, label }) => {
            const cfg = URGENCY_CONFIG[urgency];
            return (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  cfg.bg,
                  urgency === 'kritisch' && 'animate-pulse',
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />
                <span className="text-xs font-mono text-matcha-300 shrink-0 w-16">
                  #{order.bestellnummer}
                </span>
                <span className="text-xs text-matcha-200 truncate flex-1">
                  {order.kunde_name}
                </span>
                <span className={cn('text-xs font-bold shrink-0', cfg.text)}>
                  {label}
                </span>
                {(timing?.prep_min != null) && (
                  <span className="text-[10px] bg-matcha-800 text-matcha-300 rounded px-1.5 py-0.5 shrink-0">
                    {timing.prep_min}min
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
