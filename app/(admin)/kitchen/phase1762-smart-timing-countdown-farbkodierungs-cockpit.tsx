'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Zap } from 'lucide-react';

/**
 * Phase 1762 — Smart-Timing Countdown Farbkodierungs-Cockpit (Kitchen)
 *
 * Zeigt pro aktive Bestellung einen farbcodierten Countdown:
 * - Grün: >5 Min verbleibend  (auf Zeit)
 * - Amber: 2–5 Min           (dringend)
 * - Rot: <2 Min / überfällig (kritisch)
 *
 * Kein API-Call — props.orders werden live vom Kitchen-Client übergeben.
 */

interface KitchenOrder {
  id: string;
  display_id?: string;
  status?: string;
  scheduled_pickup?: string | null;
  created_at?: string;
  estimated_prep_minutes?: number | null;
  customer_name?: string;
  items?: { name: string }[];
}

interface Props {
  orders: KitchenOrder[];
  className?: string;
}

function getRemainingMinutes(order: KitchenOrder): number {
  const base = order.scheduled_pickup
    ? new Date(order.scheduled_pickup).getTime()
    : order.created_at
    ? new Date(order.created_at).getTime() + (order.estimated_prep_minutes ?? 20) * 60_000
    : null;
  if (!base) return 0;
  return Math.round((base - Date.now()) / 60_000);
}

function colorClass(mins: number) {
  if (mins > 5) return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300';
  if (mins >= 2) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
}

function countColor(mins: number) {
  if (mins > 5) return 'text-green-600 dark:text-green-400';
  if (mins >= 2) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const ACTIVE_STATUSES = new Set(['new', 'confirmed', 'preparing', 'in_preparation', 'cooking']);

export function KitchenPhase1762SmartTimingCountdownFarbkodierungsCockpit({ orders, className }: Props) {
  const aktiv = useMemo(
    () =>
      orders
        .filter((o) => !o.status || ACTIVE_STATUSES.has(o.status))
        .map((o) => ({ ...o, mins: getRemainingMinutes(o) }))
        .sort((a, b) => a.mins - b.mins)
        .slice(0, 12),
    [orders],
  );

  if (aktiv.length === 0) return null;

  const kritisch = aktiv.filter((o) => o.mins < 2).length;
  const dringend = aktiv.filter((o) => o.mins >= 2 && o.mins <= 5).length;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Smart-Timing Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          {kritisch > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px] font-bold px-2 py-0.5">
              <Zap className="h-3 w-3" />
              {kritisch} kritisch
            </span>
          )}
          {dringend > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5">
              {dringend} dringend
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {aktiv.map((o) => (
          <div
            key={o.id}
            className={cn('rounded-lg border p-2 flex flex-col items-center gap-0.5', colorClass(o.mins))}
          >
            <span className={cn('text-2xl font-black tabular-nums leading-none', countColor(o.mins))}>
              {o.mins > 0 ? `${o.mins}′` : o.mins === 0 ? '0′' : `+${Math.abs(o.mins)}′`}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide opacity-70 truncate w-full text-center">
              #{o.display_id ?? o.id.slice(-4)}
            </span>
            {o.items?.[0] && (
              <span className="text-[8px] opacity-60 truncate w-full text-center">
                {o.items[0].name}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3 justify-end">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />&gt;5 Min
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />2–5 Min
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />&lt;2 Min
        </span>
      </div>
    </div>
  );
}
