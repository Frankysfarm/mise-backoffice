'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';

/**
 * Phase 1862 — Smart-Countdown-Farbkodierungs-Cockpit (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen als kompaktes Kachel-Grid mit Live-Countdown.
 * Farbkodierung nach verbleibender Zubereitungszeit:
 *  >8 Min  → grün   (entspannt)
 *  4–8 Min → gelb   (aufmerksam)
 *  1–4 Min → orange (dringend)
 *  ≤0 Min  → rot + Pulsieren (überfällig)
 * 30-Sek-Refresh.
 */

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target?: string | null;
}

function getRemainSec(order: Order): number | null {
  const target = order.ready_target
    ? new Date(order.ready_target).getTime()
    : order.bestellt_am && order.geschaetzte_zubereitung_min != null
    ? new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000
    : null;
  if (!target) return null;
  return Math.floor((target - Date.now()) / 1000);
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) {
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Urgency = 'ok' | 'attention' | 'urgent' | 'overdue';

function urgency(sec: number | null): Urgency {
  if (sec === null) return 'ok';
  if (sec <= 0) return 'overdue';
  if (sec <= 4 * 60) return 'urgent';
  if (sec <= 8 * 60) return 'attention';
  return 'ok';
}

const URGENCY_STYLES: Record<Urgency, { bg: string; border: string; text: string; badge: string; pulse: boolean }> = {
  ok:        { bg: 'bg-matcha-50 dark:bg-matcha-950/30',    border: 'border-matcha-200 dark:border-matcha-800',  text: 'text-matcha-700 dark:text-matcha-300',  badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/50 dark:text-matcha-300',  pulse: false },
  attention: { bg: 'bg-amber-50 dark:bg-amber-950/30',      border: 'border-amber-200 dark:border-amber-700',    text: 'text-amber-700 dark:text-amber-300',    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',    pulse: false },
  urgent:    { bg: 'bg-orange-50 dark:bg-orange-950/30',    border: 'border-orange-300 dark:border-orange-700',  text: 'text-orange-700 dark:text-orange-300',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', pulse: false },
  overdue:   { bg: 'bg-red-50 dark:bg-red-950/30',          border: 'border-red-400 dark:border-red-700',        text: 'text-red-700 dark:text-red-300',        badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',            pulse: true  },
};

const STATUS_DE: Record<string, string> = {
  neu: 'Neu',
  in_zubereitung: 'Kocht',
  fertig: 'Fertig',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
};

const ACTIVE_STATUSES = new Set(['neu', 'in_zubereitung']);

interface Props {
  orders: Order[];
  className?: string;
}

export function KitchenPhase1862SmartCountdownFarbkodierungCockpit({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const active = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.has(o.status)),
    [orders],
  );

  const cards = useMemo(() => {
    // tick forces re-evaluation every 5 sec
    void tick;
    return active.map((o) => {
      const sec = getRemainSec(o);
      return { order: o, sec, urgency: urgency(sec) };
    }).sort((a, b) => {
      // Sort overdue first, then ascending remaining time
      const ua = a.urgency === 'overdue' ? -1 : (a.sec ?? 9999);
      const ub = b.urgency === 'overdue' ? -1 : (b.sec ?? 9999);
      return (ua as number) - (ub as number);
    });
  }, [active, tick]);

  const overdueCount  = cards.filter((c) => c.urgency === 'overdue').length;
  const urgentCount   = cards.filter((c) => c.urgency === 'urgent').length;
  const attentionCount = cards.filter((c) => c.urgency === 'attention').length;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Clock className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Smart Countdown · Farbkodierung</span>
        <div className="ml-2 flex items-center gap-1">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 text-[9px] font-black animate-pulse">
              {overdueCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 text-[9px] font-black">
              {urgentCount} dringend
            </span>
          )}
          {attentionCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 text-[9px] font-black">
              {attentionCount} aufmerksam
            </span>
          )}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono tabular-nums">{active.length} aktiv</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-3">
          {cards.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              Keine aktiven Bestellungen
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {cards.map(({ order, sec, urgency: urg }) => {
                const s = URGENCY_STYLES[urg];
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'flex flex-col items-center rounded-xl border px-2 py-2.5 gap-1 transition-colors',
                      s.bg, s.border,
                      s.pulse && 'animate-pulse',
                    )}
                  >
                    {/* Order number */}
                    <span className="font-mono text-[11px] font-black text-foreground">
                      #{order.bestellnummer.slice(-4)}
                    </span>

                    {/* Status badge */}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold', s.badge)}>
                      {STATUS_DE[order.status] ?? order.status}
                    </span>

                    {/* Countdown */}
                    {sec !== null ? (
                      <span className={cn('font-mono text-sm font-black tabular-nums leading-none', s.text)}>
                        {fmtCountdown(sec)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">–:–</span>
                    )}

                    {/* Urgency icon */}
                    {urg === 'overdue' && <Flame className="h-3 w-3 text-red-500" />}
                    {urg === 'urgent'  && <Zap className="h-3 w-3 text-orange-500" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {[
              { color: 'bg-matcha-400', label: '>8 Min' },
              { color: 'bg-amber-400',  label: '4–8 Min' },
              { color: 'bg-orange-400', label: '1–4 Min' },
              { color: 'bg-red-500',    label: 'Überfällig' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={cn('h-2.5 w-2.5 rounded-full', color)} />
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
            <span className="ml-auto text-[9px] text-muted-foreground">Refresh alle 5 Sek</span>
          </div>
        </div>
      )}
    </div>
  );
}
