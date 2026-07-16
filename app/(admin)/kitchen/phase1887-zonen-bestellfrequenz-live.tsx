'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1887 — Zonen-Bestellfrequenz-Live (Kitchen)
 *
 * Bestellungen je Zone A/B/C/D in den letzten 30 Min als Mini-Balken.
 * Trend-Pfeil vs. vorherige 30 Min. Echtzeit aus props orders.
 * useMemo. Collapsible.
 */

interface Order {
  id: string;
  status?: string | null;
  delivery_zone?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  className?: string;
}

const ZONEN = ['A', 'B', 'C', 'D'] as const;

interface ZoneFrequenz {
  zone: string;
  last30: number;
  prev30: number;
  trend: 'up' | 'down' | 'gleich';
  anteil: number;
}

const FARB = {
  hoch:   { bar: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',     badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'     },
  mittel: { bar: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  niedrig:{ bar: 'bg-matcha-500',  text: 'text-matcha-700 dark:text-matcha-300',badge: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300'},
} as const;

function lastLevel(last30: number, max: number): keyof typeof FARB {
  const pct = max > 0 ? last30 / max : 0;
  if (pct >= 0.75) return 'hoch';
  if (pct >= 0.4)  return 'mittel';
  return 'niedrig';
}

function TrendIcon({ trend }: { trend: ZoneFrequenz['trend'] }) {
  if (trend === 'up')   return <TrendingUp   className="h-3 w-3 text-red-500 shrink-0"           />;
  if (trend === 'down') return <TrendingDown  className="h-3 w-3 text-matcha-500 shrink-0"        />;
  return                       <Minus         className="h-3 w-3 text-muted-foreground shrink-0"  />;
}

export function KitchenPhase1887ZonenBestellfrequenzLive({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const frequenzen = useMemo<ZoneFrequenz[]>(() => {
    const now = Date.now();
    const cutoff30 = now - 30 * 60 * 1000;
    const cutoff60 = now - 60 * 60 * 1000;

    const last30Map = new Map<string, number>(ZONEN.map((z) => [z, 0]));
    const prev30Map = new Map<string, number>(ZONEN.map((z) => [z, 0]));

    for (const o of orders) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!ZONEN.includes(zone as typeof ZONEN[number])) continue;
      const t = o.created_at ? new Date(o.created_at).getTime() : 0;
      if (t >= cutoff30) {
        last30Map.set(zone, (last30Map.get(zone) ?? 0) + 1);
      } else if (t >= cutoff60) {
        prev30Map.set(zone, (prev30Map.get(zone) ?? 0) + 1);
      }
    }

    const maxLast = Math.max(...ZONEN.map((z) => last30Map.get(z) ?? 0), 1);

    return ZONEN.map((z) => {
      const l = last30Map.get(z) ?? 0;
      const p = prev30Map.get(z) ?? 0;
      let trend: ZoneFrequenz['trend'] = 'gleich';
      if (l > p + 1) trend = 'up';
      else if (l < p - 1) trend = 'down';
      return {
        zone: z,
        last30: l,
        prev30: p,
        trend,
        anteil: Math.round((l / maxLast) * 100),
      };
    });
  }, [orders]);

  const gesamt30 = frequenzen.reduce((s, z) => s + z.last30, 0);
  const maxLast = Math.max(...frequenzen.map((z) => z.last30), 1);
  const hochlast = frequenzen.filter((z) => lastLevel(z.last30, maxLast) === 'hoch');

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-muted/10 hover:bg-muted/20 transition-colors"
      >
        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Zonen-Bestellfrequenz (letzte 30 Min)
        </span>
        {gesamt30 > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {gesamt30} gesamt
          </span>
        )}
        {hochlast.length > 0 && (
          <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            Zone {hochlast.map((z) => z.zone).join('+')} Hochlast
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-2">
          {frequenzen.map((z) => {
            const level = lastLevel(z.last30, maxLast);
            const f = FARB[level];
            return (
              <div key={z.zone} className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold shrink-0">
                  {z.zone}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('absolute top-0 left-0 h-full rounded-full transition-all duration-500', f.bar)}
                      style={{ width: `${z.anteil}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-28 justify-end">
                  <span className={cn('text-sm font-bold tabular-nums', f.text)}>
                    {z.last30}
                  </span>
                  <TrendIcon trend={z.trend} />
                  {z.prev30 > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      vs. {z.prev30}
                    </span>
                  )}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', f.badge)}>
                    {level === 'hoch' ? 'Hochlast' : level === 'mittel' ? 'Mittel' : 'Niedrig'}
                  </span>
                </div>
              </div>
            );
          })}

          {gesamt30 === 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              Keine Bestellungen in den letzten 30 Min.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
