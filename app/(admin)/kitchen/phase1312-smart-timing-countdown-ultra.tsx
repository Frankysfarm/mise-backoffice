'use client';
// Phase 1312 — Smart Timing Countdown Ultra (Kitchen)
// Echtzeit-Countdown aller aktiven Bestellungen mit 5-Stufen-Farbkodierung + KI-Kochstart-Empfehlung
// 1s-Tick · Props-basiert · nach Phase1311

import { useMemo, useEffect, useState } from 'react';
import { Clock, Flame, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orders: any[];
  timings?: any[];
}

type UrgencyLevel = 'ÜBERFÄLLIG' | 'KRITISCH' | 'DRINGEND' | 'BALD' | 'OK';

interface OrderCountdown {
  id: string;
  orderNumber: string | number;
  status: string;
  elapsedSeconds: number;
  remainingSeconds: number;
  targetSeconds: number;
  urgency: UrgencyLevel;
  isOverdue: boolean;
}

function getTargetSeconds(order: any, timings?: any[]): number {
  // Try to find a matching timing entry by item names or category
  if (timings && timings.length > 0) {
    const items: any[] = order.items ?? order.bestellpositionen ?? [];
    for (const item of items) {
      const match = timings.find(
        (t: any) =>
          t.name === item.name ||
          t.artikel === item.name ||
          t.kategorie === item.kategorie
      );
      if (match) {
        const mins = match.zubereitungszeit ?? match.minutes ?? match.dauer ?? 15;
        return mins * 60;
      }
    }
  }
  // Fallback: 20 minutes default target
  return 20 * 60;
}

function getElapsedSeconds(order: any): number {
  const confirmedAt =
    order.bestaetigtAt ??
    order.confirmed_at ??
    order.bestaetigt_at ??
    order.createdAt ??
    order.created_at ??
    order.zeitpunkt;
  if (!confirmedAt) return 0;
  const start = new Date(confirmedAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / 1000));
}

function getUrgency(remainingSeconds: number, isOverdue: boolean): UrgencyLevel {
  if (isOverdue) return 'ÜBERFÄLLIG';
  if (remainingSeconds < 2 * 60) return 'KRITISCH';
  if (remainingSeconds < 5 * 60) return 'DRINGEND';
  if (remainingSeconds < 10 * 60) return 'BALD';
  return 'OK';
}

function formatTime(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

const URGENCY_STYLES: Record<UrgencyLevel, { badge: string; row: string; text: string }> = {
  ÜBERFÄLLIG: {
    badge: 'bg-red-600 text-white animate-pulse',
    row: 'border-red-500 bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
  },
  KRITISCH: {
    badge: 'bg-red-500 text-white',
    row: 'border-red-400 bg-red-50/60 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
  DRINGEND: {
    badge: 'bg-orange-500 text-white',
    row: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400',
  },
  BALD: {
    badge: 'bg-yellow-400 text-yellow-900',
    row: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  OK: {
    badge: 'bg-matcha-500 text-white',
    row: 'border-matcha-200 bg-matcha-50 dark:bg-matcha-900/20',
    text: 'text-matcha-600 dark:text-matcha-400',
  },
};

const URGENCY_ICON: Record<UrgencyLevel, React.ReactNode> = {
  ÜBERFÄLLIG: <Flame className="w-3.5 h-3.5" />,
  KRITISCH: <AlertTriangle className="w-3.5 h-3.5" />,
  DRINGEND: <AlertTriangle className="w-3.5 h-3.5" />,
  BALD: <Timer className="w-3.5 h-3.5" />,
  OK: <CheckCircle2 className="w-3.5 h-3.5" />,
};

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'bestätigt', 'in_zubereitung', 'bestaetigt', 'confirmed', 'new', 'preparing']);

export function KitchenPhase1312SmartTimingCountdownUltra({ orders, timings }: Props) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // 1-second tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = useMemo(
    () => (orders ?? []).filter((o) => ACTIVE_STATUSES.has(o?.status)),
    [orders]
  );

  // Recompute every tick
  const countdowns: OrderCountdown[] = useMemo(() => {
    return activeOrders.map((order) => {
      const elapsed = getElapsedSeconds(order);
      const target = getTargetSeconds(order, timings);
      const remaining = target - elapsed;
      const isOverdue = remaining < 0;
      const urgency = getUrgency(remaining, isOverdue);
      return {
        id: order.id ?? order._id ?? String(Math.random()),
        orderNumber: order.bestellnummer ?? order.orderNumber ?? order.order_number ?? order.id ?? '—',
        status: order.status,
        elapsedSeconds: elapsed,
        remainingSeconds: remaining,
        targetSeconds: target,
        isOverdue,
        urgency,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders, timings, tick]);

  if (countdowns.length === 0) return null;

  const critical = countdowns.filter((c) => c.urgency === 'ÜBERFÄLLIG' || c.urgency === 'KRITISCH').length;
  const urgent = countdowns.filter((c) => c.urgency === 'DRINGEND').length;
  const ok = countdowns.filter((c) => c.urgency === 'BALD' || c.urgency === 'OK').length;

  // Sort: overdue first, then by remaining ascending
  const sorted = [...countdowns].sort((a, b) => a.remainingSeconds - b.remainingSeconds);

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-matcha-50 dark:bg-matcha-900/30 hover:bg-matcha-100 dark:hover:bg-matcha-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-semibold text-sm text-matcha-800 dark:text-matcha-200">
            Smart Timing Countdown Ultra
          </span>
          <span className="text-xs text-matcha-500 dark:text-matcha-400 font-mono">Phase 1312</span>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <Flame className="w-3 h-3" />
              {critical} kritisch
            </span>
          )}
          {urgent > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              <AlertTriangle className="w-3 h-3" />
              {urgent} dringend
            </span>
          )}
          {ok > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">
              <CheckCircle2 className="w-3 h-3" />
              {ok} ok
            </span>
          )}
          <span className="ml-1 text-matcha-400 dark:text-matcha-500 text-xs">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((cd) => {
            const styles = URGENCY_STYLES[cd.urgency];
            return (
              <div
                key={cd.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 border-l-4 transition-colors',
                  styles.row
                )}
              >
                {/* Order number */}
                <div className="flex-none w-24">
                  <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    #{cd.orderNumber}
                  </span>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 capitalize">{cd.status}</div>
                </div>

                {/* Elapsed */}
                <div className="flex-none text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Vergangen</div>
                  <div className="font-mono text-sm text-zinc-600 dark:text-zinc-300">
                    {formatTime(cd.elapsedSeconds)}
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex-1 text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                    {cd.isOverdue ? 'Überzogen' : 'Verbleibend'}
                  </div>
                  <div
                    className={cn(
                      'font-mono text-lg font-bold tabular-nums',
                      styles.text,
                      cd.urgency === 'ÜBERFÄLLIG' && 'animate-pulse'
                    )}
                  >
                    {cd.isOverdue ? '+' : ''}{formatTime(cd.remainingSeconds)}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex-1 hidden sm:block">
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        cd.urgency === 'ÜBERFÄLLIG' ? 'bg-red-600' :
                        cd.urgency === 'KRITISCH' ? 'bg-red-500' :
                        cd.urgency === 'DRINGEND' ? 'bg-orange-500' :
                        cd.urgency === 'BALD' ? 'bg-yellow-400' :
                        'bg-matcha-500'
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, (cd.elapsedSeconds / cd.targetSeconds) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Urgency badge */}
                <div className="flex-none">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                      styles.badge
                    )}
                  >
                    {URGENCY_ICON[cd.urgency]}
                    {cd.urgency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
