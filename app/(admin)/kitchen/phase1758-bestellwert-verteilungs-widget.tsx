'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1758 — Bestellwert-Verteilungs-Widget (Kitchen)
 *
 * Ø Bestellwert heute + Histogramm (unter 20€ / 20–40€ / über 40€).
 * Trend vs. erste Tageshälfte. Props-basiert (orders), useMemo, Collapsible.
 */

interface Order {
  created_at?: string;
  total?: number;
  total_price?: number;
  preis?: number;
}

interface Props {
  orders: Order[];
  className?: string;
}

function getWert(o: Order): number {
  return (o.total ?? o.total_price ?? o.preis ?? 0);
}

const UNTER_20 = 20;
const BIS_40 = 40;

export function KitchenPhase1758BestellwertVerteilungsWidget({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo(() => {
    if (orders.length === 0) return null;

    const werte = orders.map(getWert).filter(v => v > 0);
    if (werte.length === 0) return null;

    const avg = Math.round(werte.reduce((s, v) => s + v, 0) / werte.length * 100) / 100;

    const u20 = werte.filter(v => v < UNTER_20).length;
    const bis40 = werte.filter(v => v >= UNTER_20 && v <= BIS_40).length;
    const ue40 = werte.filter(v => v > BIS_40).length;
    const total = werte.length;

    // Trend: erste vs. zweite Tageshälfte (nach Index)
    const firstHalf = werte.slice(0, Math.floor(werte.length / 2));
    const secondHalf = werte.slice(Math.floor(werte.length / 2));
    const avg1 = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
    const avg2 = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
    const delta = Math.round((avg2 - avg1) * 100) / 100;
    const trend: 'steigend' | 'fallend' | 'stabil' = delta > 0.5 ? 'steigend' : delta < -0.5 ? 'fallend' : 'stabil';

    return { avg, u20, bis40, ue40, total, trend, delta };
  }, [orders]);

  const TrendIcon = !stats ? Minus : stats.trend === 'steigend' ? TrendingUp : stats.trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = !stats ? 'text-muted-foreground' : stats.trend === 'steigend' ? 'text-green-600 dark:text-green-400' : stats.trend === 'fallend' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

  const buckets = stats ? [
    { label: '< 20 €',   count: stats.u20,   pct: stats.total > 0 ? stats.u20   / stats.total * 100 : 0, color: 'bg-sky-400' },
    { label: '20–40 €',  count: stats.bis40, pct: stats.total > 0 ? stats.bis40 / stats.total * 100 : 0, color: 'bg-amber-400' },
    { label: '> 40 €',   count: stats.ue40,  pct: stats.total > 0 ? stats.ue40  / stats.total * 100 : 0, color: 'bg-green-400' },
  ] : [];

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Bestellwert-Verteilung</span>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-sm font-black text-foreground">
              Ø {stats.avg.toFixed(2)} €
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!stats ? (
            <p className="text-sm text-muted-foreground">Noch keine Bestelldaten heute.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-black text-foreground">{stats.avg.toFixed(2)} €</div>
                  <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Ø Bestellwert</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-black text-foreground">{stats.total}</div>
                  <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Bestellungen</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className={cn('flex items-center justify-center gap-1')}>
                    <TrendIcon className={cn('h-5 w-5', trendColor)} />
                  </div>
                  <div className={cn('text-xs font-bold mt-0.5', trendColor)}>
                    {stats.trend === 'steigend' ? '+' : ''}{stats.delta.toFixed(2)} €
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Trend</div>
                </div>
              </div>

              <div className="space-y-2">
                {buckets.map(b => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{b.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', b.color)}
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums">{b.pct.toFixed(0)}%</span>
                    <span className="w-6 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">{b.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
