'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ?: string;
}

interface KitchenTiming {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type ColorZone = 'ok' | 'bald' | 'kritisch' | 'ueberfaellig';

function getColorZone(secLeft: number): ColorZone {
  if (secLeft < 0) return 'ueberfaellig';
  if (secLeft < 120) return 'kritisch';
  if (secLeft < 300) return 'bald';
  return 'ok';
}

function colorClasses(zone: ColorZone) {
  switch (zone) {
    case 'ok': return { bg: 'bg-matcha-50 border-matcha-200', ring: 'bg-matcha-500', text: 'text-matcha-700' };
    case 'bald': return { bg: 'bg-amber-50 border-amber-200', ring: 'bg-amber-500', text: 'text-amber-700' };
    case 'kritisch': return { bg: 'bg-orange-50 border-orange-200', ring: 'bg-orange-500', text: 'text-orange-700' };
    case 'ueberfaellig': return { bg: 'bg-red-50 border-red-200', ring: 'bg-red-500', text: 'text-red-700' };
  }
}

function formatCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sec < 0 ? '+' : '';
  return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase930SmartTimingPro({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const active = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  const items = active.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    let secLeft: number | null = null;

    if (timing?.ready_target) {
      secLeft = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
      const ordered = new Date(order.bestellt_am).getTime();
      const targetMs = ordered + order.geschaetzte_zubereitung_min * 60_000;
      secLeft = Math.floor((targetMs - now) / 1000);
    }

    const zone = secLeft !== null ? getColorZone(secLeft) : 'ok';
    const pct = timing?.cook_start_at && timing?.ready_target
      ? Math.min(100, Math.max(0, ((now - new Date(timing.cook_start_at).getTime()) /
          (new Date(timing.ready_target).getTime() - new Date(timing.cook_start_at).getTime())) * 100))
      : null;

    return { order, timing, secLeft, zone, pct };
  }).sort((a, b) => {
    const order: Record<ColorZone, number> = { ueberfaellig: 0, kritisch: 1, bald: 2, ok: 3 };
    return order[a.zone] - order[b.zone];
  });

  const counts = { ueberfaellig: 0, kritisch: 0, bald: 0, ok: 0 };
  for (const { zone } of items) counts[zone]++;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-saffron" />
          <span className="text-sm font-semibold text-stone-800">Smart-Timing Pro</span>
          <span className="text-xs text-stone-500">· Echtzeit-Farbkodierung</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {counts.ueberfaellig > 0 && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle className="w-3 h-3" /> {counts.ueberfaellig} überfällig
            </span>
          )}
          {counts.kritisch > 0 && (
            <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              <Flame className="w-3 h-3" /> {counts.kritisch} kritisch
            </span>
          )}
          {counts.ok > 0 && (
            <span className="flex items-center gap-1 bg-matcha-50 text-matcha-700 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="w-3 h-3" /> {counts.ok} OK
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map(({ order, secLeft, zone, pct }) => {
          const c = colorClasses(zone);
          return (
            <div
              key={order.id}
              className={cn('relative rounded-lg border p-3 flex flex-col gap-1.5', c.bg)}
            >
              {/* Color pulse dot */}
              <div className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', c.ring,
                zone === 'ueberfaellig' || zone === 'kritisch' ? 'animate-pulse' : ''
              )} />

              <div className="flex items-center gap-1.5">
                <Clock className={cn('w-3.5 h-3.5', c.text)} />
                <span className="text-xs font-semibold text-stone-700">#{order.bestellnummer}</span>
              </div>

              {/* Countdown */}
              <div className={cn('text-2xl font-bold tabular-nums', c.text)}>
                {secLeft !== null ? formatCountdown(secLeft) : '--:--'}
              </div>

              {/* Progress bar */}
              {pct !== null && (
                <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', c.ring)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              <div className="text-[10px] text-stone-500 truncate">
                {order.status === 'in_zubereitung' ? 'In Zubereitung' : 'Angenommen'}
                {order.typ === 'lieferung' ? ' · Lieferung' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
