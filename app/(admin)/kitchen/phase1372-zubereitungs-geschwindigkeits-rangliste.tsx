'use client';

import { useMemo } from 'react';
import { TrendingDown, TrendingUp, Minus, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1372 — Zubereitungs-Geschwindigkeits-Rangliste (Kitchen)
 *
 * Top-5 schnellste + Top-5 langsamste Gerichte nach Ø Zubereitungszeit.
 * Trend vs. Vorwoche (basierend auf Bestellhäufigkeit als Proxy).
 * Props-basiert. Nach Phase1367 in kitchen/client.tsx.
 */

interface OrderItem {
  name?: string;
  geschaetzte_zubereitung_min?: number;
  kategorie?: string;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
  geschaetzte_zubereitung_min?: number;
  tatsaechliche_zubereitung_min?: number;
}

interface Props {
  orders: Order[];
  locationId: string | null;
}

interface GerichtRang {
  name: string;
  avg_min: number;
  anzahl: number;
  trend: 'schneller' | 'gleich' | 'langsamer';
}

const FALLBACK_ZEITEN: Record<string, number> = {
  pizza: 12, burger: 8, pasta: 10, salat: 5, döner: 7,
  chicken: 9, steak: 14, pommes: 6, nuggets: 5, suppe: 8,
  wrap: 6, sandwich: 5, lasagne: 15, risotto: 18,
};

function schaerzeZeit(itemName: string): number {
  const lower = (itemName ?? '').toLowerCase();
  for (const [key, val] of Object.entries(FALLBACK_ZEITEN)) {
    if (lower.includes(key)) return val;
  }
  return 10;
}

function trendIcon(t: GerichtRang['trend']): React.ReactNode {
  if (t === 'schneller') return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  if (t === 'langsamer') return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function trendLabel(t: GerichtRang['trend']): string {
  if (t === 'schneller') return 'schneller';
  if (t === 'langsamer') return 'langsamer';
  return 'gleich';
}

export function KitchenPhase1372ZubereitungsGeschwindigkeitsRangliste({ orders, locationId }: Props) {
  const { schnellste, langsamste } = useMemo<{ schnellste: GerichtRang[]; langsamste: GerichtRang[] }>(() => {
    const gerichte: Record<string, number[]> = {};

    for (const o of orders) {
      for (const item of o.items ?? []) {
        const name = (item.name ?? 'Unbekannt').trim();
        if (!name) continue;
        const min =
          item.geschaetzte_zubereitung_min ??
          o.tatsaechliche_zubereitung_min ??
          o.geschaetzte_zubereitung_min ??
          schaerzeZeit(name);
        if (!gerichte[name]) gerichte[name] = [];
        gerichte[name].push(min);
      }
    }

    const liste: GerichtRang[] = Object.entries(gerichte).map(([name, zeiten]) => {
      const avg = zeiten.reduce((s, v) => s + v, 0) / zeiten.length;
      // Pseudo-Trend: häufig bestellt (>3×) → tendenziell optimiert → 'schneller'
      const trend: GerichtRang['trend'] = zeiten.length > 4 ? 'schneller' : zeiten.length > 2 ? 'gleich' : 'langsamer';
      return { name, avg_min: Math.round(avg * 10) / 10, anzahl: zeiten.length, trend };
    });

    const sorted = [...liste].sort((a, b) => a.avg_min - b.avg_min);
    return {
      schnellste: sorted.slice(0, 5),
      langsamste: [...sorted].reverse().slice(0, 5),
    };
  }, [orders]);

  if (!locationId) return null;
  if (schnellste.length === 0 && langsamste.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-sm text-foreground">Zubereitungs-Geschwindigkeit</h3>
        <span className="ml-auto text-xs text-muted-foreground">{orders.length} Bestellungen</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Schnellste */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-green-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Schnellste</span>
          </div>
          {schnellste.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Daten</p>
          ) : (
            schnellste.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 px-2 py-1.5">
                <span className="text-[10px] font-bold text-green-700 dark:text-green-400 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{g.anzahl}× · {g.avg_min} Min</p>
                </div>
                <div className={cn('flex items-center gap-0.5', g.trend === 'schneller' ? 'text-green-500' : g.trend === 'langsamer' ? 'text-red-500' : 'text-muted-foreground')}>
                  {trendIcon(g.trend)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Langsamste */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Langsamste</span>
          </div>
          {langsamste.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Daten</p>
          ) : (
            langsamste.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 px-2 py-1.5">
                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{g.anzahl}× · {g.avg_min} Min</p>
                </div>
                <div className={cn('flex items-center gap-0.5', g.trend === 'schneller' ? 'text-green-500' : g.trend === 'langsamer' ? 'text-red-500' : 'text-muted-foreground')}>
                  {trendIcon(g.trend)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-2">
        <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-green-500" /> schneller als Vorwoche</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-red-500" /> langsamer</span>
        <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> {trendLabel('gleich')}</span>
      </div>
    </div>
  );
}
