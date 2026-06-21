'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
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
  ready_target: string | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

const ACTIVE = ['neu', 'bestätigt', 'in_zubereitung'];

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtMin(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m <= 0) return 'jetzt';
  return `in ${m} Min`;
}

export function KitchenFertigstellungsPrognose({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const active = orders.filter(o => ACTIVE.includes(o.status));
  if (active.length === 0) return null;

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const completions: { order: Order; readyAt: number }[] = active.map(order => {
    const t = timingMap.get(order.id);
    if (t?.ready_target) {
      return { order, readyAt: new Date(t.ready_target).getTime() };
    }
    const prepMin = order.geschaetzte_zubereitung_min ?? 15;
    const base = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
    return { order, readyAt: base + prepMin * 60_000 };
  }).sort((a, b) => a.readyAt - b.readyAt);

  const latestMs = Math.max(...completions.map(c => c.readyAt));
  const latestDiff = latestMs - now;

  const color =
    latestDiff <= 15 * 60_000 ? 'text-matcha-700 bg-matcha-50 border-matcha-200' :
    latestDiff <= 30 * 60_000 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200';

  const barColor =
    latestDiff <= 15 * 60_000 ? 'bg-matcha-500' :
    latestDiff <= 30 * 60_000 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className={cn('rounded-2xl border overflow-hidden', color)}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-current/10">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fertigstellungs-Prognose</span>
        <span className="ml-auto font-mono text-xs font-black tabular-nums">
          Alle fertig {fmtMin(latestDiff)} · {fmtTime(new Date(latestMs))}
        </span>
      </div>

      <div className="divide-y divide-current/10">
        {completions.slice(0, 5).map(({ order, readyAt }) => {
          const diff = readyAt - now;
          const isOverdue = diff < 0;
          return (
            <div key={order.id} className="flex items-center gap-3 px-4 py-2">
              <Clock className={cn('h-3 w-3 shrink-0', isOverdue && 'text-red-500')} />
              <span className="flex-1 text-xs font-semibold truncate">{order.kunde_name}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                #{order.bestellnummer}
              </span>
              <div className={cn('flex h-5 items-center rounded-full px-2 text-[10px] font-bold tabular-nums', barColor, 'text-white')}>
                {isOverdue ? `+${Math.round(-diff / 60_000)} Min` : fmtTime(new Date(readyAt))}
              </div>
            </div>
          );
        })}
        {completions.length > 5 && (
          <div className="px-4 py-1.5 text-[10px] text-muted-foreground">
            +{completions.length - 5} weitere Bestellungen
          </div>
        )}
      </div>
    </div>
  );
}
