'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Play, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  abholzeit?: string | null;
  soll_lieferzeit?: string | null;
};

type KitchenTiming = {
  order_id: string;
  estimated_prep_minutes?: number | null;
  cook_start_at?: string | null;
  ready_at?: string | null;
};

type Props = {
  orders: Order[];
  timings: KitchenTiming[];
  onCookNow?: (orderId: string) => void;
};

type Urgency = 'critical' | 'urgent' | 'tight' | 'ok' | 'done';

const URGENCY_STYLE: Record<Urgency, { bg: string; border: string; badge: string; label: string; pulse: boolean }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/40',     border: 'border-red-300',   badge: 'bg-red-500 text-white',    label: 'JETZT KOCHEN',  pulse: true },
  urgent:   { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300', badge: 'bg-amber-500 text-white',  label: 'Dringend',      pulse: true },
  tight:    { bg: 'bg-yellow-50 dark:bg-yellow-950/30',border: 'border-yellow-300',badge: 'bg-yellow-500 text-white', label: 'Knapp',         pulse: false },
  ok:       { bg: 'bg-matcha-50 dark:bg-matcha-950/30',border: 'border-matcha-300',badge: 'bg-matcha-500 text-white', label: 'OK',            pulse: false },
  done:     { bg: 'bg-muted/20',                        border: 'border-border',    badge: 'bg-muted-foreground text-white', label: 'Fertig', pulse: false },
};

function fmtMin(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function computeUrgency(order: Order, timing: KitchenTiming | undefined, nowMs: number): { urgency: Urgency; remainSec: number | null } {
  if (['fertig', 'abgeholt', 'geliefert', 'storniert'].includes(order.status)) {
    return { urgency: 'done', remainSec: null };
  }

  const prepMin = timing?.estimated_prep_minutes ?? 15;
  const cookStart = timing?.cook_start_at ? new Date(timing.cook_start_at).getTime() : null;
  const ready = timing?.ready_at ? new Date(timing.ready_at).getTime() : null;

  let remainSec: number | null = null;
  let urgency: Urgency = 'ok';

  if (ready) {
    remainSec = Math.round((ready - nowMs) / 1000);
  } else if (cookStart) {
    const finishMs = cookStart + prepMin * 60_000;
    remainSec = Math.round((finishMs - nowMs) / 1000);
  } else {
    // no cook started yet – use order time + prep estimate
    const orderMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : nowMs;
    const targetMs = orderMs + prepMin * 60_000;
    remainSec = Math.round((targetMs - nowMs) / 1000);
  }

  if (remainSec !== null) {
    if (remainSec < 0) urgency = 'critical';
    else if (remainSec < 120) urgency = 'urgent';
    else if (remainSec < 300) urgency = 'tight';
    else urgency = 'ok';
  }

  return { urgency, remainSec };
}

export function KitchenPhase900SmartKochstartKommandozentrale({ orders, timings, onCookNow }: Props) {
  const [tick, setTick] = useState(0);
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();
  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const activeOrders = orders.filter(o =>
    ['bestätigt', 'in_zubereitung', 'neu'].includes(o.status),
  );

  if (activeOrders.length === 0) return null;

  const enriched = activeOrders.map(o => ({
    order: o,
    timing: timingMap.get(o.id),
    ...computeUrgency(o, timingMap.get(o.id), nowMs),
  })).sort((a, b) => {
    const order: Urgency[] = ['critical', 'urgent', 'tight', 'ok', 'done'];
    const diff = order.indexOf(a.urgency) - order.indexOf(b.urgency);
    if (diff !== 0) return diff;
    // within same urgency: ascending remainSec (most urgent first)
    return (a.remainSec ?? 999999) - (b.remainSec ?? 999999);
  });

  const criticalCount = enriched.filter(e => e.urgency === 'critical').length;
  const urgentCount   = enriched.filter(e => e.urgency === 'urgent').length;

  async function handleCookNow(orderId: string) {
    setStartingIds(prev => new Set(prev).add(orderId));
    try {
      onCookNow?.(orderId);
    } finally {
      setTimeout(() => setStartingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; }), 2000);
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-kitchen-phase="900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-matcha-50/60 to-transparent">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Kochstart-Kommandozentrale
        </span>
        <div className="flex gap-1.5 ml-auto">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
              {criticalCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white text-[9px] font-black px-2 py-0.5">
              {urgentCount} dringend
            </span>
          )}
        </div>
      </div>

      {/* Order Cards */}
      <div className="divide-y">
        {enriched.map(({ order, timing, urgency, remainSec }) => {
          const s = URGENCY_STYLE[urgency];
          const nr = order.bestellnummer ?? order.id.slice(-4);
          const isCooking = order.status === 'in_zubereitung';
          const isStarting = startingIds.has(order.id);
          const hasCookStart = !!timing?.cook_start_at;

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                s.bg, s.border,
                s.pulse && 'border-l-4',
              )}
            >
              {/* Urgency badge */}
              <div className={cn(
                'shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black min-w-[80px] text-center',
                s.badge,
                s.pulse && urgency === 'critical' && 'animate-pulse',
              )}>
                {s.label}
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black">#{nr}</span>
                  <span className={cn(
                    'text-[10px] rounded-full px-1.5 py-0.5 font-medium',
                    isCooking ? 'bg-matcha-100 text-matcha-800' : 'bg-muted text-muted-foreground',
                  )}>
                    {isCooking ? 'In Zubereitung' : 'Wartend'}
                  </span>
                </div>
                {timing?.estimated_prep_minutes && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Zubereitung: {timing.estimated_prep_minutes} Min
                  </div>
                )}
              </div>

              {/* Countdown */}
              <div className="shrink-0 text-right min-w-[52px]">
                {remainSec !== null ? (
                  <>
                    <div className={cn(
                      'font-mono text-base font-black tabular-nums leading-none',
                      remainSec < 0 ? 'text-red-600' : remainSec < 120 ? 'text-amber-600' : 'text-matcha-700',
                    )}>
                      {fmtMin(remainSec)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">
                      {remainSec < 0 ? 'überfällig' : 'verbleibend'}
                    </div>
                  </>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-matcha-500 ml-auto" />
                )}
              </div>

              {/* Cook start button */}
              {!hasCookStart && !isCooking && onCookNow && (
                <button
                  onClick={() => handleCookNow(order.id)}
                  disabled={isStarting}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                    'bg-matcha-600 hover:bg-matcha-700 text-white active:scale-95',
                    isStarting && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {isStarting ? (
                    <span className="animate-spin">◌</span>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      <span>Start</span>
                    </>
                  )}
                </button>
              )}
              {isCooking && (
                <div className="shrink-0 flex items-center gap-1 text-matcha-600">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold">Kocht</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span>{criticalCount + urgentCount} dringend</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-matcha-600" />
          <span>{enriched.filter(e => e.urgency === 'ok').length} pünktlich</span>
        </div>
        <div className="ml-auto text-[9px]">
          Live · {tick > 0 ? 'aktuell' : ''}
        </div>
      </div>
    </div>
  );
}
