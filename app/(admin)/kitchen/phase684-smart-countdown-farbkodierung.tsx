'use client';

/**
 * Phase 684 — Smart-Countdown mit Farbkodierung
 * Echtzeit-Countdown für aktive Bestellungen — Grün (>10 Min), Amber (5–10 Min),
 * Rot (<5 Min), Puls-Rot (überfällig). Gibt Küche ein sofortiges Bild der Lage.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

type Timing = {
  order_id: string;
  ready_target?: string | null;
  status?: string;
};
type Order = {
  id: string;
  bestellnummer?: number | string;
  kunde_name?: string;
  status?: string;
  created_at?: string;
};

function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type ColorLevel = 'ok' | 'warn' | 'critical' | 'overdue';

function getLevel(secLeft: number): ColorLevel {
  if (secLeft < 0) return 'overdue';
  if (secLeft < 5 * 60) return 'critical';
  if (secLeft < 10 * 60) return 'warn';
  return 'ok';
}

const LEVEL_STYLE: Record<ColorLevel, { bg: string; border: string; text: string; badge: string; label: string }> = {
  ok:       { bg: 'bg-matcha-50 dark:bg-matcha-950/20',  border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300',   badge: 'bg-matcha-500 text-white',  label: 'Auf Zeit'   },
  warn:     { bg: 'bg-amber-50 dark:bg-amber-950/20',    border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-400 text-white',   label: 'Knapp'      },
  critical: { bg: 'bg-red-50 dark:bg-red-950/20',        border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-500 text-white',     label: 'Kritisch'   },
  overdue:  { bg: 'bg-red-100 dark:bg-red-950/40',       border: 'border-red-300 dark:border-red-700',       text: 'text-red-800 dark:text-red-200',         badge: 'bg-red-600 text-white',     label: 'Überfällig' },
};

function formatCountdown(secLeft: number) {
  if (secLeft < 0) {
    const abs = Math.abs(secLeft);
    return `-${Math.floor(abs / 60)}:${String(Math.floor(abs % 60)).padStart(2, '0')}`;
  }
  return `${Math.floor(secLeft / 60)}:${String(Math.floor(secLeft % 60)).padStart(2, '0')}`;
}

export function KitchenPhase684SmartCountdownFarbkodierung({
  orders,
  timings,
}: {
  orders: Order[];
  timings: Timing[];
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(5000);

  const rows = useMemo(() => {
    const activeOrders = orders.filter(
      (o) => o.status && !['delivered', 'storniert', 'cancelled'].includes(o.status),
    );
    return activeOrders
      .map((order) => {
        const timing = timings.find((t) => t.order_id === order.id);
        const readyTarget = timing?.ready_target ? new Date(timing.ready_target).getTime() : null;
        const secLeft = readyTarget !== null ? Math.floor((readyTarget - now) / 1000) : null;
        const level: ColorLevel = secLeft !== null ? getLevel(secLeft) : 'ok';
        return { order, secLeft, level, readyTarget };
      })
      .sort((a, b) => {
        const order: ColorLevel[] = ['overdue', 'critical', 'warn', 'ok'];
        const diff = order.indexOf(a.level) - order.indexOf(b.level);
        if (diff !== 0) return diff;
        if (a.secLeft === null) return 1;
        if (b.secLeft === null) return -1;
        return a.secLeft - b.secLeft;
      })
      .slice(0, 16);
  }, [orders, timings, now]);

  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, critical: 0, overdue: 0 };
    for (const r of rows) c[r.level]++;
    return c;
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm">Smart-Countdown</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.overdue > 0 && (
              <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 font-bold">
                {counts.overdue} überfällig
              </span>
            )}
            {counts.critical > 0 && (
              <span className="rounded-full bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5">
                {counts.critical} kritisch
              </span>
            )}
            {counts.warn > 0 && (
              <span className="rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 px-2 py-0.5">
                {counts.warn} knapp
              </span>
            )}
            {counts.ok > 0 && (
              <span className="rounded-full bg-matcha-50 text-matcha-700 dark:bg-matcha-950/20 dark:text-matcha-300 px-2 py-0.5">
                {counts.ok} on-time
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {rows.map(({ order, secLeft, level }) => {
            const s = LEVEL_STYLE[level];
            const isOverdue = level === 'overdue';
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-lg border p-3 flex flex-col gap-1.5',
                  s.bg, s.border,
                  isOverdue && 'animate-pulse',
                )}
              >
                {/* Badge + Bestellnummer */}
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full', s.badge)}>
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    #{order.bestellnummer ?? '—'}
                  </span>
                </div>

                {/* Countdown */}
                <div className={cn('text-2xl font-black tabular-nums text-center leading-none', s.text)}>
                  {secLeft !== null ? formatCountdown(secLeft) : '—'}
                </div>
                <div className="text-[9px] text-center text-muted-foreground">Min:Sek verbleibend</div>

                {/* Kundenname */}
                {order.kunde_name && (
                  <div className="text-[11px] font-medium truncate text-center" title={order.kunde_name}>
                    {order.kunde_name}
                  </div>
                )}

                {/* Fortschrittsbalken */}
                {secLeft !== null && (
                  <div className="h-1 rounded-full bg-black/10 overflow-hidden mt-0.5">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000',
                        level === 'ok' ? 'bg-matcha-500' : level === 'warn' ? 'bg-amber-400' : 'bg-red-500',
                      )}
                      style={{
                        width: secLeft >= 0
                          ? `${Math.min(100, Math.max(0, (secLeft / (20 * 60)) * 100))}%`
                          : '100%',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
