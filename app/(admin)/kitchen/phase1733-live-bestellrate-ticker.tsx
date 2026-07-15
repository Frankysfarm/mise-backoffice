'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1733 — Live-Bestellrate-Ticker (Kitchen)
 *
 * Bestellungen letzte 5/15/30 Min; Trend vs. Vorperiode;
 * Hochlauf/Rückgang-Badge; useMemo; Props orders; in kitchen/client.tsx.
 */

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
}

type Trend = 'hoch' | 'stabil' | 'rueckgang';

function countInWindow(orders: Order[], nowMs: number, windowMs: number): number {
  const since = nowMs - windowMs;
  return orders.filter(o => {
    const ts = o.bestellt_am ?? o.created_at;
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= since && t <= nowMs;
  }).length;
}

export function KitchenPhase1733LiveBestellrateTicker({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { cnt5, cnt15, cnt30, trend5, trend15, trend30, badge } = useMemo(() => {
    const now = Date.now();
    const MIN = 60_000;

    const cnt5 = countInWindow(orders, now, 5 * MIN);
    const cnt15 = countInWindow(orders, now, 15 * MIN);
    const cnt30 = countInWindow(orders, now, 30 * MIN);

    // Trend: compare current 5-min to prior 5-min
    const prev5 = countInWindow(orders, now - 5 * MIN, 5 * MIN);
    const prev15 = countInWindow(orders, now - 15 * MIN, 15 * MIN);
    const prev30 = countInWindow(orders, now - 30 * MIN, 30 * MIN);

    const trend5: Trend = cnt5 > prev5 ? 'hoch' : cnt5 < prev5 ? 'rueckgang' : 'stabil';
    const trend15: Trend = cnt15 > prev15 ? 'hoch' : cnt15 < prev15 ? 'rueckgang' : 'stabil';
    const trend30: Trend = cnt30 > prev30 ? 'hoch' : cnt30 < prev30 ? 'rueckgang' : 'stabil';

    // Overall badge driven by 5-min window
    const badge: Trend = trend5;

    return { cnt5, cnt15, cnt30, trend5, trend15, trend30, badge };
  }, [orders]);

  const badgeCfg: Record<Trend, { label: string; cls: string }> = {
    hoch:      { label: 'Hochlauf',  cls: 'bg-green-500 text-white' },
    stabil:    { label: 'Stabil',    cls: 'bg-blue-500 text-white' },
    rueckgang: { label: 'Rückgang',  cls: 'bg-amber-500 text-white' },
  };

  const TrendIcon = ({ t }: { t: Trend }) =>
    t === 'hoch' ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
    : t === 'rueckgang' ? <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
    : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  const bc = badgeCfg[badge];

  const windows: { label: string; cnt: number; trend: Trend }[] = [
    { label: 'Letzte 5 Min',  cnt: cnt5,  trend: trend5  },
    { label: 'Letzte 15 Min', cnt: cnt15, trend: trend15 },
    { label: 'Letzte 30 Min', cnt: cnt30, trend: trend30 },
  ];

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-950/10 p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
          <Zap className="h-4 w-4" />
          Bestellrate Live
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-black', bc.cls)}>
            {bc.label}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {windows.map(w => (
              <div key={w.label} className="rounded-lg border border-border/60 bg-background/60 p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{w.label}</p>
                <p className="text-xl font-black tabular-nums text-foreground">{w.cnt}</p>
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  <TrendIcon t={w.trend} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
            <Zap className="h-3 w-3" />
            Bestellungen je Zeitfenster — Trend vs. Vorperiode
          </div>
        </div>
      )}
    </div>
  );
}
