'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1204 — Bestellungs-Komplexitäts-Heatmap (Kitchen)
// Welche Stunde des Tages erzeugt die komplexesten Bestellungen
// Score = Artikelanzahl × (1 + Allergen-Anzahl)

interface OrderItem {
  name?: string;
  quantity?: number;
  allergens?: string[];
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: OrderItem[] | null;
}

interface Props { orders: Order[] }

type StundenBucket = {
  stunde: number;
  label: string;
  avg_score: number;
  count: number;
  level: 'niedrig' | 'mittel' | 'hoch' | 'peak';
};

const ALLERGEN_KEYWORDS = ['nuss', 'gluten', 'laktose', 'ei', 'soja', 'fisch', 'sellerie', 'senf', 'sesam', 'lupine'];

function extractAllergenCount(item: OrderItem): number {
  const allergens = item.allergens ?? [];
  if (allergens.length > 0) return allergens.length;
  const name = (item.name ?? '').toLowerCase();
  return ALLERGEN_KEYWORDS.filter(k => name.includes(k)).length;
}

function computeScore(order: Order): number {
  const items = order.items ?? [];
  if (items.length === 0) return 1;
  return items.reduce((sum, item) => {
    const qty = item.quantity ?? 1;
    const allergens = extractAllergenCount(item);
    return sum + qty * (1 + allergens);
  }, 0);
}

function levelFromScore(score: number): StundenBucket['level'] {
  if (score < 3) return 'niedrig';
  if (score < 6) return 'mittel';
  if (score < 10) return 'hoch';
  return 'peak';
}

const LEVEL_STYLES: Record<StundenBucket['level'], { bg: string; text: string; bar: string }> = {
  niedrig: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  mittel:  { bg: 'bg-amber-100 dark:bg-amber-950/40',   text: 'text-amber-700 dark:text-amber-300',   bar: 'bg-amber-500' },
  hoch:    { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
  peak:    { bg: 'bg-rose-100 dark:bg-rose-950/40',     text: 'text-rose-700 dark:text-rose-300',     bar: 'bg-rose-500' },
};

function computeBuckets(orders: Order[]): StundenBucket[] {
  const map = new Map<number, { total: number; count: number }>();

  for (const order of orders) {
    if (!order.created_at) continue;
    const h = new Date(order.created_at).getHours();
    const score = computeScore(order);
    const prev = map.get(h) ?? { total: 0, count: 0 };
    map.set(h, { total: prev.total + score, count: prev.count + 1 });
  }

  if (map.size === 0) return [];

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([h, { total, count }]) => {
      const avg = parseFloat((total / count).toFixed(1));
      return {
        stunde: h,
        label: `${String(h).padStart(2, '0')}:00`,
        avg_score: avg,
        count,
        level: levelFromScore(avg),
      };
    });
}

export function KitchenPhase1204BestellungsKomplexitaetsHeatmap({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const buckets = useMemo(() => computeBuckets(orders), [orders]);

  if (buckets.length === 0) return null;

  const maxScore = Math.max(...buckets.map(b => b.avg_score), 1);
  const peakBucket = buckets.reduce((a, b) => (b.avg_score > a.avg_score ? b : a), buckets[0]);
  const peakStyle = LEVEL_STYLES[peakBucket.level];

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', peakStyle.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className={cn('h-4 w-4 shrink-0', peakStyle.text)} />
          <span className={cn('font-bold text-sm', peakStyle.text)}>Bestellungs-Komplexitäts-Heatmap</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2 py-0.5">
            Peak: {peakBucket.label}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[10px] text-muted-foreground mb-3">
            Score = Artikel × (1 + Allergene). Je höher, desto aufwendiger die Zubereitung.
          </p>
          <div className="space-y-1.5">
            {buckets.map(b => {
              const s = LEVEL_STYLES[b.level];
              const barPct = Math.round((b.avg_score / maxScore) * 100);
              return (
                <div key={b.stunde} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] font-mono text-muted-foreground">{b.label}</span>
                  <div className="flex-1 h-5 rounded bg-black/5 dark:bg-white/5 overflow-hidden">
                    <div
                      className={cn('h-full rounded transition-all', s.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className={cn('w-16 shrink-0 text-right text-[11px] font-bold tabular-nums', s.text)}>
                    Ø {b.avg_score}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                    {b.count} Bst.
                  </span>
                  <span className={cn('w-14 shrink-0 text-right text-[10px] font-semibold capitalize', s.text)}>
                    {b.level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
