'use client';

// Phase 1123 — Smart-Timing-Countdown-Board (Kitchen)
// Zeigt alle aktiven Bestellungen als farbkodierte Countdown-Kacheln
// Grün >15 Min | Gelb 5-15 Min | Orange 2-5 Min | Rot <2 Min + Flash

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

type Item = { name?: string; title?: string; quantity?: number; menge?: number };
type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};
type Order = {
  id: string;
  bestellnummer?: string;
  status: string;
  kunde_name?: string;
  geschaetzte_zubereitung_min?: number | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  items?: Item[] | null;
};

interface Props {
  orders: Order[];
  timings?: Timing[];
}

type Urgency = 'ok' | 'warn' | 'urgent' | 'critical';

const URGENCY: Record<Urgency, {
  bg: string; border: string; text: string; badge: string; label: string; ring: string;
}> = {
  ok:       { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700', label: 'OK',       ring: 'bg-emerald-400' },
  warn:     { bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',     text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-100 text-amber-700',   label: 'Bald',     ring: 'bg-amber-400' },
  urgent:   { bg: 'bg-orange-50 dark:bg-orange-900/20',   border: 'border-orange-200 dark:border-orange-700',   text: 'text-orange-700 dark:text-orange-300',   badge: 'bg-orange-100 text-orange-700', label: 'Dringend', ring: 'bg-orange-500' },
  critical: { bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700',         text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-100 text-red-700',       label: 'KRITISCH', ring: 'bg-red-500' },
};

function getUrgency(remainMin: number): Urgency {
  if (remainMin > 15) return 'ok';
  if (remainMin > 5)  return 'warn';
  if (remainMin > 2)  return 'urgent';
  return 'critical';
}

function getRemainingMin(order: Order, timing?: Timing): number | null {
  if (timing?.ready_target) {
    const diff = (new Date(timing.ready_target).getTime() - Date.now()) / 60_000;
    return Math.round(diff);
  }
  const ref = order.bestellt_am ?? order.created_at;
  const prepMin = order.geschaetzte_zubereitung_min ?? 20;
  if (!ref) return null;
  const elapsed = (Date.now() - new Date(ref).getTime()) / 60_000;
  return Math.round(prepMin - elapsed);
}

export function KitchenPhase1123SmartTimingCountdownBoard({ orders, timings = [] }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const active = useMemo(() =>
    orders.filter(o => !['done', 'rejected', 'delivered', 'storniert'].includes(o.status)),
    [orders]
  );

  const rows = useMemo(() => {
    void now; // re-evaluate on tick
    return active.map(order => {
      const timing = timings.find(t => t.order_id === order.id);
      const remainMin = getRemainingMin(order, timing);
      const urgency = remainMin !== null ? getUrgency(remainMin) : 'ok';
      const cooking = timing?.cook_start_at != null;
      const itemList = (order.items ?? []).slice(0, 3).map(i =>
        `${i.quantity ?? i.menge ?? 1}× ${i.name ?? i.title ?? '?'}`
      ).join(', ');
      return { order, timing, remainMin, urgency, cooking, itemList };
    }).sort((a, b) => (a.remainMin ?? 999) - (b.remainMin ?? 999));
  }, [active, timings, now]);

  const criticalCount = rows.filter(r => r.urgency === 'critical').length;
  const urgentCount   = rows.filter(r => r.urgency === 'urgent').length;

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-stone-600 dark:text-stone-300" />
          <span className="font-bold text-sm text-foreground">Smart-Timing-Board</span>
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Phase 1123</span>
          {criticalCount > 0 && (
            <span className="animate-pulse rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 uppercase">
              {criticalCount} Kritisch!
            </span>
          )}
          {urgentCount > 0 && criticalCount === 0 && (
            <span className="rounded-full bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 uppercase">
              {urgentCount} Dringend
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-bold">{active.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-200 dark:border-stone-700 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {rows.map(({ order, remainMin, urgency, cooking, itemList }) => {
              const st = URGENCY[urgency];
              const isCrit = urgency === 'critical';
              const absMin = remainMin !== null ? Math.abs(remainMin) : null;
              const isOverdue = remainMin !== null && remainMin < 0;
              return (
                <div
                  key={order.id}
                  className={cn(
                    'relative rounded-xl border p-3 flex flex-col gap-1.5 transition-all',
                    st.bg, st.border,
                    isCrit && 'animate-pulse ring-2 ring-red-400'
                  )}
                >
                  {/* Urgency badge */}
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full', st.badge)}>
                      {isOverdue ? '⏰ ÜBERFÄLLIG' : st.label}
                    </span>
                    {cooking
                      ? <Flame className={cn('h-3.5 w-3.5', st.text)} />
                      : <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>

                  {/* Countdown */}
                  <div className={cn('text-3xl font-black tabular-nums leading-none', st.text)}>
                    {absMin !== null ? (
                      <>
                        {isOverdue && <span className="text-lg">+</span>}
                        {absMin}
                        <span className="text-sm font-bold ml-0.5">m</span>
                      </>
                    ) : (
                      <span className="text-lg">—</span>
                    )}
                  </div>

                  {/* Color bar */}
                  {remainMin !== null && (
                    <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', st.ring)}
                        style={{ width: `${Math.max(0, Math.min(100, (remainMin / 25) * 100))}%` }}
                      />
                    </div>
                  )}

                  {/* Order number + items */}
                  <div className="text-[10px] text-muted-foreground font-semibold truncate">
                    #{order.bestellnummer ?? order.id.slice(-4)}
                  </div>
                  {itemList && (
                    <div className="text-[9px] text-muted-foreground truncate leading-tight">
                      {itemList}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary row */}
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            {(['ok', 'warn', 'urgent', 'critical'] as Urgency[]).map(u => {
              const count = rows.filter(r => r.urgency === u).length;
              if (count === 0) return null;
              const st = URGENCY[u];
              return (
                <span key={u} className={cn('rounded-full px-2 py-0.5 font-bold', st.badge)}>
                  {count}× {st.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
