'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, Clock, Flame, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function urgencyScore(order: Order, timing: KitchenTiming | undefined, now: number): number {
  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
  const orderMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
  const readyAt = timing?.ready_target ? new Date(timing.ready_target).getTime() : orderMs + prepMin * 60_000;
  const secsLeft = (readyAt - now) / 1000;
  return secsLeft;
}

function urgencyColor(secsLeft: number) {
  if (secsLeft < 0) return 'bg-red-600 border-red-400 text-white';
  if (secsLeft < 180) return 'bg-red-500/20 border-red-400 text-red-300';
  if (secsLeft < 360) return 'bg-amber-500/20 border-amber-400 text-amber-200';
  return 'bg-matcha-800/60 border-matcha-600 text-matcha-100';
}

function urgencyDot(secsLeft: number) {
  if (secsLeft < 0) return 'bg-red-400 animate-ping';
  if (secsLeft < 180) return 'bg-red-400 animate-pulse';
  if (secsLeft < 360) return 'bg-amber-400';
  return 'bg-matcha-400';
}

function formatSecs(secs: number): string {
  const abs = Math.abs(Math.floor(secs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

export function KitchenPhase422PrioritaetsKommando({ orders, timings }: Props) {
  useTick();
  const now = Date.now();

  const active = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
  );

  if (active.length === 0) return null;

  const sorted = [...active]
    .map((o) => ({
      order: o,
      timing: timings.find((t) => t.order_id === o.id),
      secsLeft: urgencyScore(o, timings.find((t) => t.order_id === o.id), now),
    }))
    .sort((a, b) => a.secsLeft - b.secsLeft)
    .slice(0, 6);

  const overdueCount = sorted.filter((x) => x.secsLeft < 0).length;
  const criticalCount = sorted.filter((x) => x.secsLeft >= 0 && x.secsLeft < 180).length;
  const okCount = sorted.filter((x) => x.secsLeft >= 180).length;

  return (
    <div className="rounded-2xl border border-matcha-700/40 bg-matcha-900/80 backdrop-blur overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-matcha-700/30">
        <Zap size={14} className="text-accent shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-matcha-300">
          Phase 422 · Prioritäts-Kommando
        </span>
        <div className="ml-auto flex items-center gap-2 text-[11px] font-bold">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-500/20 border border-red-400/40 text-red-300 px-2 py-0.5 flex items-center gap-1">
              <AlertTriangle size={9} />
              {overdueCount} überfällig
            </span>
          )}
          {criticalCount > 0 && (
            <span className="rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2 py-0.5">
              {criticalCount} kritisch
            </span>
          )}
          <span className="rounded-full bg-matcha-700/60 border border-matcha-600/40 text-matcha-200 px-2 py-0.5">
            {okCount} OK
          </span>
        </div>
      </div>

      {/* Order Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
        {sorted.map(({ order, secsLeft, timing }) => {
          const isOverdue = secsLeft < 0;
          const icon = isOverdue ? AlertTriangle : secsLeft < 180 ? Flame : ChefHat;
          const Icon = icon;
          return (
            <div
              key={order.id}
              className={cn(
                'rounded-xl border p-3 flex flex-col gap-1.5 transition-all duration-300',
                urgencyColor(secsLeft),
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', urgencyDot(secsLeft))} />
                  <span className="text-[11px] font-black tabular-nums">
                    #{order.bestellnummer}
                  </span>
                </div>
                <Icon size={12} className="shrink-0 opacity-70" />
              </div>

              <div className="flex items-end justify-between gap-1">
                <div className="text-[10px] opacity-70 leading-tight line-clamp-1 flex-1">
                  {order.items.slice(0, 2).map((i) => i.name).join(', ')}
                </div>
              </div>

              <div className={cn(
                'font-black text-xl tabular-nums leading-none',
                isOverdue ? 'text-white' : '',
              )}>
                {isOverdue && <span className="text-xs font-bold mr-0.5">⚠</span>}
                {formatSecs(secsLeft)}
              </div>

              <div className="text-[9px] uppercase tracking-wide opacity-60 flex items-center gap-1">
                <Clock size={8} />
                {order.status === 'neu' ? 'Wartet auf Start' : order.status === 'bestätigt' ? 'Bereit' : 'In Zubereitung'}
              </div>
            </div>
          );
        })}
      </div>

      {active.length > 6 && (
        <div className="text-center text-[10px] text-matcha-400 pb-2 font-bold">
          +{active.length - 6} weitere Bestellungen
        </div>
      )}
    </div>
  );
}
