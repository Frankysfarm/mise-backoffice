'use client';

import { useMemo } from 'react';
import { AlertTriangle, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1352 — Allergen-Statistik-Woche (Kitchen)
 *
 * Wie oft welche Hochrisiko-Allergene in letzten 7 Tagen aufgetreten.
 * Balkendiagramm-Widget; Props-basiert (aus Bestellhistorie); useMemo.
 * Nach Phase1330 in kitchen/client.tsx.
 */

const ALLERGENE = ['Nüsse', 'Schalentiere', 'Gluten', 'Laktose', 'Ei', 'Fisch', 'Sesam', 'Senf'] as const;
type AllergenName = (typeof ALLERGENE)[number];

const ALLERGEN_KEYS: Record<AllergenName, string[]> = {
  Nüsse:       ['nüsse', 'nuss', 'erdnuss', 'haselnuss', 'walnuss', 'cashew', 'mandel'],
  Schalentiere:['schalentiere', 'garnelen', 'krabben', 'hummer', 'muscheln', 'tintenfisch'],
  Gluten:      ['gluten', 'weizen', 'roggen', 'gerste', 'dinkel'],
  Laktose:     ['laktose', 'milch', 'butter', 'sahne', 'käse', 'joghurt'],
  Ei:          ['ei', 'eier', 'eigelb', 'eiweiß'],
  Fisch:       ['fisch', 'lachs', 'thunfisch', 'kabeljau', 'forelle'],
  Sesam:       ['sesam'],
  Senf:        ['senf'],
};

const COLORS: Record<AllergenName, string> = {
  Nüsse:       'bg-amber-500',
  Schalentiere:'bg-red-500',
  Gluten:      'bg-orange-400',
  Laktose:     'bg-blue-400',
  Ei:          'bg-yellow-400',
  Fisch:       'bg-cyan-500',
  Sesam:       'bg-purple-400',
  Senf:        'bg-lime-500',
};

interface Order {
  id: string;
  created_at?: string | null;
  items?: Array<{ allergens?: string[]; allergene?: string[] }> | null;
  positionen?: Array<{ allergens?: string[]; allergene?: string[] }> | null;
  sonderwunsch?: string | null;
  hinweise?: string | null;
  allergen_hinweis?: string | null;
}

interface Props {
  orders: Order[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function KitchenPhase1352AllergenStatistikWoche({ orders }: Props) {
  const stats = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = orders.filter(o => {
      if (!o.created_at) return true;
      return new Date(o.created_at).getTime() >= cutoff;
    });

    const counts = Object.fromEntries(ALLERGENE.map(a => [a, 0])) as Record<AllergenName, number>;

    for (const order of recent) {
      const allText = [
        order.sonderwunsch ?? '',
        order.hinweise ?? '',
        order.allergen_hinweis ?? '',
        ...(order.items ?? []).flatMap(i => [...(i.allergens ?? []), ...(i.allergene ?? [])]),
        ...(order.positionen ?? []).flatMap(i => [...(i.allergens ?? []), ...(i.allergene ?? [])]),
      ].join(' ').toLowerCase();

      for (const allergen of ALLERGENE) {
        if (ALLERGEN_KEYS[allergen].some(k => allText.includes(k))) {
          counts[allergen]++;
        }
      }
    }

    const sorted = ALLERGENE
      .map(name => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count);

    const max = Math.max(1, ...sorted.map(s => s.count));
    return { sorted, max, total: recent.length };
  }, [orders]);

  const hasAny = stats.sorted.some(s => s.count > 0);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Allergen-Statistik (7 Tage)</span>
        <span className="ml-auto text-xs text-muted-foreground">{stats.total} Bestellungen</span>
      </div>

      {!hasAny ? (
        <p className="text-xs text-muted-foreground">Keine Allergen-Meldungen in den letzten 7 Tagen.</p>
      ) : (
        <div className="space-y-2">
          {stats.sorted.map(({ name, count }) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] font-medium text-foreground">{name}</span>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', COLORS[name as AllergenName])}
                  style={{ width: `${(count / stats.max) * 100}%` }}
                />
              </div>
              <span className={cn(
                'w-8 shrink-0 text-right text-[11px] font-bold tabular-nums',
                count === 0 ? 'text-muted-foreground' : count >= 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
              )}>
                {count}×
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 pt-1">
        <BarChart2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Nur Bestellungen der letzten 7 Tage</span>
      </div>
    </div>
  );
}
