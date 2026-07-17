'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, CheckCircle2, ChefHat, ChevronDown, ChevronUp, Clock, Flame, Truck, X } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string;
  status?: string;
  typ?: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  fertig_am?: string | null;
  kunde_name?: string;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  status?: string;
}

interface Batch {
  id: string;
  driver_id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
  batches: Batch[];
}

type UrgencyLevel = 'green' | 'amber' | 'red' | 'done' | 'waiting';

const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; border: string; badge: string; text: string; ring: string }> = {
  green:   { bg: 'bg-matcha-50',  border: 'border-matcha-200',  badge: 'bg-matcha-500 text-white',  text: 'text-matcha-700',  ring: 'bg-matcha-500'  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-500 text-white',   text: 'text-amber-700',   ring: 'bg-amber-400'   },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-500 text-white',     text: 'text-red-700',     ring: 'bg-red-500'     },
  done:    { bg: 'bg-muted/30',   border: 'border-border',      badge: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', ring: 'bg-muted-foreground' },
  waiting: { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-500 text-white',    text: 'text-blue-700',    ring: 'bg-blue-400'    },
};

function getUrgency(remainSec: number | null, status: string | undefined): UrgencyLevel {
  if (status === 'fertig' || status === 'ready') return 'done';
  if (status === 'neu' || status === 'bestätigt') return 'waiting';
  if (remainSec === null) return 'green';
  if (remainSec < 0) return 'red';
  if (remainSec < 120) return 'red';
  if (remainSec < 300) return 'amber';
  return 'green';
}

function formatTime(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase2080SmartTimingPerOrderCockpit({ orders, timings, batches }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    const timingMap = new Map(timings.map(t => [t.order_id, t]));
    const activeStatuses = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);

    return orders
      .filter(o => activeStatuses.has(o.status ?? ''))
      .map(o => {
        const timing = timingMap.get(o.id);
        let remainSec: number | null = null;
        let progressPct = 0;
        let totalSec: number | null = null;

        if (timing?.ready_target && o.status === 'in_zubereitung') {
          const target = new Date(timing.ready_target).getTime();
          remainSec = Math.round((target - now) / 1000);
          if (timing.cook_start_at) {
            const start = new Date(timing.cook_start_at).getTime();
            totalSec = (target - start) / 1000;
            const elapsed = (now - start) / 1000;
            progressPct = Math.min(100, Math.max(0, (elapsed / totalSec) * 100));
          }
        } else if (o.status === 'in_zubereitung' && o.bestellt_am) {
          const prepMin = o.geschaetzte_zubereitung_min ?? 15;
          const start = new Date(o.bestellt_am).getTime();
          const target = start + prepMin * 60 * 1000;
          remainSec = Math.round((target - now) / 1000);
          totalSec = prepMin * 60;
          const elapsed = (now - start) / 1000;
          progressPct = Math.min(100, Math.max(0, (elapsed / totalSec) * 100));
        }

        const urgency = getUrgency(remainSec, o.status);

        return {
          order: o,
          timing,
          remainSec,
          progressPct,
          urgency,
          isDelivery: o.typ === 'lieferung',
        };
      })
      .sort((a, b) => {
        const urgencyOrder: UrgencyLevel[] = ['red', 'amber', 'green', 'waiting', 'done'];
        const da = urgencyOrder.indexOf(a.urgency);
        const db = urgencyOrder.indexOf(b.urgency);
        if (da !== db) return da - db;
        if (a.remainSec !== null && b.remainSec !== null) return a.remainSec - b.remainSec;
        return 0;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, batches, tick]);

  const activeCount = rows.filter(r => r.urgency !== 'done').length;
  const redCount = rows.filter(r => r.urgency === 'red').length;
  const amberCount = rows.filter(r => r.urgency === 'amber').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <AlarmClock className="h-4 w-4 text-matcha-600 shrink-0" />
          Smart-Timing Pro
          <span className="text-muted-foreground font-normal normal-case tracking-normal">
            {activeCount} aktiv
          </span>
          {redCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 border border-red-200 font-bold">
              <Flame className="w-3 h-3" />
              {redCount} kritisch
            </span>
          )}
          {amberCount > 0 && redCount === 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-bold">
              <Clock className="w-3 h-3" />
              {amberCount} knapp
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y max-h-[480px] overflow-y-auto">
          {rows.map(({ order, remainSec, progressPct, urgency, isDelivery }) => {
            const s = URGENCY_STYLE[urgency];
            const isPulsing = urgency === 'red';
            return (
              <div
                key={order.id}
                className={cn(
                  'px-4 py-3 flex items-center gap-3 transition-colors',
                  s.bg,
                  isPulsing && 'animate-pulse',
                )}
              >
                {/* Status icon */}
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.badge)}>
                  {urgency === 'done'    ? <CheckCircle2 className="h-4 w-4" />
                    : urgency === 'waiting' ? <Clock className="h-4 w-4" />
                    : urgency === 'red'    ? <Flame className="h-4 w-4" />
                    : <ChefHat className="h-4 w-4" />}
                </div>

                {/* Order info + progress */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black truncate">#{order.bestellnummer ?? order.id.slice(0, 6)}</span>
                    {order.kunde_name && (
                      <span className="text-[11px] text-muted-foreground truncate">{order.kunde_name}</span>
                    )}
                    {isDelivery && (
                      <Truck className="h-3 w-3 text-blue-500 shrink-0" />
                    )}
                  </div>

                  {/* Progress bar */}
                  {urgency !== 'done' && urgency !== 'waiting' && (
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000', s.ring)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground">
                    {urgency === 'done'    ? 'Fertig'
                      : urgency === 'waiting' ? 'Warte auf Kochstart'
                      : order.status === 'in_zubereitung' ? 'In Zubereitung'
                      : order.status}
                  </div>
                </div>

                {/* Countdown */}
                {remainSec !== null && urgency !== 'done' && urgency !== 'waiting' && (
                  <div className="shrink-0 text-right">
                    <div className={cn('font-mono text-lg font-black tabular-nums', s.text)}>
                      {formatTime(remainSec)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {remainSec < 0 ? 'überfällig' : 'verbleibend'}
                    </div>
                  </div>
                )}
                {urgency === 'done' && (
                  <CheckCircle2 className={cn('h-5 w-5 shrink-0', s.text)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      {open && (
        <div className="flex items-center gap-3 px-4 py-2 border-t text-[10px] text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-matcha-500" />OK (&gt;5 Min)</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />Knapp (2–5 Min)</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Kritisch (&lt;2 Min)</div>
          <div className="flex items-center gap-1 ml-auto">
            <AlarmClock className="w-3 h-3" />Echtzeit-Ticker
          </div>
        </div>
      )}
    </div>
  );
}
