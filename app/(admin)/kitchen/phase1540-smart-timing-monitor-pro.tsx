'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Zap, Timer } from 'lucide-react';

/**
 * Phase 1540 — Smart Timing Monitor Pro (Kitchen)
 *
 * Vollständige Übersicht aller aktiven Bestellungen (inkl. 'fertig') mit
 * sekundengenauem Countdown und 5-Stufen-Farbkodierung:
 *   Grün      = >15 Min verbleibend
 *   Gelb      = 10–15 Min
 *   Orange    = 5–10 Min
 *   Rot       = <5 Min
 *   Violett   = überfällig
 *
 * Sortierung: dringendste Bestellung zuerst.
 * Auto-Refresh: jede Sekunde via setInterval.
 * Zusammenfassung: Gesamtanzahl, Überfällige, Ø verbleibende Zeit.
 */

interface Props {
  orders: Array<{
    id: string;
    bestellnummer?: string | null;
    status: string;
    kunde_name?: string | null;
    items?: Array<{ name?: string }> | null;
    bestellt_am?: string | null;
    created_at?: string | null;
  }>;
  timings?: Array<{
    order_id: string;
    cook_start_at?: string | null;
    ready_target?: string | null;
    prep_min?: number | null;
  }>;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);
const DEFAULT_PREP_MIN = 15;

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
};

const STATUS_STYLES: Record<string, string> = {
  neu: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300',
  bestätigt: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300 border-matcha-300',
  in_zubereitung: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300',
  fertig: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300',
};

function getReadyAt(
  order: Props['orders'][number],
  timings: NonNullable<Props['timings']>,
): Date {
  const t = timings.find(t => t.order_id === order.id);
  if (t?.ready_target) return new Date(t.ready_target);
  const base = order.bestellt_am ?? order.created_at ?? new Date().toISOString();
  const prepMin = t?.prep_min ?? DEFAULT_PREP_MIN;
  return new Date(new Date(base).getTime() + prepMin * 60_000);
}

function colorStep(secsLeft: number): {
  ring: string;
  bg: string;
  text: string;
  label: string;
  icon: typeof Clock;
} {
  if (secsLeft > 15 * 60)
    return { ring: 'ring-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-900/20', text: 'text-matcha-700 dark:text-matcha-300', label: 'OK', icon: CheckCircle2 };
  if (secsLeft > 10 * 60)
    return { ring: 'ring-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', label: 'Bald', icon: Clock };
  if (secsLeft > 5 * 60)
    return { ring: 'ring-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', label: 'Eile', icon: Zap };
  if (secsLeft > 0)
    return { ring: 'ring-red-500', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', label: 'Dringend', icon: AlertTriangle };
  return { ring: 'ring-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', label: 'Überfällig', icon: AlertTriangle };
}

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const sec = (abs % 60).toString().padStart(2, '0');
  return `${s < 0 ? '-' : ''}${m}:${sec}`;
}

function fmtAvg(secsAvg: number): string {
  if (!isFinite(secsAvg)) return '—';
  const sign = secsAvg < 0 ? '-' : '';
  const abs = Math.abs(Math.round(secsAvg));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}m ${s.toString().padStart(2, '0')}s`;
}

export function KitchenPhase1540SmartTimingMonitorPro({ orders, timings = [] }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(() => {
    return orders
      .filter(o => ACTIVE_STATUSES.has(o.status))
      .map(o => {
        const readyAt = getReadyAt(o, timings);
        const secsLeft = Math.round((readyAt.getTime() - now) / 1000);
        return { ...o, secsLeft, readyAt };
      })
      .sort((a, b) => a.secsLeft - b.secsLeft);
  }, [orders, timings, now]);

  const overdueCount = active.filter(o => o.secsLeft <= 0).length;

  const avgSecsLeft = useMemo(() => {
    if (active.length === 0) return NaN;
    return active.reduce((sum, o) => sum + o.secsLeft, 0) / active.length;
  }, [active]);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-matcha-50 dark:bg-matcha-900/20 hover:bg-matcha-100 dark:hover:bg-matcha-900/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-semibold text-matcha-800 dark:text-matcha-200">
            Smart Timing Monitor Pro
          </span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 border border-matcha-300 dark:border-matcha-700 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            {active.length} aktiv
          </span>
          {overdueCount > 0 && (
            <span className="animate-pulse rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-400 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
              {overdueCount}× Überfällig
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          : <ChevronDown className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Summary Row */}
          {active.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 bg-muted/30 border-b text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-semibold text-foreground">{active.length}</span> Bestellungen aktiv
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-violet-500" />
                <span className={cn('font-semibold', overdueCount > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-foreground')}>
                  {overdueCount}
                </span> überfällig
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-matcha-500" />
                Ø verbleibend:{' '}
                <span className="font-semibold text-foreground ml-1">{fmtAvg(avgSecsLeft)}</span>
              </span>
            </div>
          )}

          <div className="px-4 py-3">
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Keine aktiven Bestellungen
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {active.map(o => {
                  const c = colorStep(o.secsLeft);
                  const Icon = c.icon;
                  const itemCount = (o.items ?? []).length;
                  const statusLabel = STATUS_LABELS[o.status] ?? o.status;
                  const statusStyle = STATUS_STYLES[o.status] ?? 'bg-muted text-muted-foreground border-border';

                  return (
                    <div
                      key={o.id}
                      className={cn(
                        'relative flex flex-col gap-2 rounded-xl p-3 ring-2 transition-all duration-300',
                        c.ring, c.bg,
                      )}
                    >
                      {/* Order number + status badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground truncate">
                          #{o.bestellnummer ?? o.id.slice(-4)}
                        </span>
                        <span className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                          statusStyle,
                        )}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Customer name */}
                      {o.kunde_name && (
                        <span className="text-[11px] font-medium text-muted-foreground truncate leading-tight">
                          {o.kunde_name}
                        </span>
                      )}

                      {/* Countdown */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <Icon className={cn('h-3 w-3 shrink-0', c.text)} />
                          <span className={cn('text-[10px] font-bold uppercase tracking-wide', c.text)}>
                            {c.label}
                          </span>
                        </div>
                        <span className={cn('font-mono text-xl font-black tabular-nums leading-none', c.text)}>
                          {fmtSecs(o.secsLeft)}
                        </span>
                      </div>

                      {/* Item count */}
                      {itemCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-semibold">
                            {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            {active.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                {[
                  { label: 'OK (>15 Min)', color: 'bg-matcha-500', count: active.filter(o => o.secsLeft > 15 * 60).length },
                  { label: 'Bald (10–15)', color: 'bg-yellow-400', count: active.filter(o => o.secsLeft > 10 * 60 && o.secsLeft <= 15 * 60).length },
                  { label: 'Eile (5–10)', color: 'bg-orange-500', count: active.filter(o => o.secsLeft > 5 * 60 && o.secsLeft <= 10 * 60).length },
                  { label: 'Dringend (<5)', color: 'bg-red-500', count: active.filter(o => o.secsLeft > 0 && o.secsLeft <= 5 * 60).length },
                  { label: 'Überfällig', color: 'bg-violet-500', count: overdueCount },
                ]
                  .filter(s => s.count > 0)
                  .map(s => (
                    <span key={s.label} className="flex items-center gap-1 text-muted-foreground">
                      <span className={cn('inline-block h-2 w-2 rounded-full', s.color)} />
                      {s.label}: <span className="font-semibold">{s.count}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
