'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface Props {
  orders: Array<{
    id: string;
    bestellnummer: string;
    status: string;
    bestellt_am: string | null;
    geschaetzte_zubereitung_min: number | null;
    items: Array<{ name: string; menge: number }>;
  }>;
}

type TimingColor = 'ok' | 'soon' | 'critical' | 'overdue';

function getColor(pct: number): TimingColor {
  if (pct < 0) return 'overdue';
  if (pct < 15) return 'critical';
  if (pct < 35) return 'soon';
  return 'ok';
}

const colorMap: Record<TimingColor, { bg: string; border: string; text: string; bar: string; label: string; dot: string }> = {
  ok:       { bg: 'bg-matcha-50 dark:bg-matcha-950',  border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300',  bar: 'bg-matcha-500',  label: 'OK',       dot: 'bg-matcha-500' },
  soon:     { bg: 'bg-amber-50 dark:bg-amber-950',    border: 'border-amber-200 dark:border-amber-800',    text: 'text-amber-700 dark:text-amber-300',    bar: 'bg-amber-400',   label: 'Bald',     dot: 'bg-amber-400 animate-pulse' },
  critical: { bg: 'bg-orange-50 dark:bg-orange-950',  border: 'border-orange-200 dark:border-orange-800',  text: 'text-orange-700 dark:text-orange-300',  bar: 'bg-orange-500',  label: 'Kritisch', dot: 'bg-orange-500 animate-pulse' },
  overdue:  { bg: 'bg-red-50 dark:bg-red-950',        border: 'border-red-200 dark:border-red-800',        text: 'text-red-700 dark:text-red-300',        bar: 'bg-red-500',     label: 'Überfällig', dot: 'bg-red-500 animate-pulse' },
};

function fmtCountdown(secLeft: number): string {
  if (secLeft <= 0) return `-${Math.abs(Math.round(secLeft / 60))}m`;
  const m = Math.floor(secLeft / 60);
  const s = Math.floor(secLeft % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase878SmartTimingLiveDashboard({ orders }: Props) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const activeOrders = orders.filter(o =>
    ['neu', 'angenommen', 'in_zubereitung', 'bereit'].includes(o.status) && o.bestellt_am
  );

  if (activeOrders.length === 0) return null;

  const now = Date.now();

  const rows = activeOrders
    .map(o => {
      const prepMin = o.geschaetzte_zubereitung_min ?? 15;
      const startedMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const deadlineMs = startedMs + prepMin * 60 * 1000;
      const remainSec = (deadlineMs - now) / 1000;
      const elapsedPct = Math.min(100, ((now - startedMs) / (prepMin * 60 * 1000)) * 100);
      const remainPct = 100 - elapsedPct;
      const color = getColor(remainPct);
      return { order: o, remainSec, remainPct, color, prepMin };
    })
    .sort((a, b) => a.remainSec - b.remainSec);

  const counts = rows.reduce<Record<TimingColor, number>>((acc, r) => {
    acc[r.color] = (acc[r.color] ?? 0) + 1;
    return acc;
  }, { ok: 0, soon: 0, critical: 0, overdue: 0 });

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-matcha-50 to-transparent dark:from-matcha-950">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Smart Timing Live</span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            {activeOrders.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(Object.entries(counts) as [TimingColor, number][]).filter(([, n]) => n > 0).map(([color, count]) => (
            <span key={color} className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              colorMap[color].bg, colorMap[color].text, colorMap[color].border, 'border'
            )}>
              {count} {colorMap[color].label}
            </span>
          ))}
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y max-h-80 overflow-y-auto">
        {rows.map(({ order, remainSec, remainPct, color, prepMin }) => {
          const c = colorMap[color];
          const isOverdue = color === 'overdue';
          return (
            <div key={order.id} className={cn('px-4 py-2.5 flex items-center gap-3', c.bg)}>
              {/* Color dot */}
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', c.dot)} />

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">#{order.bestellnummer}</span>
                  {order.items.slice(0, 2).map((item, i) => (
                    <span key={i} className="text-[10px] text-muted-foreground truncate">
                      {item.menge}× {item.name}
                    </span>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', c.bar)}
                    style={{ width: `${Math.max(0, Math.min(100, isOverdue ? 100 : 100 - remainPct))}%` }}
                  />
                </div>
              </div>

              {/* Countdown */}
              <div className={cn('shrink-0 text-right tabular-nums font-mono', c.text)}>
                <div className="text-sm font-black">{fmtCountdown(remainSec)}</div>
                <div className="text-[9px] text-muted-foreground">{prepMin} Min geplant</div>
              </div>

              {/* Status badge */}
              <span className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold border',
                c.bg, c.text, c.border
              )}>
                {c.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {counts.overdue > 0 && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs font-bold text-red-700 dark:text-red-300">
            {counts.overdue} Bestellung{counts.overdue !== 1 ? 'en' : ''} überfällig — sofort priorisieren!
          </span>
          <Zap className="h-3.5 w-3.5 text-red-500 ml-auto" />
        </div>
      )}
    </Card>
  );
}
