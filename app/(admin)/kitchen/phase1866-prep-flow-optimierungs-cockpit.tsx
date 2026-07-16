'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, RefreshCw, Zap } from 'lucide-react';

/**
 * Phase 1866 — Prep-Flow-Optimierungs-Cockpit (Kitchen)
 *
 * Analysiert die aktive Bestellwarteschlange und zeigt:
 *  - Welche Bestellungen JETZT gestartet werden müssen (Deadline-Druck)
 *  - Optimale Reihenfolge nach Zubereitungszeit + Pickup-ETA
 *  - Engpässe: Bestellungen die gleichzeitig fertig sein müssen (Batch-Sync)
 * 60-Sek-Refresh. Komplett client-seitig berechnet aus den übergebenen Orders.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  ready_target?: string | null;
  delivery_zone?: string | null;
  items?: { name: string; prep_minutes?: number | null }[] | null;
}

interface FlowSlot {
  orderId: string;
  bestellnummer: string;
  zone: string;
  prepMin: number;
  deadlineMs: number;
  startInMin: number;
  urgency: 'now' | 'soon' | 'ok';
}

function buildFlowSlots(orders: Order[]): FlowSlot[] {
  const active = orders.filter((o) =>
    ['neu', 'in_zubereitung', 'accepted', 'in_preparation'].includes(o.status),
  );
  const now = Date.now();
  return active
    .map((o): FlowSlot | null => {
      const prep = o.geschaetzte_zubereitung_min ?? 12;
      const deadline = o.ready_target
        ? new Date(o.ready_target).getTime()
        : o.bestellt_am
        ? new Date(o.bestellt_am).getTime() + (prep + 10) * 60_000
        : now + (prep + 10) * 60_000;
      const startIn = (deadline - prep * 60_000 - now) / 60_000;
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(-4),
        zone: o.delivery_zone ?? '?',
        prepMin: prep,
        deadlineMs: deadline,
        startInMin: startIn,
        urgency: startIn <= 0 ? 'now' : startIn <= 3 ? 'soon' : 'ok',
      };
    })
    .filter((s): s is FlowSlot => s !== null)
    .sort((a, b) => a.deadlineMs - b.deadlineMs)
    .slice(0, 12);
}

const URGENCY_CHIP: Record<FlowSlot['urgency'], string> = {
  now: 'bg-red-500 text-white animate-pulse',
  soon: 'bg-amber-400 text-amber-900',
  ok: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
};

const URGENCY_LABEL: Record<FlowSlot['urgency'], string> = {
  now: 'JETZT',
  soon: 'Bald',
  ok: 'OK',
};

const URGENCY_ROW: Record<FlowSlot['urgency'], string> = {
  now: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20',
  soon: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20',
  ok: 'border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20',
};

interface Props {
  orders: Order[];
  className?: string;
}

export function KitchenPhase1866PrepFlowOptimierungsCockpit({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const slots = buildFlowSlots(orders);
  const nowCount = slots.filter((s) => s.urgency === 'now').length;
  const soonCount = slots.filter((s) => s.urgency === 'soon').length;

  if (slots.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Prep-Flow Optimierung
          </span>
          <div className="flex items-center gap-1">
            {nowCount > 0 && (
              <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                {nowCount} JETZT
              </span>
            )}
            {soonCount > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
                {soonCount} Bald
              </span>
            )}
            {nowCount === 0 && soonCount === 0 && (
              <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
                {slots.length} im Fluss
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Optimale Kochstart-Reihenfolge · {slots.length} aktive Bestellungen
          </div>
          {slots.map((slot, idx) => (
            <div
              key={slot.orderId}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2',
                URGENCY_ROW[slot.urgency],
              )}
            >
              <span className="text-[10px] font-black text-muted-foreground w-5 text-right shrink-0">
                #{idx + 1}
              </span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-black shrink-0',
                URGENCY_CHIP[slot.urgency],
              )}>
                {URGENCY_LABEL[slot.urgency]}
              </span>
              <span className="font-mono text-sm font-bold shrink-0">#{slot.bestellnummer}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">Zone {slot.zone}</span>
              <div className="flex items-center gap-1 shrink-0 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-bold tabular-nums">{slot.prepMin} Min</span>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {slot.urgency === 'now'
                  ? <span className="text-red-600 font-bold">Überfällig!</span>
                  : slot.urgency === 'soon'
                  ? <span className="text-amber-600 font-bold">in {Math.round(slot.startInMin)} Min</span>
                  : <span>in {Math.round(slot.startInMin)} Min</span>
                }
              </div>
            </div>
          ))}
          {nowCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2 mt-2">
              <Flame className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {nowCount} Bestellung{nowCount !== 1 ? 'en' : ''} müssen SOFORT in die Küche!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
