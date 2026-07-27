'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, CheckCircle2, ChefHat, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
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

type UrgencyLevel = 'ok' | 'knapp' | 'kritisch' | 'ueberfaellig' | 'fertig';

interface OrderSlot {
  id: string;
  nr: string;
  urgency: UrgencyLevel;
  remainSec: number | null;
  elapsedMin: number;
  cookStarted: boolean;
}

function getUrgency(order: Order, timing: KitchenTiming | undefined, now: number): { urgency: UrgencyLevel; remainSec: number | null; elapsedMin: number } {
  const elapsedMin = order.bestellt_am ? (now - new Date(order.bestellt_am).getTime()) / 60_000 : 0;

  if (['fertig', 'unterwegs', 'geliefert'].includes(order.status)) {
    return { urgency: 'fertig', remainSec: null, elapsedMin };
  }

  if (timing?.ready_target) {
    const remainSec = (new Date(timing.ready_target).getTime() - now) / 1000;
    const urgency: UrgencyLevel =
      remainSec < -120 ? 'ueberfaellig' :
      remainSec < 60   ? 'kritisch' :
      remainSec < 180  ? 'knapp' : 'ok';
    return { urgency, remainSec, elapsedMin };
  }

  const targetMin = order.geschaetzte_zubereitung_min ?? 20;
  const pct = elapsedMin / targetMin;
  const urgency: UrgencyLevel =
    pct >= 1.1  ? 'ueberfaellig' :
    pct >= 0.85 ? 'kritisch' :
    pct >= 0.65 ? 'knapp' : 'ok';
  return { urgency, remainSec: null, elapsedMin };
}

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; text: string; border: string; dot: string }> = {
  ok:           { bg: 'bg-emerald-50 dark:bg-emerald-950/30',  text: 'text-emerald-700 dark:text-emerald-400',  border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  knapp:        { bg: 'bg-amber-50 dark:bg-amber-950/30',     text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-800',     dot: 'bg-amber-500' },
  kritisch:     { bg: 'bg-orange-50 dark:bg-orange-950/30',   text: 'text-orange-700 dark:text-orange-400',   border: 'border-orange-200 dark:border-orange-800',   dot: 'bg-orange-500' },
  ueberfaellig: { bg: 'bg-red-50 dark:bg-red-950/30',         text: 'text-red-700 dark:text-red-400',         border: 'border-red-200 dark:border-red-800',         dot: 'bg-red-500' },
  fertig:       { bg: 'bg-slate-50 dark:bg-slate-900/30',     text: 'text-slate-500 dark:text-slate-400',     border: 'border-slate-200 dark:border-slate-700',     dot: 'bg-slate-400' },
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  ok: 'OK', knapp: 'Knapp', kritisch: 'Kritisch', ueberfaellig: 'Überfällig', fertig: 'Fertig',
};

export function SchichtTimingKommando({ orders, timings }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const ivRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const activeOrders = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  const slots: OrderSlot[] = activeOrders.map(o => {
    const timing = timingMap.get(o.id);
    const { urgency, remainSec, elapsedMin } = getUrgency(o, timing, now);
    return {
      id: o.id,
      nr: o.bestellnummer ?? o.id.slice(-4),
      urgency,
      remainSec,
      elapsedMin,
      cookStarted: !!timing?.cook_start_at,
    };
  }).sort((a, b) => {
    const order: UrgencyLevel[] = ['ueberfaellig', 'kritisch', 'knapp', 'ok', 'fertig'];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  const counts = {
    ueberfaellig: slots.filter(s => s.urgency === 'ueberfaellig').length,
    kritisch:     slots.filter(s => s.urgency === 'kritisch').length,
    knapp:        slots.filter(s => s.urgency === 'knapp').length,
    ok:           slots.filter(s => s.urgency === 'ok').length,
    fertig:       slots.filter(s => s.urgency === 'fertig').length,
  };

  const criticalAlert = counts.ueberfaellig > 0 || counts.kritisch > 0;

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3 text-muted-foreground text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        Keine aktiven Bestellungen — Küche frei.
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', criticalAlert && 'border-red-300 dark:border-red-800')}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-2.5', criticalAlert ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/40')}>
        <div className="flex items-center gap-2">
          <ChefHat className={cn('h-4 w-4', criticalAlert ? 'text-red-600' : 'text-matcha-600')} />
          <span className="text-xs font-bold uppercase tracking-wider">Schicht-Timing</span>
          {criticalAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {counts.ueberfaellig + counts.kritisch} dringend
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          {counts.ueberfaellig > 0 && <span className="text-red-600 font-bold">{counts.ueberfaellig} überfällig</span>}
          {counts.kritisch > 0     && <span className="text-orange-600 font-bold">{counts.kritisch} kritisch</span>}
          {counts.knapp > 0        && <span className="text-amber-600 font-bold">{counts.knapp} knapp</span>}
          {counts.ok > 0           && <span className="text-emerald-600">{counts.ok} OK</span>}
          {counts.fertig > 0       && <span className="text-slate-500">{counts.fertig} fertig</span>}
        </div>
      </div>

      {/* Slot grid */}
      <div className="flex flex-wrap gap-2 p-3">
        {slots.map(slot => {
          const s = URGENCY_STYLE[slot.urgency];
          return (
            <div
              key={slot.id}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 min-w-[64px]',
                s.bg, s.text, s.border,
                slot.urgency === 'ueberfaellig' && 'animate-pulse',
              )}
            >
              <div className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />
                {slot.cookStarted && <Flame className="h-2.5 w-2.5" />}
                {!slot.cookStarted && slot.urgency !== 'fertig' && <Clock className="h-2.5 w-2.5 opacity-60" />}
                {slot.urgency === 'fertig' && <CheckCircle2 className="h-2.5 w-2.5" />}
              </div>
              <span className="font-mono text-[11px] font-black leading-none tabular-nums">
                #{String(slot.nr).slice(-4)}
              </span>
              {slot.remainSec !== null ? (
                <span className={cn('font-mono text-[10px] font-bold tabular-nums', slot.remainSec < 0 && 'opacity-80')}>
                  {fmt(slot.remainSec)}
                </span>
              ) : (
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {Math.round(slot.elapsedMin)}m
                </span>
              )}
              <span className="text-[8px] opacity-75 leading-none font-medium">
                {URGENCY_LABEL[slot.urgency]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{activeOrders.length} Bestellung{activeOrders.length !== 1 ? 'en' : ''} aktiv</span>
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-500" />
          <span>Live · {new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
