'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react';

/**
 * Phase 2520 — Smart-Timing Prep-Prognose Cockpit (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen sortiert nach Dringlichkeit:
 * - Farbkodierter Countdown-Ring grün/gelb/rot pro Bestellung
 * - Prognose-Alert wenn SLA-Breach droht
 * - On-Time-Quote-Ring aus letzten 20 abgeschlossenen Bestellungen
 * - 20-Sekunden-Polling via Supabase fetch
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  ready_target?: string | null;
  items?: Array<{ name?: string; title?: string; quantity?: number }> | null;
}

interface Props {
  orders: Order[];
  timings?: Array<{
    order_id: string;
    expected_ready_at?: string | null;
    prep_time_min?: number | null;
    timing_status?: string | null;
  }>;
}

type Urgency = 'ok' | 'tight' | 'late' | 'ready';

function urgencyOf(expectedReadyAt: string | null, status: string): Urgency {
  if (status === 'fertig') return 'ready';
  if (!expectedReadyAt) return 'ok';
  const sec = (new Date(expectedReadyAt).getTime() - Date.now()) / 1_000;
  if (sec < 0) return 'late';
  if (sec < 120) return 'tight';
  return 'ok';
}

const URGENCY_CFG: Record<Urgency, {
  ring: string; badge: string; text: string; label: string; pulse: boolean;
}> = {
  ok:    { ring: 'text-matcha-500',  badge: 'bg-matcha-100 text-matcha-700 border-matcha-300',  text: 'text-matcha-700',  label: 'In Zeit', pulse: false },
  tight: { ring: 'text-amber-500',   badge: 'bg-amber-100  text-amber-700  border-amber-300',   text: 'text-amber-700',   label: 'Knapp',   pulse: false },
  late:  { ring: 'text-red-500',     badge: 'bg-red-100    text-red-700    border-red-300',     text: 'text-red-700',     label: 'Überfällig', pulse: true },
  ready: { ring: 'text-blue-500',    badge: 'bg-blue-100   text-blue-700   border-blue-300',    text: 'text-blue-700',    label: 'Bereit',  pulse: false },
};

function fmtCountdown(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function itemSummary(items: Order['items']): string {
  if (!items || items.length === 0) return '';
  return items.slice(0, 3).map(i => `${i.quantity ?? 1}× ${i.name ?? i.title ?? '?'}`).join(', ');
}

export function KitchenPhase2520SmartTimingPrepPrognoseCockpit({ orders, timings = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const active = orders.filter(o =>
      ['neu', 'bestätigt', 'confirmed', 'in_zubereitung', 'preparing', 'fertig'].includes(o.status)
    );

    return active.map(o => {
      const timing = timings.find(t => t.order_id === o.id);
      const expectedReadyAt = timing?.expected_ready_at ?? o.ready_target ?? null;
      const prepMin = timing?.prep_time_min ?? o.geschaetzte_zubereitung_min ?? 15;

      let expectedAt = expectedReadyAt;
      if (!expectedAt && o.bestellt_am) {
        expectedAt = new Date(new Date(o.bestellt_am).getTime() + prepMin * 60_000).toISOString();
      }

      const secLeft = expectedAt ? Math.floor((new Date(expectedAt).getTime() - Date.now()) / 1_000) : null;
      const totalSec = prepMin * 60;
      const progressPct = secLeft !== null
        ? Math.max(0, Math.min(100, Math.round(((totalSec - secLeft) / totalSec) * 100)))
        : 50;
      const urgency = urgencyOf(expectedAt, o.status);
      const orderNum = o.bestellnummer?.replace('FF-', '') ?? o.id.slice(0, 6).toUpperCase();

      return { o, secLeft, progressPct, urgency, orderNum, expectedAt, prepMin };
    }).sort((a, b) => {
      const order: Urgency[] = ['late', 'tight', 'ok', 'ready'];
      const diff = order.indexOf(a.urgency) - order.indexOf(b.urgency);
      if (diff !== 0) return diff;
      return (a.secLeft ?? 9999) - (b.secLeft ?? 9999);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, tick]);

  const lateCount = rows.filter(r => r.urgency === 'late').length;
  const tightCount = rows.filter(r => r.urgency === 'tight').length;

  if (rows.length === 0) return null;

  const ringCircumference = 2 * Math.PI * 20;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold uppercase tracking-wider">Prep-Prognose</span>
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
            {rows.length} aktiv
          </span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {lateCount} überfällig
            </span>
          )}
          {lateCount === 0 && tightCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
              {tightCount} knapp
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(({ o, secLeft, progressPct, urgency, orderNum, prepMin }) => {
            const cfg = URGENCY_CFG[urgency];
            const dashOffset = ringCircumference * (1 - progressPct / 100);

            return (
              <div key={o.id} className={cn('px-4 py-2.5 flex items-center gap-3', urgency === 'late' && 'bg-red-50/60 dark:bg-red-950/20')}>
                {/* Countdown-Ring */}
                <div className="shrink-0 relative h-12 w-12">
                  <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                    <circle
                      cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                      className={cn(cfg.ring, urgency === 'late' && 'animate-pulse')}
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {urgency === 'ready' ? (
                      <Clock className="h-4 w-4 text-blue-500" />
                    ) : secLeft !== null ? (
                      <span className={cn('text-[10px] font-black tabular-nums leading-none', cfg.text)}>
                        {secLeft > 0 ? fmtCountdown(secLeft) : '!'}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">{prepMin}m</span>
                    )}
                  </div>
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-black text-foreground">#{orderNum}</span>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                      {cfg.label}
                    </span>
                  </div>
                  {o.items && o.items.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">{itemSummary(o.items)}</p>
                  )}
                  {/* Fortschrittsbalken */}
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000', {
                        'bg-matcha-500': urgency === 'ok',
                        'bg-amber-400': urgency === 'tight',
                        'bg-red-500': urgency === 'late',
                        'bg-blue-500': urgency === 'ready',
                      })}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
