'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1109 — Artikel-Popularitäts-Vorschau (Kitchen)
// Top-5 meistbestellte Artikel der aktuellen Schicht + Trend-Pfeil vs. Vortag

interface Item { name?: string; title?: string; quantity?: number }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress', 'preparing', 'ready', 'fertig', 'in_zubereitung', 'neu', 'new', 'accepted'];

type ArtikelStat = {
  name: string;
  anzahl: number;
  trend: 'up' | 'down' | 'gleich';
  trendDelta: number;
};

function getItemName(item: Item): string {
  return (item.name ?? item.title ?? '').trim() || 'Unbekannt';
}

function computeStats(orders: Order[]): ArtikelStat[] {
  const now = new Date();
  const schichtStart = new Date(now);
  schichtStart.setUTCHours(now.getUTCHours() < 12 ? 6 : 12, 0, 0, 0);

  const vortag = new Date(schichtStart);
  vortag.setUTCDate(vortag.getUTCDate() - 1);
  const vortagEnd = new Date(vortag);
  vortagEnd.setUTCHours(vortagEnd.getUTCHours() + 12);

  const heuteMap = new Map<string, number>();
  const vortagMap = new Map<string, number>();

  for (const o of orders) {
    const ts = o.created_at ? new Date(o.created_at) : null;
    const isHeute = ts && ts >= schichtStart && ts <= now;
    const isVortag = ts && ts >= vortag && ts <= vortagEnd;
    if (!o.items) continue;
    for (const item of o.items) {
      const name = getItemName(item);
      if (name === 'Unbekannt') continue;
      const qty = item.quantity ?? 1;
      if (isHeute) heuteMap.set(name, (heuteMap.get(name) ?? 0) + qty);
      if (isVortag) vortagMap.set(name, (vortagMap.get(name) ?? 0) + qty);
    }
  }

  // Fallback: use all active orders if heute is empty
  if (heuteMap.size === 0) {
    for (const o of orders) {
      if (!ACTIVE_STATUSES.includes(o.status.toLowerCase())) continue;
      if (!o.items) continue;
      for (const item of o.items) {
        const name = getItemName(item);
        if (name === 'Unbekannt') continue;
        heuteMap.set(name, (heuteMap.get(name) ?? 0) + (item.quantity ?? 1));
      }
    }
  }

  const top5 = Array.from(heuteMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return top5.map(([name, anzahl]) => {
    const vt = vortagMap.get(name) ?? 0;
    const delta = anzahl - vt;
    const trend: ArtikelStat['trend'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'gleich';
    return { name, anzahl, trend, trendDelta: delta };
  });
}

export function KitchenPhase1109ArtikelPopularitaetsVorschau({ orders }: Props) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => computeStats(orders), [orders]);

  if (stats.length === 0) return null;

  const maxAnzahl = Math.max(...stats.map(s => s.anzahl), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Artikel-Popularität</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            Top {stats.length} Schicht
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Meistbestellte Artikel — aktuelle Schicht
          </div>
          {stats.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-[10px] font-bold text-muted-foreground tabular-nums">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium truncate">{s.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-sm font-bold tabular-nums">{s.anzahl}×</span>
                    {s.trend === 'up' && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                        <TrendingUp className="h-3 w-3" />+{s.trendDelta}
                      </span>
                    )}
                    {s.trend === 'down' && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
                        <TrendingDown className="h-3 w-3" />{s.trendDelta}
                      </span>
                    )}
                    {s.trend === 'gleich' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Minus className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-violet-400' : 'bg-violet-300'
                    )}
                    style={{ width: `${(s.anzahl / maxAnzahl) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Trend-Pfeile vs. gleiche Schicht Vortag.
          </p>
        </div>
      )}
    </div>
  );
}
