'use client';

/**
 * Phase 1894 — Bestellungs-Überfälligkeits-Monitor (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen, die ihre Ziel-Prep-Zeit überschreiten.
 * Farbkodierung: grün <10 Min, gelb 10–24 Min, orange 25–39 Min, rot ≥40 Min.
 * Alert-Badge wenn irgendeine Bestellung ≥25 Min aktiv ist. 10-Sek-Ticker.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  prep_duration?: number | null;
  kunde_name?: string | null;
  items?: { name?: string }[];
}

interface Props {
  orders: Order[];
  className?: string;
}

const AKTIV_STATI = new Set(['neu', 'accepted', 'angenommen', 'in_zubereitung', 'zubereitung']);

function elapsedMin(order: Order, nowMs: number): number {
  if (!order.created_at) return 0;
  return Math.round((nowMs - new Date(order.created_at).getTime()) / 60_000);
}

function colorMeta(min: number) {
  if (min < 10)  return { bg: 'bg-emerald-50 dark:bg-emerald-950', ring: 'ring-emerald-300', label: 'text-emerald-700 dark:text-emerald-300', badge: 'OK' };
  if (min < 25)  return { bg: 'bg-yellow-50 dark:bg-yellow-950',   ring: 'ring-yellow-300',  label: 'text-yellow-700 dark:text-yellow-300',  badge: 'Warnung' };
  if (min < 40)  return { bg: 'bg-orange-50 dark:bg-orange-950',   ring: 'ring-orange-400',  label: 'text-orange-700 dark:text-orange-300',  badge: 'Überfällig' };
  return           { bg: 'bg-red-50 dark:bg-red-950',              ring: 'ring-red-400',     label: 'text-red-700 dark:text-red-300',        badge: 'Kritisch' };
}

export function KitchenPhase1894BestellungsUeberfalligkeitsMonitor({ orders, className }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen]   = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(() => {
    const aktiv = orders.filter((o) => o.status && AKTIV_STATI.has(o.status));
    return aktiv
      .map((o) => ({ ...o, elapsed: elapsedMin(o, nowMs) }))
      .sort((a, b) => b.elapsed - a.elapsed);
  }, [orders, nowMs]);

  const critical = active.filter((o) => o.elapsed >= 25);
  const hasCritical = critical.length > 0;

  return (
    <Card className={cn('p-3 space-y-2', className)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          {hasCritical
            ? <Flame className="h-4 w-4 text-red-500 animate-pulse" />
            : <Clock className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs font-bold text-foreground">Überfälligkeits-Monitor</span>
          {hasCritical && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              {critical.length} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-1.5">
          {active.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Bestellungen.</p>
          )}
          {active.map((o) => {
            const c = colorMeta(o.elapsed);
            return (
              <div
                key={o.id}
                className={cn('flex items-center gap-2 rounded-lg ring-1 p-2', c.bg, c.ring)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {o.kunde_name ?? o.id.slice(-6).toUpperCase()}
                    </span>
                    {o.elapsed >= 25 && (
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                  </div>
                  {o.items && o.items.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {o.items.map((i) => i.name).filter(Boolean).slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-sm font-black tabular-nums', c.label)}>
                    {o.elapsed}m
                  </div>
                  <div className={cn('text-[9px] font-semibold', c.label)}>{c.badge}</div>
                </div>
              </div>
            );
          })}
          {active.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              {active.length} aktiv · {critical.length} ≥25 Min
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
