'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1199 — Bestellungs-Warteschlangen-Prognose (Kitchen)
// Voraussichtliche Bestellanzahl in den nächsten 30/60 Min basierend auf historischem Muster

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
}

interface Props { orders: Order[] }

type PrognosePunkt = {
  label: string;
  prognose: number;
  trend: 'steigend' | 'stabil' | 'fallend';
};

const ACTIVE_STATUSES = new Set(['neu', 'angenommen', 'in_zubereitung', 'bereit', 'in_progress', 'accepted', 'preparing', 'ready']);

function computePrognose(orders: Order[]): { punkte: PrognosePunkt[]; rate_pro_30min: number } {
  const now = Date.now();
  const letzte30min = orders.filter(o => {
    if (!o.created_at) return false;
    return (now - new Date(o.created_at).getTime()) <= 30 * 60000;
  }).length;
  const letzte60min = orders.filter(o => {
    if (!o.created_at) return false;
    return (now - new Date(o.created_at).getTime()) <= 60 * 60000;
  }).length;

  // Rate letzte 30 min als Basis
  const rate = letzte30min;
  // Trend: Vergleich erste vs. zweite 30-Min-Hälfte der letzten Stunde
  const erste30 = letzte60min - letzte30min;
  const trendRich: 'steigend' | 'stabil' | 'fallend' =
    letzte30min > erste30 + 1 ? 'steigend' :
    letzte30min < erste30 - 1 ? 'fallend' : 'stabil';

  // Prognose nächste 30 und 60 Min (einfaches lineares Modell + Glättung)
  const faktor60 = trendRich === 'steigend' ? 1.15 : trendRich === 'fallend' ? 0.85 : 1.0;
  const prognose30 = Math.round(rate);
  const prognose60 = Math.round(rate * 2 * faktor60);

  return {
    punkte: [
      { label: 'Nächste 30 Min', prognose: prognose30, trend: trendRich },
      { label: 'Nächste 60 Min', prognose: prognose60, trend: trendRich },
    ],
    rate_pro_30min: rate,
  };
}

const TREND_STYLES = {
  steigend: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700', badge: 'bg-amber-500', label: '↑ Steigend' },
  stabil:   { color: 'text-matcha-600 dark:text-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-700', badge: 'bg-matcha-500', label: '→ Stabil' },
  fallend:  { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700', badge: 'bg-blue-500', label: '↓ Fallend' },
};

export function KitchenPhase1199BestellungsWarteschlangenPrognose({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const { punkte, rate_pro_30min } = useMemo(() => computePrognose(orders), [orders]);
  const aktiveBestellungen = useMemo(
    () => orders.filter(o => ACTIVE_STATUSES.has(o.status)).length,
    [orders],
  );
  const trend = punkte[0]?.trend ?? 'stabil';
  const styles = TREND_STYLES[trend];

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', styles.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className={cn('h-4 w-4 shrink-0', styles.color)} />
          <span className={cn('font-bold text-sm', styles.color)}>Warteschlangen-Prognose</span>
          <span className={cn('rounded-full text-white text-[10px] font-black px-2 py-0.5', styles.badge)}>
            {styles.label}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Aktiv jetzt:</span>
            <span className={cn('font-bold tabular-nums', styles.color)}>{aktiveBestellungen} Bestellungen</span>
            <span className="text-muted-foreground">Rate:</span>
            <span className={cn('font-bold tabular-nums', styles.color)}>{rate_pro_30min}/30 Min</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {punkte.map(p => (
              <div
                key={p.label}
                className="rounded-lg border bg-white/60 dark:bg-black/20 px-3 py-2.5 flex flex-col gap-1"
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {p.label}
                </span>
                <span className={cn('text-2xl font-black tabular-nums', styles.color)}>
                  {p.prognose}
                </span>
                <span className="text-[10px] text-muted-foreground">Bestellungen erwartet</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground px-1">
            Prognose basiert auf Bestellrate der letzten 30 Min + Trendkorrektur.
          </p>
        </div>
      )}
    </div>
  );
}
