'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

/**
 * Phase 982 — Smart-Timing-Countdown-Board (Kitchen)
 *
 * Farbcodierter Live-Countdown je Bestellung:
 * Rot <5 Min bis Deadline / Amber <15 Min / Grün ≥15 Min.
 * Sekunden-genaues Update über setInterval.
 */

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  items?: Array<{ name?: string; title?: string }> | null;
  artikel?: Array<{ name?: string; title?: string }> | null;
  positionen?: Array<{ name?: string; title?: string }> | null;
}

interface Props {
  orders: Order[];
}

const KOCHENSTATUSES = ['neu', 'bestätigt', 'eingegangen', 'accepted', 'confirmed',
                        'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation'];

function getDeadlineMs(order: Order): number {
  if (order.promised_at) return new Date(order.promised_at).getTime();
  const base = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  return base + 30 * 60_000;
}

function getItemLabel(order: Order): string {
  const arr = order.items ?? order.artikel ?? order.positionen ?? [];
  const names = arr.slice(0, 2).map((i: { name?: string; title?: string }) => i.name ?? i.title ?? '').filter(Boolean);
  return names.join(' · ') || '—';
}

function getBnr(order: Order): string {
  return order.bestellnummer ?? order.id.slice(-4).toUpperCase();
}

interface CountdownData {
  remainMs: number;
  color: 'red' | 'amber' | 'green';
  label: string;
}

function calcCountdown(deadlineMs: number, nowMs: number): CountdownData {
  const diff = deadlineMs - nowMs;
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60_000);
  const secs = Math.floor((absDiff % 60_000) / 1_000);
  const label = diff < 0
    ? `+${mins}:${String(secs).padStart(2, '0')} überfällig`
    : `${mins}:${String(secs).padStart(2, '0')}`;
  const color: 'red' | 'amber' | 'green' = diff < 0 || diff < 5 * 60_000
    ? 'red'
    : diff < 15 * 60_000
    ? 'amber'
    : 'green';
  return { remainMs: diff, color, label };
}

const COLOR_MAP = {
  red:   { dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',   badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  amber: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  green: { dot: 'bg-emerald-500',text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-border',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

export function KitchenPhase982SmartTimingCountdownBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const items = useMemo(() => {
    return orders
      .filter(o => KOCHENSTATUSES.includes(o.status))
      .map(o => ({
        order: o,
        bnr: getBnr(o),
        label: getItemLabel(o),
        deadlineMs: getDeadlineMs(o),
      }))
      .sort((a, b) => a.deadlineMs - b.deadlineMs)
      .slice(0, 12);
  }, [orders]);

  const countdowns = useMemo(() => {
    return items.map(item => ({ ...item, cd: calcCountdown(item.deadlineMs, now) }));
  }, [items, now]);

  const kritisch = countdowns.filter(c => c.cd.color === 'red').length;
  const dringend  = countdowns.filter(c => c.cd.color === 'amber').length;

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-kitchen-phase="982">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Clock className="h-4 w-4 text-rose-600 shrink-0" />
        <span className="font-bold text-sm flex-1">Smart-Timing-Countdown</span>
        <div className="flex items-center gap-1.5">
          {kritisch > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 text-[10px] font-black animate-pulse">
              {kritisch} Kritisch
            </span>
          )}
          {dringend > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[10px] font-black">
              {dringend} Dringend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-3 pb-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Kritisch &lt;5 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Dringend &lt;15 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> OK</span>
          </div>

          {countdowns.map(({ order, bnr, label, cd }) => {
            const cm = COLOR_MAP[cd.color];
            const isOverdue = cd.remainMs < 0;
            return (
              <div
                key={order.id}
                className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-3', cm.bg)}
              >
                {/* Pulsing dot */}
                <span className={cn(
                  'shrink-0 w-2.5 h-2.5 rounded-full',
                  cm.dot,
                  (cd.color === 'red') && 'animate-pulse',
                )} />

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black">#{bnr}</span>
                    {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                    {!isOverdue && cd.color === 'green' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                    {!isOverdue && cd.color === 'amber' && <Flame className="h-3 w-3 text-amber-500 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{label}</div>
                </div>

                {/* Countdown */}
                <div className={cn(
                  'text-base font-black tabular-nums shrink-0',
                  cm.text,
                  isOverdue && 'animate-pulse',
                )}>
                  {cd.label}
                </div>
              </div>
            );
          })}

          <div className="text-[10px] text-muted-foreground text-center pt-1">
            Live-Countdown · Sekunden-genau · {items.length} Bestellung{items.length !== 1 ? 'en' : ''} aktiv
          </div>
        </div>
      )}
    </div>
  );
}
