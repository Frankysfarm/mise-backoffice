'use client';

// Phase 1262 — Wartezeit-Warnung (Kitchen)
// Alert wenn Bestellung nach fertig-Status länger als Schwelle auf Fahrer wartet
// Props: orders · props-basiert (useMemo) · schwelleMinuten=8

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status?: string;
  ready_at?: string | null;
  customer_name?: string | null;
  items?: Array<{ name?: string; quantity?: number }>;
  total_amount?: number | null;
}

interface Props {
  orders: Order[];
  schwelleMinuten?: number;
}

const FERTIG_STATUS = new Set(['ready', 'fertig', 'bereit', 'abholbereit']);

function minutenWarten(readyAt: string | null | undefined): number {
  if (!readyAt) return 0;
  return Math.floor((Date.now() - new Date(readyAt).getTime()) / 60000);
}

function levelFor(min: number, schwelle: number): 'warn' | 'kritisch' | 'ok' {
  if (min >= schwelle * 2) return 'kritisch';
  if (min >= schwelle) return 'warn';
  return 'ok';
}

const LEVEL_STYLE = {
  warn: {
    header: 'bg-gradient-to-r from-amber-400 to-orange-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    badge: 'bg-amber-500 text-white',
    row: 'border-amber-100 dark:border-amber-800/50',
    icon: 'text-amber-500',
    time: 'text-amber-700 dark:text-amber-300 font-bold',
  },
  kritisch: {
    header: 'bg-gradient-to-r from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-600 text-white',
    row: 'border-red-100 dark:border-red-800/50',
    icon: 'text-red-500 animate-pulse',
    time: 'text-red-700 dark:text-red-300 font-bold',
  },
};

export function KitchenPhase1262WartezeitWarnung({ orders, schwelleMinuten = 8 }: Props) {
  const [open, setOpen] = useState(true);

  const wartende = useMemo(() => {
    return orders
      .filter(o => FERTIG_STATUS.has(o.status ?? ''))
      .map(o => ({ ...o, warteMin: minutenWarten(o.ready_at) }))
      .filter(o => o.warteMin >= schwelleMinuten)
      .sort((a, b) => b.warteMin - a.warteMin);
  }, [orders, schwelleMinuten]);

  if (wartende.length === 0) return null;

  const maxLevel = wartende.some(o => levelFor(o.warteMin, schwelleMinuten) === 'kritisch') ? 'kritisch' : 'warn';
  const s = LEVEL_STYLE[maxLevel];

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden mb-3', s.bg, s.border)}>
      <button
        className={cn('flex w-full items-center justify-between px-4 py-2.5 text-white', s.header)}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold text-sm">Wartezeit-Warnung</span>
          <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
            {wartende.length} Bestellung{wartende.length > 1 ? 'en' : ''} warten auf Fahrer
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fertige Bestellungen warten seit über {schwelleMinuten} Min auf Abholung
          </p>
          <div className="space-y-2">
            {wartende.map(o => {
              const lv = levelFor(o.warteMin, schwelleMinuten);
              const ls = LEVEL_STYLE[lv === 'ok' ? 'warn' : lv];
              const itemLabel = o.items && o.items.length > 0
                ? o.items.slice(0, 2).map(i => `${i.quantity ?? 1}× ${i.name ?? '?'}`).join(', ')
                : '—';
              return (
                <div
                  key={o.id}
                  className={cn('flex items-center gap-3 rounded-lg border bg-white/70 dark:bg-white/5 px-3 py-2', ls.row)}
                >
                  <Package className={cn('h-4 w-4 shrink-0', ls.icon)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {o.customer_name ?? `Bestellung #${o.id.slice(-4)}`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{itemLabel}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className={cn('h-3.5 w-3.5', ls.icon)} />
                    <span className={cn('text-sm tabular-nums', ls.time)}>{o.warteMin} min</span>
                  </div>
                  {lv === 'kritisch' && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', ls.badge)}>Kritisch</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
            Schwelle: {schwelleMinuten} Min · Kritisch: {schwelleMinuten * 2} Min
          </p>
        </div>
      )}
    </div>
  );
}
