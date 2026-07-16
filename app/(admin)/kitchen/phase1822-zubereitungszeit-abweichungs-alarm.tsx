'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';

/**
 * Phase 1822 — Zubereitungszeit-Abweichungs-Alarm (Kitchen)
 *
 * Alert wenn tatsächliche Zubereitungszeit >150% des Schätzwerts.
 * Props orders+timings; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  title?: string;
}

interface Order {
  id: string;
  status?: string;
  estimated_time?: number;
  estimatedTime?: number;
  accepted_at?: string;
  acceptedAt?: string;
  created_at?: string;
  items?: OrderItem[];
  produkte?: OrderItem[];
  [key: string]: unknown;
}

interface Timing {
  order_id?: string;
  orderId?: string;
  estimated_minutes?: number;
  start_time?: string;
  startTime?: string;
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
  schwelle?: number;
  className?: string;
}

interface AbweichungsBestellung {
  id: string;
  gericht: string;
  geschaetzt_min: number;
  aktuell_min: number;
  abweichung_pct: number;
}

const AKTIVE_STATUS = new Set(['preparing', 'in_progress', 'in_zubereitung', 'confirmed', 'accepted']);

function gerichtName(order: Order): string {
  const items = order.items ?? order.produkte ?? [];
  if (items.length === 0) return `Bestellung #${order.id.slice(-4)}`;
  return items[0]?.name ?? items[0]?.title ?? `Bestellung #${order.id.slice(-4)}`;
}

function startZeit(order: Order, timing?: Timing): Date | null {
  const raw =
    timing?.start_time ?? timing?.startTime ??
    order.accepted_at ?? (order as Record<string, unknown>).acceptedAt ?? order.created_at;
  if (!raw || typeof raw !== 'string') return null;
  return new Date(raw);
}

function geschaetztMin(order: Order, timing?: Timing): number {
  return (
    timing?.estimated_minutes ??
    order.estimated_time ??
    order.estimatedTime ??
    20
  ) as number;
}

export function KitchenPhase1822ZubereitungszeitAbweichungsAlarm({
  orders,
  timings = [],
  schwelle = 1.5,
  className,
}: Props) {
  const [offen, setOffen] = useState(true);

  const abweichungen = useMemo<AbweichungsBestellung[]>(() => {
    const jetzt = Date.now();
    return orders
      .filter((o) => AKTIVE_STATUS.has(o.status ?? ''))
      .flatMap((o) => {
        const timing = timings.find((t) => (t.order_id ?? t.orderId) === o.id);
        const start = startZeit(o, timing);
        if (!start) return [];
        const aktuellMin = Math.round((jetzt - start.getTime()) / 60_000);
        const geschaetzt = geschaetztMin(o, timing);
        if (aktuellMin <= 0 || geschaetzt <= 0) return [];
        const pct = aktuellMin / geschaetzt;
        if (pct < schwelle) return [];
        return [{
          id: o.id,
          gericht: gerichtName(o),
          geschaetzt_min: geschaetzt,
          aktuell_min: aktuellMin,
          abweichung_pct: Math.round((pct - 1) * 100),
        }];
      })
      .sort((a, b) => b.abweichung_pct - a.abweichung_pct);
  }, [orders, timings, schwelle]);

  const hatAlarm = abweichungen.length > 0;

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Zubereitungszeit-Abweichung
          </span>
          {hatAlarm && (
            <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold px-1.5 py-0.5">
              {abweichungen.length} Alarm{abweichungen.length > 1 ? 'e' : ''}
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-2">
          {!hatAlarm && (
            <div className="flex items-center gap-2 py-2 text-matcha-600 dark:text-matcha-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Alle Bestellungen im Zeitplan.</span>
            </div>
          )}

          {hatAlarm && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                {abweichungen.length} Bestellung{abweichungen.length > 1 ? 'en überschreiten' : ' überschreitet'} die Schätzzeit um &gt;{Math.round((schwelle - 1) * 100)}%.
              </p>
            </div>
          )}

          {abweichungen.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{a.gericht}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Geschätzt: {a.geschaetzt_min} Min · Aktuell: {a.aktuell_min} Min
                </p>
              </div>
              <span className="ml-2 flex-shrink-0 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[11px] font-bold px-2 py-0.5">
                +{a.abweichung_pct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
