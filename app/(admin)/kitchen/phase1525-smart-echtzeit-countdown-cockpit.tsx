'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1525 — Smart-Echtzeit-Countdown-Cockpit (Kitchen)
 *
 * Sekunden-genauer Countdown je aktiver Bestellung mit 5-Stufen-Farbkodierung:
 *   Grün      = >15 Min verbleibend
 *   Gelb      = 10–15 Min
 *   Orange    = 5–10 Min
 *   Rot       = <5 Min
 *   Violett   = überfällig (Kochzeit überschritten)
 *
 * Sortierung: dringendste Bestellung zuerst.
 * Auto-Refresh: jede Sekunde via setInterval.
 */

interface OrderItem {
  name?: string | null;
  title?: string | null;
}

interface KitchenTiming {
  order_id: string;
  estimated_ready_at?: string | null;
  cook_start_at?: string | null;
  prep_minutes?: number | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  kunde_name?: string | null;
  items?: OrderItem[] | null;
  created_at?: string | null;
  bestellt_am?: string | null;
}

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'confirmed', 'in_zubereitung', 'in_preparation', 'preparing']);
const DEFAULT_PREP_MIN = 15;

function getReadyAt(order: Order, timings: KitchenTiming[]): Date {
  const t = timings.find(t => t.order_id === order.id);
  if (t?.estimated_ready_at) return new Date(t.estimated_ready_at);
  const base = order.bestellt_am ?? order.created_at ?? new Date().toISOString();
  const prepMin = t?.prep_minutes ?? DEFAULT_PREP_MIN;
  return new Date(new Date(base).getTime() + prepMin * 60_000);
}

function colorStep(secsLeft: number): {
  ring: string; bg: string; text: string; label: string; icon: typeof Clock;
} {
  if (secsLeft > 15 * 60) return { ring: 'ring-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-900/20', text: 'text-matcha-700 dark:text-matcha-300', label: 'OK', icon: CheckCircle2 };
  if (secsLeft > 10 * 60) return { ring: 'ring-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', label: 'Bald', icon: Clock };
  if (secsLeft > 5 * 60)  return { ring: 'ring-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', label: 'Eile', icon: Zap };
  if (secsLeft > 0)        return { ring: 'ring-red-500',    bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-300',     label: 'Dringend', icon: AlertTriangle };
  return                         { ring: 'ring-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', label: 'Überfällig', icon: AlertTriangle };
}

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const sec = (abs % 60).toString().padStart(2, '0');
  return `${s < 0 ? '-' : ''}${m}:${sec}`;
}

export function KitchenPhase1525SmartEchtzeitCountdownCockpit({ orders, timings = [] }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = orders
    .filter(o => ACTIVE_STATUSES.has(o.status))
    .map(o => {
      const readyAt = getReadyAt(o, timings);
      const secsLeft = Math.round((readyAt.getTime() - now) / 1000);
      return { ...o, secsLeft, readyAt };
    })
    .sort((a, b) => a.secsLeft - b.secsLeft);

  const overdueCount = active.filter(o => o.secsLeft <= 0).length;
  const urgentCount  = active.filter(o => o.secsLeft > 0 && o.secsLeft <= 5 * 60).length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Echtzeit-Countdown-Cockpit</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {active.length} aktiv
          </span>
          {overdueCount > 0 && (
            <span className="animate-pulse rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-400 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
              {overdueCount}× Überfällig
            </span>
          )}
          {urgentCount > 0 && overdueCount === 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/30 border border-red-400 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              {urgentCount}× Dringend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine aktiven Bestellungen</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {active.map(o => {
                const c = colorStep(o.secsLeft);
                const Icon = c.icon;
                const itemNames = (o.items ?? [])
                  .map(i => i.name ?? i.title ?? '')
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(', ');
                return (
                  <div
                    key={o.id}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-xl p-3 ring-2 transition-all duration-300',
                      c.ring, c.bg,
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className={cn('h-3 w-3', c.text)} />
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide', c.text)}>{c.label}</span>
                    </div>
                    <span className={cn('font-mono text-2xl font-black tabular-nums leading-none', c.text)}>
                      {fmtSecs(o.secsLeft)}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground truncate w-full text-center">
                      #{o.bestellnummer ?? o.id.slice(-4)}
                    </span>
                    {itemNames && (
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
                        {itemNames}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              {[
                { label: 'OK', color: 'bg-matcha-500', count: active.filter(o => o.secsLeft > 15*60).length },
                { label: 'Bald', color: 'bg-yellow-400', count: active.filter(o => o.secsLeft > 10*60 && o.secsLeft <= 15*60).length },
                { label: 'Eile', color: 'bg-orange-500', count: active.filter(o => o.secsLeft > 5*60 && o.secsLeft <= 10*60).length },
                { label: 'Dringend', color: 'bg-red-500', count: active.filter(o => o.secsLeft > 0 && o.secsLeft <= 5*60).length },
                { label: 'Überfällig', color: 'bg-violet-500', count: overdueCount },
              ].filter(s => s.count > 0).map(s => (
                <span key={s.label} className="flex items-center gap-1 text-muted-foreground">
                  <span className={cn('inline-block h-2 w-2 rounded-full', s.color)} />
                  {s.label}: {s.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
