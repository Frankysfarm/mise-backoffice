'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, CheckCircle2, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  fertig_am?: string | null;
}

interface KitchenTiming {
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

type PrepStatus = 'pünktlich' | 'knapp' | 'kritisch' | 'überfällig' | 'fertig';

function getPrepStatus(order: Order, timing: KitchenTiming | undefined, now: number): PrepStatus {
  if (order.status === 'fertig' || order.status === 'unterwegs') return 'fertig';
  if (!timing?.cook_start_at) {
    if (!order.bestellt_am) return 'pünktlich';
    const elapsedMin = (now - new Date(order.bestellt_am).getTime()) / 60_000;
    const targetMin = order.geschaetzte_zubereitung_min ?? 20;
    const pct = elapsedMin / targetMin;
    if (pct >= 1.1) return 'überfällig';
    if (pct >= 0.85) return 'kritisch';
    if (pct >= 0.65) return 'knapp';
    return 'pünktlich';
  }
  if (!timing.ready_target) return 'pünktlich';
  const remainSec = (new Date(timing.ready_target).getTime() - now) / 1000;
  if (remainSec < -120) return 'überfällig';
  if (remainSec < 60) return 'kritisch';
  if (remainSec < 180) return 'knapp';
  return 'pünktlich';
}

function getStatusStyle(s: PrepStatus): { tile: string; badge: string; label: string } {
  switch (s) {
    case 'fertig':
      return { tile: 'bg-matcha-100 border-matcha-300', badge: 'bg-matcha-500 text-white', label: 'Fertig' };
    case 'pünktlich':
      return { tile: 'bg-green-50 border-green-200', badge: 'bg-green-500 text-white', label: 'Im Plan' };
    case 'knapp':
      return { tile: 'bg-amber-50 border-amber-300', badge: 'bg-amber-400 text-white', label: 'Knapp' };
    case 'kritisch':
      return { tile: 'bg-orange-50 border-orange-300 animate-pulse', badge: 'bg-orange-500 text-white', label: 'Kritisch' };
    case 'überfällig':
      return { tile: 'bg-red-50 border-red-400 animate-pulse', badge: 'bg-red-600 text-white', label: 'Überfällig' };
  }
}

function CountdownLabel({ timing, order, now }: { timing: KitchenTiming | undefined; order: Order; now: number }) {
  if (order.status === 'fertig' || order.status === 'unterwegs') {
    return <span className="text-[10px] font-bold text-matcha-600">✓ Fertig</span>;
  }
  if (timing?.ready_target) {
    const remainSec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    const absMin = Math.abs(Math.floor(remainSec / 60));
    const absSec = Math.abs(remainSec % 60);
    const label = `${absMin}:${String(absSec).padStart(2, '0')}`;
    if (remainSec < 0) return <span className="text-[10px] font-black text-red-600 font-mono">+{label}</span>;
    return <span className="text-[10px] font-black text-foreground font-mono">{label}</span>;
  }
  if (order.bestellt_am) {
    const elapsedMin = Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000);
    return <span className="text-[10px] font-mono text-muted-foreground">{elapsedMin} Min</span>;
  }
  return null;
}

export function KitchenTimingFarbkodierung({ orders, timings }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(
    (o) => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status),
  );
  if (active.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const statusCounts = {
    pünktlich: 0, knapp: 0, kritisch: 0, überfällig: 0, fertig: 0,
  };
  for (const o of active) {
    const s = getPrepStatus(o, timingMap.get(o.id), now);
    statusCounts[s]++;
  }

  const kritischCount = statusCounts.kritisch + statusCounts.überfällig;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        kritischCount > 0 ? 'bg-red-50' : 'bg-white',
      )}>
        <Flame className={cn('h-4 w-4 shrink-0', kritischCount > 0 ? 'text-red-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Timing-Farbkodierung
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {statusCounts.überfällig > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-500 text-white px-2 py-0.5 font-bold">
              <AlertTriangle className="h-2.5 w-2.5" />{statusCounts.überfällig}×
            </span>
          )}
          {statusCounts.kritisch > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-orange-500 text-white px-2 py-0.5 font-bold">
              <Clock className="h-2.5 w-2.5" />{statusCounts.kritisch}×
            </span>
          )}
          {statusCounts.fertig > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-matcha-500 text-white px-2 py-0.5 font-bold">
              <CheckCircle2 className="h-2.5 w-2.5" />{statusCounts.fertig}×
            </span>
          )}
        </div>
      </div>

      {/* Tile Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {active.map((order) => {
          const timing = timingMap.get(order.id);
          const status = getPrepStatus(order, timing, now);
          const { tile, badge, label } = getStatusStyle(status);
          return (
            <div
              key={order.id}
              className={cn('rounded-xl border-2 p-2.5 flex flex-col gap-1 transition-all', tile)}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-foreground truncate">
                  #{order.bestellnummer}
                </span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0', badge)}>
                  {label}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{order.kunde_name}</div>
              <CountdownLabel timing={timing} order={order} now={now} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
