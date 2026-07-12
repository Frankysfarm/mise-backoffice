'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1135 — Bestellungs-Priorität-Board (Kitchen)
// Farbkodierte Prioritätsliste aller aktiven Bestellungen nach Dringlichkeit

interface Item { name: string; qty?: number; }
interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: Item[];
  kunde_name: string;
}

interface Props {
  orders: Order[];
}

type Prioritaet = 'kritisch' | 'dringend' | 'normal' | 'fertig';

const ACTIVE_STATUSES = new Set(['confirmed', 'preparing', 'ready']);

function berechneMinuten(order: Order): number {
  if (!order.bestellt_am) return 0;
  return Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000);
}

function getPrioritaet(order: Order, elapsedMin: number): Prioritaet {
  if (order.status === 'ready') return 'fertig';
  const ziel = order.geschaetzte_zubereitung_min ?? 15;
  if (elapsedMin >= ziel + 5) return 'kritisch';
  if (elapsedMin >= ziel - 2) return 'dringend';
  return 'normal';
}

const PRIO_CONFIG: Record<Prioritaet, { bg: string; border: string; label: string; labelBg: string; textColor: string }> = {
  kritisch: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-700',
    label: 'Überfällig',
    labelBg: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    textColor: 'text-red-700 dark:text-red-300',
  },
  dringend: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'Dringend',
    labelBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  normal: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Normal',
    labelBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  fertig: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-200 dark:border-sky-800',
    label: 'Fertig',
    labelBg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    textColor: 'text-sky-700 dark:text-sky-300',
  },
};

export function KitchenPhase1135BestellungsPrioritaetBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const prioOrders = useMemo(() => {
    return orders
      .filter(o => ACTIVE_STATUSES.has(o.status) || o.status === 'ready')
      .map(o => {
        const elapsed = berechneMinuten(o);
        const prio = getPrioritaet(o, elapsed);
        return { order: o, elapsed, prio };
      })
      .sort((a, b) => {
        const rank: Record<Prioritaet, number> = { kritisch: 0, dringend: 1, normal: 2, fertig: 3 };
        if (rank[a.prio] !== rank[b.prio]) return rank[a.prio] - rank[b.prio];
        return b.elapsed - a.elapsed;
      });
  }, [orders]);

  const kritischCount = prioOrders.filter(r => r.prio === 'kritisch').length;
  const dringendCount = prioOrders.filter(r => r.prio === 'dringend').length;
  const hasAlert = kritischCount > 0 || dringendCount > 0;

  const headerColor = kritischCount > 0
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    : dringendCount > 0
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20';

  if (prioOrders.length === 0) return null;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', headerColor)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {hasAlert
            ? <Flame className="h-4 w-4 text-red-500" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          }
          <span className="font-bold text-sm text-foreground">Prioritäts-Board</span>
          {kritischCount > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold">
              {kritischCount} überfällig
            </span>
          )}
          {dringendCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
              {dringendCount} dringend
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{prioOrders.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-inherit">
          {prioOrders.map(({ order, elapsed, prio }) => {
            const cfg = PRIO_CONFIG[prio];
            const itemSummary = order.items.slice(0, 2).map(i => i.name).join(', ');
            const moreItems = order.items.length - 2;
            return (
              <div
                key={order.id}
                className={cn('rounded-lg border px-3 py-2 flex items-center gap-2', cfg.bg, cfg.border)}
              >
                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black', cfg.labelBg)}>
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-bold text-xs tabular-nums', cfg.textColor)}>
                      #{order.bestellnummer}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {itemSummary}{moreItems > 0 ? ` +${moreItems}` : ''}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground">{order.kunde_name}</div>
                </div>
                <div className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono font-bold text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {elapsed} Min
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
