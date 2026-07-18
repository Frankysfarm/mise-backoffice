'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

/**
 * Phase 1000 — Smart-Timing Ampel-Cockpit (Kitchen)
 *
 * Farbkodiertes Echtzeit-Countdown-Board für alle aktiven Bestellungen.
 * Grün = pünktlich, Gelb = knapp, Rot = überfällig.
 * Berechnet verbleibende Zeit anhand prep_started_at + prep_time_min.
 */

interface Order {
  id: string;
  status: string;
  prep_started_at?: string | null;
  prep_time_min?: number | null;
  created_at?: string | null;
  customer_name?: string | null;
  order_number?: string | null;
  items?: Array<{ name?: string; title?: string; quantity?: number }> | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

interface TimingRow {
  id: string;
  displayName: string;
  itemsLabel: string;
  ampel: Ampel;
  remainSec: number;
  totalSec: number;
  elapsedSec: number;
  pct: number;
  isOverdue: boolean;
}

const AMPEL_STYLES: Record<Ampel, { border: string; bg: string; bar: string; badge: string; badgeText: string; label: string }> = {
  gruen:  { border: 'border-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-950/20', bar: 'bg-matcha-500', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300', badgeText: 'text-matcha-700 dark:text-matcha-300', label: 'Pünktlich' },
  gelb:   { border: 'border-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/20',   bar: 'bg-amber-400',  badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300',   badgeText: 'text-amber-700 dark:text-amber-300',  label: 'Knapp'    },
  rot:    { border: 'border-red-300',    bg: 'bg-red-50 dark:bg-red-950/20',        bar: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 border-red-300',         badgeText: 'text-red-700 dark:text-red-300',      label: 'Überfällig' },
  fertig: { border: 'border-zinc-200',   bg: 'bg-zinc-50 dark:bg-zinc-900/20',      bar: 'bg-zinc-400',   badge: 'bg-zinc-100 dark:bg-zinc-800/30 border-zinc-300',      badgeText: 'text-zinc-600 dark:text-zinc-400',    label: 'Fertig'   },
};

function formatCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function computeRow(order: Order, now: number): TimingRow | null {
  const active = ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'];
  if (!active.includes(order.status)) return null;

  const prepMin = order.prep_time_min ?? 15;
  const startMs = order.prep_started_at
    ? new Date(order.prep_started_at).getTime()
    : order.created_at
    ? new Date(order.created_at).getTime()
    : now - 60_000;

  const totalSec = prepMin * 60;
  const elapsedSec = Math.floor((now - startMs) / 1000);
  const remainSec = totalSec - elapsedSec;
  const pct = Math.min(100, Math.max(0, (elapsedSec / Math.max(totalSec, 1)) * 100));
  const isOverdue = remainSec < 0;

  let ampel: Ampel;
  if (isOverdue)              ampel = 'rot';
  else if (remainSec < 120)   ampel = 'gelb';
  else                        ampel = 'gruen';

  const items = order.items ?? [];
  const itemsLabel = items.length > 0
    ? items.slice(0, 2).map(i => `${i.quantity ? `${i.quantity}× ` : ''}${i.name ?? i.title ?? ''}`.trim()).filter(Boolean).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '')
    : '';

  return {
    id: order.id,
    displayName: order.order_number ?? order.customer_name ?? order.id.slice(0, 6),
    itemsLabel,
    ampel,
    remainSec,
    totalSec,
    elapsedSec,
    pct,
    isOverdue,
  };
}

export function KitchenPhase1000SmartTimingAmpelCockpit({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return orders
      .map(o => computeRow(o, now))
      .filter((r): r is TimingRow => r !== null)
      .sort((a, b) => {
        const order: Ampel[] = ['rot', 'gelb', 'gruen', 'fertig'];
        if (order.indexOf(a.ampel) !== order.indexOf(b.ampel)) return order.indexOf(a.ampel) - order.indexOf(b.ampel);
        return a.remainSec - b.remainSec;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const rotCount  = rows.filter(r => r.ampel === 'rot').length;
  const gelbCount = rows.filter(r => r.ampel === 'gelb').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing Ampel</span>
          {rotCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {rotCount} überfällig
            </span>
          )}
          {gelbCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {gelbCount} knapp
            </span>
          )}
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
            {rows.length} aktiv
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(row => {
            const s = AMPEL_STYLES[row.ampel];
            return (
              <div key={row.id} className={cn('px-4 py-2.5', s.bg, s.border.replace('border-', 'border-l-4 border-l-'))}>
                <div className="flex items-center gap-3">
                  {/* Countdown */}
                  <div className={cn(
                    'shrink-0 w-14 text-center font-mono text-sm font-black tabular-nums rounded-lg px-1.5 py-1 border',
                    s.badge, s.badgeText,
                    row.isOverdue && 'animate-pulse',
                  )}>
                    {formatCountdown(row.remainSec)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{row.displayName}</span>
                      <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', s.badge, s.badgeText)}>
                        {s.label}
                      </span>
                    </div>
                    {row.itemsLabel && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{row.itemsLabel}</p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed */}
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {Math.floor(row.elapsedSec / 60)}m {row.elapsedSec % 60}s
                    </span>
                    <div className="text-[9px] text-muted-foreground">vergangen</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {open && (
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-3 flex-wrap">
          {(['gruen', 'gelb', 'rot'] as Ampel[]).map(a => {
            const count = rows.filter(r => r.ampel === a).length;
            if (count === 0) return null;
            const s = AMPEL_STYLES[a];
            return (
              <span key={a} className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', s.badge, s.badgeText)}>
                {count} {s.label}
              </span>
            );
          })}
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Live
          </span>
        </div>
      )}
    </div>
  );
}
