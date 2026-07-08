'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, Flame, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  fertig_am?: string | null;
  kunde_name?: string | null;
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

type Urgency = 'overdue' | 'critical' | 'warning' | 'ok' | 'done';

interface OrderCountdown {
  order: Order;
  timing?: KitchenTiming;
  secsLeft: number | null;
  urgency: Urgency;
}

function computeUrgency(secsLeft: number | null, isDone: boolean): Urgency {
  if (isDone) return 'done';
  if (secsLeft === null) return 'ok';
  if (secsLeft < -60) return 'overdue';
  if (secsLeft < 60) return 'critical';
  if (secsLeft < 180) return 'warning';
  return 'ok';
}

const URGENCY_STYLE: Record<Urgency, { border: string; bg: string; text: string; badge: string; badgeBg: string }> = {
  overdue: { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', badge: 'Überfällig', badgeBg: 'bg-red-500 text-white animate-pulse' },
  critical: { border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', badge: 'Kritisch', badgeBg: 'bg-orange-400 text-white' },
  warning: { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'Bald', badgeBg: 'bg-amber-300 text-amber-900' },
  ok: { border: 'border-matcha-300', bg: 'bg-matcha-50', text: 'text-matcha-700', badge: '', badgeBg: 'bg-matcha-100 text-matcha-700' },
  done: { border: 'border-stone-200', bg: 'bg-stone-50', text: 'text-stone-400', badge: 'Fertig', badgeBg: 'bg-stone-200 text-stone-500' },
};

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function getReadyTarget(order: Order, timing?: KitchenTiming): Date | null {
  if (timing?.ready_target) return new Date(timing.ready_target);
  if (!order.bestellt_am || !order.geschaetzte_zubereitung_min) return null;
  return new Date(new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000);
}

export function KitchenPrepCountdownAmpel({ orders, timings }: Props) {
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timerRef.current);
  }, []);

  const activeOrders = orders.filter(
    (o) => ['neu', 'angenommen', 'zubereitung', 'bereit'].includes(o.status),
  );

  const rows: OrderCountdown[] = activeOrders.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id);
    const isDone = !!o.fertig_am || o.status === 'bereit';
    const readyTarget = getReadyTarget(o, timing);
    const secsLeft = readyTarget ? Math.round((readyTarget.getTime() - now) / 1000) : null;
    return {
      order: o,
      timing,
      secsLeft,
      urgency: computeUrgency(secsLeft, isDone),
    };
  });

  const sorted = [...rows].sort((a, b) => {
    const urgencyOrder: Urgency[] = ['overdue', 'critical', 'warning', 'ok', 'done'];
    const ai = urgencyOrder.indexOf(a.urgency);
    const bi = urgencyOrder.indexOf(b.urgency);
    if (ai !== bi) return ai - bi;
    if (a.secsLeft !== null && b.secsLeft !== null) return a.secsLeft - b.secsLeft;
    return 0;
  });

  const overdueCount = rows.filter((r) => r.urgency === 'overdue').length;
  const criticalCount = rows.filter((r) => r.urgency === 'critical').length;

  if (activeOrders.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider flex-1">
          Zubereitung Countdown
        </span>
        <div className="flex gap-1.5">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 animate-pulse">
              {overdueCount} überfällig
            </span>
          )}
          {criticalCount > 0 && (
            <span className="rounded-full bg-orange-400 text-white text-[10px] font-bold px-2 py-0.5">
              {criticalCount} kritisch
            </span>
          )}
          <span className="rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5">
            {activeOrders.length} aktiv
          </span>
        </div>
      </div>

      {/* Ampel summary bar */}
      <div className="grid grid-cols-4 border-b">
        {([
          { key: 'overdue', label: 'Überfällig', color: 'bg-red-500', textColor: 'text-red-700' },
          { key: 'critical', label: 'Kritisch', color: 'bg-orange-400', textColor: 'text-orange-700' },
          { key: 'warning', label: 'Bald', color: 'bg-amber-300', textColor: 'text-amber-700' },
          { key: 'ok', label: 'OK', color: 'bg-matcha-400', textColor: 'text-matcha-700' },
        ] as const).map(({ key, label, color, textColor }) => {
          const count = rows.filter((r) => r.urgency === key).length;
          return (
            <div key={key} className="flex flex-col items-center py-2 border-r last:border-r-0">
              <div className={cn('h-2 w-2 rounded-full mb-1', color)} />
              <span className={cn('text-lg font-black tabular-nums', textColor)}>{count}</span>
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Order rows */}
      <div className="divide-y max-h-[60vh] overflow-y-auto">
        {sorted.map(({ order, timing, secsLeft, urgency }) => {
          const style = URGENCY_STYLE[urgency];
          const readyTarget = getReadyTarget(order, timing);
          return (
            <div
              key={order.id}
              className={cn('flex items-center gap-3 px-4 py-2.5 border-l-4 transition-colors', style.border, style.bg)}
            >
              <div className="shrink-0">
                {urgency === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                ) : urgency === 'overdue' ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <Flame className={cn('h-4 w-4', style.text)} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-stone-700">#{order.bestellnummer}</span>
                  {order.kunde_name && (
                    <span className="text-[11px] text-stone-500 truncate">{order.kunde_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', style.badgeBg)}>
                    {style.badge || order.status}
                  </span>
                  {readyTarget && (
                    <span className="text-[10px] text-stone-400">
                      Ziel: {readyTarget.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown */}
              <div className={cn('shrink-0 tabular-nums font-black text-base', style.text)}>
                {urgency === 'done'
                  ? '✓'
                  : secsLeft !== null
                  ? fmtCountdown(secsLeft)
                  : <Clock className="h-4 w-4" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
