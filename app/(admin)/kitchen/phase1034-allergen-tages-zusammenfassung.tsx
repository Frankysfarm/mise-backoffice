'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1034 — Allergen-Tages-Zusammenfassung (Kitchen)
 *
 * Welche Allergene traten heute am häufigsten auf, mit Trend vs. Vorwoche.
 * Rein client-seitig basierend auf aktiven Bestellungen (item.name keyword matching).
 */

interface Item {
  name?: string;
  title?: string;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}

interface Props {
  orders: Order[];
}

interface Allergen {
  key: string;
  label: string;
  emoji: string;
  keywords: string[];
}

const ALLERGENE: Allergen[] = [
  { key: 'gluten',    label: 'Gluten',       emoji: '🌾', keywords: ['brot', 'brötchen', 'burger', 'schnitzel', 'pasta', 'nudel', 'pizza', 'wrap', 'paniert', 'mehl'] },
  { key: 'laktose',   label: 'Laktose',      emoji: '🥛', keywords: ['käse', 'sahne', 'butter', 'milch', 'joghurt', 'creme', 'cream', 'quark', 'mozarella', 'parmesan'] },
  { key: 'nüsse',     label: 'Nüsse',        emoji: '🥜', keywords: ['nuss', 'mandel', 'cashew', 'walnuss', 'erdnuss', 'pesto', 'tahini', 'sesam'] },
  { key: 'ei',        label: 'Ei',           emoji: '🥚', keywords: ['ei', 'mayonnaise', 'mayo', 'omelette', 'rührei', 'spiegelei', 'frittata'] },
  { key: 'fisch',     label: 'Fisch/Meeresf.', emoji: '🐟', keywords: ['fisch', 'lachs', 'thunfisch', 'shrimp', 'garnele', 'crevette', 'sushi', 'calamari'] },
  { key: 'sellerie',  label: 'Sellerie',     emoji: '🌿', keywords: ['sellerie', 'suppe', 'brühe', 'eintopf'] },
  { key: 'soja',      label: 'Soja',         emoji: '🫘', keywords: ['soja', 'tofu', 'edamame', 'miso', 'teriyaki', 'vegan'] },
];

interface AllergenCount {
  allergen: Allergen;
  heuteCount: number;
  vorwocheCount: number;
  trend: 'steigend' | 'fallend' | 'gleich';
  pct_of_peak: number;
}

const TODAY_HOURS_START = new Date();
TODAY_HOURS_START.setHours(0, 0, 0, 0);

const WEEK_AGO = new Date(TODAY_HOURS_START.getTime() - 7 * 24 * 3600_000);
const WEEK_AGO_END = new Date(WEEK_AGO.getTime() + 24 * 3600_000);

function matchesAllergen(itemName: string, allergen: Allergen): boolean {
  const low = itemName.toLowerCase();
  return allergen.keywords.some(kw => low.includes(kw));
}

export function KitchenPhase1034AllergenTagesZusammenfassung({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const counts: AllergenCount[] = useMemo(() => {
    const todayOrders = orders.filter(o => {
      if (!o.created_at) return true;
      return new Date(o.created_at) >= TODAY_HOURS_START;
    });
    const vorwocheOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      return d >= WEEK_AGO && d < WEEK_AGO_END;
    });

    function countForOrders(subset: Order[], allergen: Allergen): number {
      let count = 0;
      for (const o of subset) {
        for (const item of o.items ?? []) {
          if (matchesAllergen(item.name ?? item.title ?? '', allergen)) {
            count++;
            break;
          }
        }
      }
      return count;
    }

    const raw = ALLERGENE.map(a => ({
      allergen: a,
      heuteCount: countForOrders(todayOrders, a),
      vorwocheCount: countForOrders(vorwocheOrders, a),
    }));

    const peak = Math.max(...raw.map(r => r.heuteCount), 1);

    return raw
      .map(r => ({
        ...r,
        trend: r.heuteCount > r.vorwocheCount + 1
          ? 'steigend' as const
          : r.heuteCount < r.vorwocheCount - 1
          ? 'fallend' as const
          : 'gleich' as const,
        pct_of_peak: Math.round((r.heuteCount / peak) * 100),
      }))
      .sort((a, b) => b.heuteCount - a.heuteCount);
  }, [orders]);

  const topAllergen = counts[0];
  const warningCount = counts.filter(c => c.trend === 'steigend' && c.heuteCount > 0).length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold">Allergen-Tages-Übersicht</span>
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 border border-amber-300">
              <TrendingUp className="h-2.5 w-2.5" />
              {warningCount} steigend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {topAllergen && topAllergen.heuteCount > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-medium">
              Top-Allergen heute: <span className="font-black">{topAllergen.allergen.emoji} {topAllergen.allergen.label}</span>
              {' '}— {topAllergen.heuteCount}× in Bestellungen
            </div>
          )}

          <div className="space-y-1.5">
            {counts.map(({ allergen, heuteCount, vorwocheCount, trend, pct_of_peak }) => {
              const barColor =
                pct_of_peak >= 80 ? 'bg-red-500' :
                pct_of_peak >= 50 ? 'bg-amber-400' :
                'bg-matcha-500';

              const TrendIcon = trend === 'steigend' ? TrendingUp : trend === 'fallend' ? TrendingDown : Minus;
              const trendColor = trend === 'steigend' ? 'text-red-500' : trend === 'fallend' ? 'text-matcha-500' : 'text-muted-foreground';

              return (
                <div key={allergen.key} className="flex items-center gap-2">
                  <span className="text-base w-6 shrink-0 text-center">{allergen.emoji}</span>
                  <span className="text-xs w-24 shrink-0 text-muted-foreground truncate">{allergen.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor)}
                      style={{ width: `${pct_of_peak}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black tabular-nums w-5 text-right shrink-0">{heuteCount}</span>
                  <TrendIcon className={cn('h-3 w-3 shrink-0', trendColor)} />
                  <span className="text-[9px] tabular-nums text-muted-foreground w-8 shrink-0 text-right">vW:{vorwocheCount}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Keyword-Matching · Vergleich mit Vorwoche-Gleichzeit
          </p>
        </div>
      )}
    </div>
  );
}
