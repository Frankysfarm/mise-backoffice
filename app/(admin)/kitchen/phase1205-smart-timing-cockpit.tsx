'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, Zap, CheckCircle2 } from 'lucide-react';

// Phase 1205 — Smart-Timing-Countdown-Cockpit (Kitchen)
// Echtzeit-Countdown für alle aktiven Bestellungen mit 5-stufiger Farbkodierung
// Grün (<5 Min verbleibend) → Gelb (5-10) → Orange (10-20) → Rot (20-30) → Schwarz (>30 oder überfällig)

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

type ColorLevel = 'done' | 'green' | 'yellow' | 'orange' | 'red' | 'critical';

function getColorLevel(secLeft: number | null): ColorLevel {
  if (secLeft === null) return 'orange';
  if (secLeft <= 0) return 'done';
  if (secLeft <= 300) return 'green';   // ≤5 Min
  if (secLeft <= 600) return 'yellow';  // 5-10 Min
  if (secLeft <= 1200) return 'orange'; // 10-20 Min
  if (secLeft <= 1800) return 'red';    // 20-30 Min
  return 'critical';                     // >30 Min
}

const LEVEL_STYLE: Record<ColorLevel, { bg: string; border: string; text: string; badge: string; label: string }> = {
  done:     { bg: 'bg-matcha-50 dark:bg-matcha-950/30',    border: 'border-matcha-400',  text: 'text-matcha-700 dark:text-matcha-300',   badge: 'bg-matcha-500 text-white',           label: 'Fertig' },
  green:    { bg: 'bg-emerald-50 dark:bg-emerald-950/30',  border: 'border-emerald-300', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-500 text-white',          label: '≤5 Min' },
  yellow:   { bg: 'bg-yellow-50 dark:bg-yellow-950/30',    border: 'border-yellow-300',  text: 'text-yellow-700 dark:text-yellow-300',   badge: 'bg-yellow-400 text-yellow-900',      label: '5-10 Min' },
  orange:   { bg: 'bg-orange-50 dark:bg-orange-950/30',    border: 'border-orange-300',  text: 'text-orange-700 dark:text-orange-300',   badge: 'bg-orange-500 text-white',           label: '10-20 Min' },
  red:      { bg: 'bg-red-50 dark:bg-red-950/30',          border: 'border-red-300',     text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-500 text-white',              label: '20-30 Min' },
  critical: { bg: 'bg-stone-100 dark:bg-stone-900/50',     border: 'border-stone-400',   text: 'text-stone-700 dark:text-stone-300',     badge: 'bg-stone-700 text-white',            label: '>30 Min' },
};

function fmtCountdown(sec: number): string {
  if (sec <= 0) return '✓';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtReadyTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function KitchenPhase1205SmartTimingCockpit({ orders, timings }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const now = Date.now();

  const activeOrders = orders.filter(o =>
    ['angenommen', 'in_zubereitung', 'bereit'].includes(o.status)
  );

  if (activeOrders.length === 0) return null;

  const rows = activeOrders.map(order => {
    const timing = timingMap.get(order.id);
    let readyMs: number | null = null;

    if (timing?.ready_target) {
      readyMs = new Date(timing.ready_target).getTime();
    } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
      readyMs = new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000;
    }

    const secLeft = readyMs != null ? Math.floor((readyMs - now) / 1000) : null;
    const level = order.status === 'bereit' ? 'done' as ColorLevel : getColorLevel(secLeft);
    const isCooking = timing?.status === 'cooking' || order.status === 'in_zubereitung';
    const isReady = order.status === 'bereit' || level === 'done';

    return { order, timing, secLeft, readyMs, level, isCooking, isReady };
  }).sort((a, b) => {
    const order: ColorLevel[] = ['done', 'green', 'yellow', 'orange', 'red', 'critical'];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });

  const urgentCount = rows.filter(r => r.level === 'green' || r.level === 'done').length;
  const readyCount = rows.filter(r => r.isReady).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition border-b"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-xs font-bold uppercase tracking-wider">
            Smart-Timing · Countdown-Cockpit
          </span>
          {urgentCount > 0 && (
            <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
              {urgentCount} bereit/bald
            </span>
          )}
          {readyCount > 0 && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
              {readyCount} fertig
            </span>
          )}
          <span className="ml-auto mr-2 text-[10px] text-muted-foreground tabular-nums">
            {activeOrders.length} aktiv
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-3">
          {/* Farbkodierung-Legende */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3 px-1">
            {(Object.entries(LEVEL_STYLE) as [ColorLevel, typeof LEVEL_STYLE[ColorLevel]][]).map(([level, s]) => (
              <span key={level} className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                {s.label}
              </span>
            ))}
          </div>

          {/* Bestellungs-Grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ order, timing, secLeft, readyMs, level, isCooking, isReady }) => {
              const s = LEVEL_STYLE[level];
              const pct = timing?.prep_min && timing?.cook_start_at
                ? Math.min(100, Math.max(0, ((now - new Date(timing.cook_start_at).getTime()) / (timing.prep_min * 60_000)) * 100))
                : null;

              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-xl border p-3 flex flex-col gap-2 transition-all',
                    s.bg, s.border,
                    level === 'green' || level === 'done' ? 'ring-1 ring-emerald-300' : '',
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {isReady
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600" />
                        : isCooking
                          ? <Flame className={cn('h-3.5 w-3.5', level === 'critical' ? 'text-stone-500' : 'text-orange-500')} />
                          : <Zap className="h-3.5 w-3.5 text-blue-500" />
                      }
                      <span className="text-xs font-black">
                        #{order.bestellnummer.replace(/^FF-/, '')}
                      </span>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </span>
                  </div>

                  {/* Countdown */}
                  <div className={cn('text-center font-mono text-3xl font-black tabular-nums leading-none', s.text)}>
                    {isReady && secLeft !== null && secLeft <= 0
                      ? <span className="text-matcha-600">FERTIG</span>
                      : secLeft != null
                        ? fmtCountdown(secLeft)
                        : '—:—'
                    }
                  </div>

                  {/* Fertig um */}
                  {readyMs && (
                    <div className="text-center text-[10px] text-muted-foreground">
                      Fertig um {fmtReadyTime(new Date(readyMs).toISOString())} Uhr
                    </div>
                  )}

                  {/* Progress-Bar (nur wenn gekocht wird) */}
                  {pct !== null && (
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          level === 'done' || level === 'green' ? 'bg-matcha-500'
                          : level === 'yellow' ? 'bg-yellow-400'
                          : level === 'orange' ? 'bg-orange-500'
                          : level === 'red' ? 'bg-red-500'
                          : 'bg-stone-600',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Status */}
                  <div className="text-[10px] font-bold uppercase tracking-wider text-center text-muted-foreground">
                    {isReady ? 'Warte auf Abholung'
                      : isCooking ? 'In Zubereitung'
                      : 'Angenommen'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zusammenfassung */}
          <div className="mt-3 flex items-center gap-3 flex-wrap border-t pt-3">
            {(Object.entries(LEVEL_STYLE) as [ColorLevel, typeof LEVEL_STYLE[ColorLevel]][]).map(([level, s]) => {
              const count = rows.filter(r => r.level === level).length;
              if (count === 0) return null;
              return (
                <div key={level} className="flex items-center gap-1">
                  <span className={cn('h-2 w-2 rounded-full', s.badge.split(' ')[0])} />
                  <span className="text-[10px] text-muted-foreground font-bold">{count}× {s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
