'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 2019 — Batching-Effizienz-Monitor (Kitchen)
 *
 * Ø Artikel je Batch; Einzelbestellungen vs. Sammellieferungen; Alert wenn Batching <30%; useMemo.
 */

interface Order {
  id: string;
  status: string;
  created_at: string;
  items?: { id: string }[];
  batch_id?: string | null;
  item_count?: number;
}

interface Props {
  orders: Order[];
}

export function KitchenPhase2019BatchingEffizienzMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo(() => {
    const aktiv = orders.filter(o =>
      ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status),
    );
    if (aktiv.length === 0) return null;

    const batched = aktiv.filter(o => o.batch_id != null && o.batch_id !== '');
    const einzeln = aktiv.filter(o => !o.batch_id);

    const batchingQuote = aktiv.length > 0 ? (batched.length / aktiv.length) * 100 : 0;

    const avgArtikel = aktiv.reduce((sum, o) => {
      const count = o.item_count ?? (o.items?.length ?? 1);
      return sum + count;
    }, 0) / aktiv.length;

    return {
      gesamt: aktiv.length,
      batched: batched.length,
      einzeln: einzeln.length,
      batchingQuote: Math.round(batchingQuote),
      avgArtikel: Math.round(avgArtikel * 10) / 10,
      alert: batchingQuote < 30,
    };
  }, [orders]);

  const ampelColor = !stats
    ? 'text-muted-foreground'
    : stats.batchingQuote >= 50
      ? 'text-matcha-600'
      : stats.batchingQuote >= 30
        ? 'text-amber-600'
        : 'text-red-600';

  const barColor = !stats
    ? 'bg-muted'
    : stats.batchingQuote >= 50
      ? 'bg-matcha-500'
      : stats.batchingQuote >= 30
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Package className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Batching-Effizienz</span>
        {stats && (
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5',
            stats.batchingQuote >= 50
              ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
              : stats.batchingQuote >= 30
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
          )}>
            {stats.batchingQuote}% gebündelt
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!stats ? (
            <div className="flex items-center gap-2 rounded-lg border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-900/20 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
              <span className="text-xs font-medium text-matcha-700 dark:text-matcha-300">Keine aktiven Bestellungen</span>
            </div>
          ) : (
            <>
              {stats.alert && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                    Batching unter 30% — mehr Bestellungen bündeln
                  </span>
                </div>
              )}

              {/* Batching-Quote-Balken */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Bündelungsquote</span>
                  <span className={cn('text-sm font-black', ampelColor)}>{stats.batchingQuote}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barColor)}
                    style={{ width: `${stats.batchingQuote}%` }}
                  />
                </div>
              </div>

              {/* KPI-Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Gesamt', value: String(stats.gesamt) },
                  { label: 'Gebündelt', value: String(stats.batched) },
                  { label: 'Einzeln', value: String(stats.einzeln) },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-lg border bg-muted/20 p-2 text-center">
                    <div className="text-lg font-black text-foreground">{kpi.value}</div>
                    <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Ø <span className="font-bold text-foreground">{stats.avgArtikel}</span> Artikel je Bestellung
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
