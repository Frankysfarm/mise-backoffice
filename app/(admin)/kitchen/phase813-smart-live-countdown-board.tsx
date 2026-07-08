'use client';

import { useEffect, useState } from 'react';
import { Clock, Timer } from 'lucide-react';

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

const ACTIVE_STATUSES = ['neu', 'bestätigt', 'in_zubereitung', 'fertig'];

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
};

const STATUS_BADGE: Record<string, string> = {
  neu: 'bg-blue-100 text-blue-700',
  bestätigt: 'bg-matcha-50 text-matcha-600',
  in_zubereitung: 'bg-amber-100 text-amber-700',
  fertig: 'bg-emerald-100 text-emerald-700',
};

function getSecondsRemaining(order: Order, timing: Timing | undefined): number {
  const now = Date.now();

  if (timing?.ready_target) {
    return Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  }

  if (order.bestellt_am && order.geschaetzte_zubereitung_min != null) {
    const target =
      new Date(order.bestellt_am).getTime() +
      order.geschaetzte_zubereitung_min * 60 * 1000;
    return Math.floor((target - now) / 1000);
  }

  return 0;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) {
    const abs = Math.abs(seconds);
    const mm = Math.floor(abs / 60);
    const ss = abs % 60;
    return `-${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function getRowColor(seconds: number): {
  row: string;
  bar: string;
  timer: string;
} {
  if (seconds >= 5 * 60) {
    return {
      row: 'bg-emerald-50 border-emerald-200',
      bar: 'bg-emerald-400',
      timer: 'text-emerald-700',
    };
  }
  if (seconds > 0) {
    return {
      row: 'bg-amber-50 border-amber-200',
      bar: 'bg-amber-400',
      timer: 'text-amber-700',
    };
  }
  return {
    row: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
    timer: 'text-red-700',
  };
}

export function KitchenPhase813SmartLiveCountdownBoard({ orders, timings }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));

  const timingMap = new Map<string, Timing>(timings.map((t) => [t.order_id, t]));

  // Sort: most overdue first, then by time remaining ascending
  const sorted = [...activeOrders].sort((a, b) => {
    const secA = getSecondsRemaining(a, timingMap.get(a.id));
    const secB = getSecondsRemaining(b, timingMap.get(b.id));
    return secA - secB;
  });

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-semibold">⏱ Live Countdown</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded-full bg-matcha-50 text-matcha-600 text-[10px] font-bold px-2 py-0.5 min-w-[1.4rem]">
            {activeOrders.length}
          </span>
          <Clock className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-muted-foreground">
          <Timer className="h-6 w-6 opacity-30" />
          <span className="text-xs">Keine aktiven Bestellungen</span>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((order) => {
            const timing = timingMap.get(order.id);
            const seconds = getSecondsRemaining(order, timing);
            const { row, bar, timer } = getRowColor(seconds);
            const badgeClass =
              STATUS_BADGE[order.status] ?? 'bg-muted text-muted-foreground';

            // Color bar width: clamp 0–100% based on how much time is left
            // Use up to 15 min as the "full" reference
            const totalSec =
              timing?.ready_target
                ? (() => {
                    const start = timing.cook_start_at
                      ? new Date(timing.cook_start_at).getTime()
                      : order.bestellt_am
                      ? new Date(order.bestellt_am).getTime()
                      : Date.now();
                    return (
                      (new Date(timing.ready_target).getTime() - start) / 1000
                    );
                  })()
                : (order.geschaetzte_zubereitung_min ?? 15) * 60;

            const barPct =
              totalSec > 0
                ? Math.min(100, Math.max(0, (seconds / totalSec) * 100))
                : 0;

            return (
              <div
                key={order.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${row}`}
              >
                {/* Bestellnummer */}
                <span className="text-xs font-black tabular-nums shrink-0 w-14 truncate">
                  #{order.bestellnummer}
                </span>

                {/* Status badge */}
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass}`}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>

                {/* Color progress bar */}
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${bar}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                {/* Countdown timer */}
                <span
                  className={`shrink-0 text-sm font-black tabular-nums font-mono ${timer}`}
                >
                  {formatCountdown(seconds)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 text-[9px] text-muted-foreground">
        1s-Update · Grün ≥ 5 Min · Amber 1–5 Min · Rot überfällig
      </p>
    </div>
  );
}
