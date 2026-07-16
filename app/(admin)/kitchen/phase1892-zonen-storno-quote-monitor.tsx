'use client';

/**
 * Phase 1892 — Zonen-Storno-Quote-Monitor (Kitchen)
 *
 * Storno-Rate je Zone A/B/C/D letzte 2h aus props orders.
 * Alert-Banner wenn >10% in einer Zone.
 * useMemo für Performance. Collapsible (default offen).
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  delivery_zone?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  className?: string;
}

const ZONEN = ['A', 'B', 'C', 'D'] as const;
type Zone = (typeof ZONEN)[number];

const ZONE_LABEL: Record<Zone, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

function ampelColor(pct: number) {
  if (pct > 10) return 'text-red-600 dark:text-red-400';
  if (pct > 5)  return 'text-amber-600 dark:text-amber-400';
  return 'text-matcha-600 dark:text-matcha-400';
}

function ampelBg(pct: number) {
  if (pct > 10) return 'bg-red-100 dark:bg-red-900/30';
  if (pct > 5)  return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-matcha-100 dark:bg-matcha-900/30';
}

export function KitchenPhase1892ZonenStornoQuoteMonitor({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const stats = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const relevant = orders.filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= cutoff;
    });

    return ZONEN.map((zone) => {
      const zoneOrders = relevant.filter(
        (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
      );
      const gesamt = zoneOrders.length;
      const storniert = zoneOrders.filter((o) =>
        ['cancelled', 'canceled', 'refunded', 'storniert'].includes(o.status),
      ).length;
      const quote = gesamt > 0 ? (storniert / gesamt) * 100 : 0;
      return { zone, gesamt, storniert, quote };
    });
  }, [orders]);

  const alerts = stats.filter((s) => s.quote > 10);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Storno-Quote (letzte 2h)</span>
        {alerts.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {alerts.length} kritisch
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-3 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Zone{alerts.length > 1 ? 'n' : ''}{' '}
                {alerts.map((a) => `${a.zone} (${a.quote.toFixed(0)}%)`).join(', ')}{' '}
                — Storno-Quote &gt;10%! Bitte Ursache prüfen.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => {
              const barWidth = Math.min(100, Math.round(s.quote));
              return (
                <div
                  key={s.zone}
                  className={cn('rounded-xl p-2.5 space-y-1.5', ampelBg(s.quote))}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Zone {s.zone}
                      <span className="ml-1 text-muted-foreground font-normal text-[10px]">
                        {ZONE_LABEL[s.zone]}
                      </span>
                    </span>
                    <span className={cn('text-sm font-bold tabular-nums', ampelColor(s.quote))}>
                      {s.quote.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/50 dark:bg-black/20 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        s.quote > 10
                          ? 'bg-red-500'
                          : s.quote > 5
                          ? 'bg-amber-500'
                          : 'bg-matcha-500',
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {s.storniert} / {s.gesamt} Storniert
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
