'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, Package, ShoppingBag, Flame, AlertCircle } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items?: { name: string; menge: number }[];
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

type Lane = 'neu' | 'kochend' | 'fertig' | 'unterwegs';

const LANE_CONFIG: Record<Lane, { label: string; statuses: string[]; icon: React.ElementType; color: string; bg: string; border: string }> = {
  neu:       { label: 'Neu',       statuses: ['neu', 'angenommen', 'bestätigt'],       icon: Clock,         color: 'text-blue-400',    bg: 'bg-blue-950/30',   border: 'border-blue-800/40' },
  kochend:   { label: 'Kochend',   statuses: ['in_zubereitung', 'preparing'],          icon: ChefHat,       color: 'text-amber-400',   bg: 'bg-amber-950/30',  border: 'border-amber-800/40' },
  fertig:    { label: 'Fertig',    statuses: ['fertig', 'ready'],                       icon: Package,       color: 'text-matcha-400',  bg: 'bg-matcha-950/30', border: 'border-matcha-700/40' },
  unterwegs: { label: 'Unterwegs', statuses: ['unterwegs', 'out_for_delivery', 'picked_up'], icon: Bike, color: 'text-purple-400',  bg: 'bg-purple-950/30', border: 'border-purple-800/40' },
};

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function fmtTime(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sec < 0 ? '+' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

function urgencyFor(order: Order, timing: KitchenTiming | undefined, now: number): 'kritisch' | 'dringend' | 'ok' {
  if (timing?.ready_target) {
    const sec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    if (sec < 0) return 'kritisch';
    if (sec < 180) return 'dringend';
    return 'ok';
  }
  if (order.bestellt_am) {
    const elapsedMin = (now - new Date(order.bestellt_am).getTime()) / 60_000;
    const target = order.geschaetzte_zubereitung_min ?? 20;
    const rem = target - elapsedMin;
    if (rem < 0) return 'kritisch';
    if (rem < 5) return 'dringend';
  }
  return 'ok';
}

function OrderCard({ order, timing, now }: { order: Order; timing?: KitchenTiming; now: number }) {
  const urgency = urgencyFor(order, timing, now);

  let remainSec: number | null = null;
  if (timing?.ready_target) {
    remainSec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  } else if (order.bestellt_am && order.geschaetzte_zubereitung_min != null) {
    const elapsed = (now - new Date(order.bestellt_am).getTime()) / 1000;
    remainSec = Math.floor(order.geschaetzte_zubereitung_min * 60 - elapsed);
  }

  const itemList = (order.items ?? []).slice(0, 2);

  return (
    <div className={cn(
      'rounded-lg border p-2.5 space-y-1.5 transition-all',
      urgency === 'kritisch' && 'border-red-600/60 bg-red-950/40 animate-pulse',
      urgency === 'dringend' && 'border-amber-600/50 bg-amber-950/30',
      urgency === 'ok'       && 'border-white/10 bg-white/5',
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-black tabular-nums text-white/90">
          #{order.bestellnummer.slice(-5)}
        </span>
        {urgency === 'kritisch' && <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />}
        {urgency === 'dringend' && <Flame className="h-3 w-3 text-amber-400 shrink-0" />}
        {remainSec !== null && (
          <span className={cn(
            'font-mono text-[10px] font-bold tabular-nums',
            urgency === 'kritisch' ? 'text-red-300' : urgency === 'dringend' ? 'text-amber-300' : 'text-white/50',
          )}>
            {fmtTime(remainSec)}
          </span>
        )}
      </div>
      <div className="text-[10px] text-white/60 truncate">{order.kunde_name}</div>
      {itemList.length > 0 && (
        <div className="text-[9px] text-white/40 truncate">
          {itemList.map(i => `${i.menge}× ${i.name}`).join(' · ')}
          {(order.items?.length ?? 0) > 2 && ` +${(order.items?.length ?? 0) - 2}`}
        </div>
      )}
    </div>
  );
}

export function KitchenPrepFlowKanban({ orders, timings }: Props) {
  useTick(1000);
  const now = Date.now();
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const lanes = Object.entries(LANE_CONFIG) as [Lane, typeof LANE_CONFIG[Lane]][];
  const activeOrders = orders.filter((o) => !['geliefert', 'abgeholt', 'storniert', 'abgeschlossen'].includes(o.status));

  if (activeOrders.length === 0) return null;

  const criticalCount = activeOrders.filter((o) =>
    urgencyFor(o, timingMap.get(o.id), now) === 'kritisch',
  ).length;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-400" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-white/90">Prep-Flow</span>
          <span className="text-[10px] font-bold text-white/40">{activeOrders.length} aktiv</span>
        </div>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-black text-red-300">
            <AlertCircle className="h-3 w-3" />
            {criticalCount} überfällig
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5">
        {lanes.map(([laneKey, conf]) => {
          const Icon = conf.icon;
          const laneOrders = activeOrders.filter((o) => conf.statuses.includes(o.status));
          return (
            <div key={laneKey} className={cn('p-3 space-y-2 min-h-[120px]', conf.bg)}>
              <div className={cn('flex items-center gap-1.5', conf.color)}>
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">{conf.label}</span>
                <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                  {laneOrders.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {laneOrders.map((o) => (
                  <OrderCard key={o.id} order={o} timing={timingMap.get(o.id)} now={now} />
                ))}
                {laneOrders.length === 0 && (
                  <div className="flex items-center justify-center h-12 text-[10px] text-white/20">Leer</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
