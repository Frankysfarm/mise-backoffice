'use client';

import { useMemo } from 'react';
import { Flame, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface Timing {
  order_id: string;
  started_cooking_at?: string | null;
  prep_target_min?: number | null;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

function calcScore(order: Order, timing: Timing | undefined): number {
  const now = Date.now();
  const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
  const alterMin = (now - bestelltMs) / 60_000;
  const targetMin = timing?.prep_target_min ?? order.geschaetzte_zubereitung_min ?? 20;
  const urgencyScore = Math.min(100, Math.round((alterMin / targetMin) * 80));
  const typBonus = order.typ === 'lieferung' ? 10 : 5;
  const statusBonus = order.status === 'bestätigt' ? 10 : order.status === 'neu' ? 15 : 0;
  return Math.min(100, urgencyScore + typBonus + statusBonus);
}

function scoreColor(score: number) {
  if (score >= 80) return { bg: 'bg-red-50', border: 'border-red-300', bar: 'bg-red-500', text: 'text-red-700', icon: 'text-red-500' };
  if (score >= 50) return { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', text: 'text-amber-700', icon: 'text-amber-500' };
  return { bg: 'bg-matcha-50', border: 'border-matcha-200', bar: 'bg-matcha-500', text: 'text-matcha-700', icon: 'text-matcha-500' };
}

export function KitchenPhase820PrepPrioritaetsScore({ orders, timings }: Props) {
  const activeOrders = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status));

  const ranked = useMemo(() => {
    return activeOrders
      .map(o => {
        const timing = timings.find(t => t.order_id === o.id);
        return { order: o, score: calcScore(o, timing) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [activeOrders, timings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ranked.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-red-50">
        <Flame className="h-4 w-4 text-red-600" />
        <span className="text-sm font-bold text-red-800">Prioritäts-Score</span>
        <span className="ml-auto text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">
          {activeOrders.length} aktiv
        </span>
      </div>
      <div className="divide-y divide-stone-50">
        {ranked.map(({ order, score }) => {
          const c = scoreColor(score);
          const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : Date.now();
          const alterMin = Math.floor((Date.now() - bestelltMs) / 60_000);
          const ScoreIcon = score >= 80 ? AlertTriangle : score >= 50 ? Flame : Clock;
          return (
            <div key={order.id} className={cn('flex items-center gap-3 px-4 py-2.5', c.bg)}>
              <ScoreIcon className={cn('h-4 w-4 shrink-0', c.icon)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">#{order.bestellnummer}</span>
                  <span className={cn('text-[9px] rounded-full border px-1.5 font-bold', c.border, c.text)}>
                    {order.typ === 'lieferung' ? 'Liefer' : 'Abh'}
                  </span>
                  <span className="text-[9px] text-stone-400 ml-auto">{alterMin} Min</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', c.bar)}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              <div className={cn('text-sm font-black tabular-nums shrink-0 w-8 text-right', c.text)}>
                {score}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 bg-stone-50 text-[10px] text-stone-400 flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Kritisch ≥80</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />Dringend ≥50</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-matcha-500 inline-block" />Normal</span>
      </div>
    </div>
  );
}
