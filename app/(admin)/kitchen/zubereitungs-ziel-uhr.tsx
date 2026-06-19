'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
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

function getRingData(order: Order, timing: KitchenTiming | undefined, now: number) {
  const startMs = timing?.cook_start_at
    ? new Date(timing.cook_start_at).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime()
    : null;

  const endMs = timing?.ready_target
    ? new Date(timing.ready_target).getTime()
    : startMs && order.geschaetzte_zubereitung_min
    ? startMs + order.geschaetzte_zubereitung_min * 60_000
    : null;

  if (!startMs || !endMs) return { pct: 0, secLeft: null, overdue: false, imminent: false };

  const total = endMs - startMs;
  const elapsed = now - startMs;
  const pct = Math.min(110, Math.max(0, (elapsed / total) * 100));
  const secLeft = Math.floor((endMs - now) / 1000);
  const overdue = secLeft < 0;
  const imminent = !overdue && secLeft < 120;

  return { pct, secLeft, overdue, imminent };
}

function Ring({ pct, overdue, imminent }: { pct: number; overdue: boolean; imminent: boolean }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const fillPct = Math.min(100, pct);
  const dashOffset = circ * (1 - fillPct / 100);
  const color = overdue ? '#dc2626' : imminent ? '#f97316' : pct >= 75 ? '#d97706' : '#4a7c59';

  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="24" cy="24" r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        className={cn('transition-all duration-1000', overdue && 'animate-pulse')}
      />
    </svg>
  );
}

export function KitchenZubereitungsZielUhr({ orders, timings }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter((o) =>
    ['bestätigt', 'in_zubereitung'].includes(o.status),
  );
  if (active.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));
  const rows = active.map((o) => ({
    order: o,
    ...getRingData(o, timingMap.get(o.id), now),
  }));

  const overdueCount = rows.filter((r) => r.overdue).length;
  const imminentCount = rows.filter((r) => r.imminent).length;

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        overdueCount > 0 ? 'bg-red-50' : imminentCount > 0 ? 'bg-orange-50' : 'bg-white',
      )}>
        <Clock className={cn(
          'h-4 w-4 shrink-0',
          overdueCount > 0 ? 'text-red-500 animate-pulse' : 'text-matcha-600',
        )} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Zubereitungs-Zieluhren · {active.length} aktiv
        </span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />{overdueCount}×
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {rows.map(({ order, pct, secLeft, overdue, imminent }) => {
          const absMin = secLeft !== null ? Math.abs(Math.floor(secLeft / 60)) : null;
          const absSec = secLeft !== null ? Math.abs(secLeft) % 60 : null;
          const timeLabel =
            secLeft !== null
              ? `${overdue ? '+' : ''}${absMin}:${String(absSec).padStart(2, '0')}`
              : '—';

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-2.5 transition-all',
                overdue ? 'bg-red-50 border-red-200' :
                imminent ? 'bg-orange-50 border-orange-200' :
                'bg-card border-border',
              )}
            >
              <div className="relative shrink-0">
                <Ring pct={pct} overdue={overdue} imminent={imminent} />
                <span className={cn(
                  'absolute inset-0 flex items-center justify-center text-[9px] font-black font-mono tabular-nums rotate-90',
                  overdue ? 'text-red-600' : imminent ? 'text-orange-600' : 'text-foreground',
                )}>
                  {timeLabel}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-foreground leading-tight truncate">
                  #{order.bestellnummer.replace(/^[A-Z]+-/, '')}
                </div>
                <div className="text-[10px] text-muted-foreground truncate leading-tight">
                  {order.kunde_name}
                </div>
                <div className={cn(
                  'mt-0.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 inline-block',
                  overdue ? 'bg-red-100 text-red-700' :
                  imminent ? 'bg-orange-100 text-orange-700' :
                  pct >= 75 ? 'bg-amber-100 text-amber-700' :
                  'bg-matcha-100 text-matcha-700',
                )}>
                  {overdue ? 'Überfällig' : imminent ? 'Gleich fertig' : pct >= 75 ? 'Knapp' : 'Im Plan'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
