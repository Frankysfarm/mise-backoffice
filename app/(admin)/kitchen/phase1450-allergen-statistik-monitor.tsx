'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ShieldAlert, ChevronRight } from 'lucide-react';

// Phase 1450 — Allergen-Statistik-Monitor (Kitchen)
// Top-5 Allergene aus aktiver Queue; Props-basiert aus orders; nach Phase1445

const ALLERGEN_GRUPPEN: Record<string, string[]> = {
  Gluten:  ['Weizen', 'Dinkel', 'Roggen', 'Gerste', 'Hafer'],
  Nuss:    ['Erdnuss', 'Mandel', 'Cashew', 'Haselnuss', 'Walnuss'],
  Lactose: ['Milch', 'Butter', 'Käse', 'Sahne', 'Joghurt'],
  Ei:      ['Ei', 'Mayonnaise'],
  Fisch:   ['Lachs', 'Thunfisch', 'Scholle'],
};

const ALLERGEN_FARBEN: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  Gluten:  { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', bar: 'bg-amber-400 dark:bg-amber-500' },
  Nuss:    { bg: 'bg-red-50 dark:bg-red-950/30',    text: 'text-red-700 dark:text-red-300',    border: 'border-red-200 dark:border-red-800',    bar: 'bg-red-400 dark:bg-red-500' },
  Lactose: { bg: 'bg-blue-50 dark:bg-blue-950/30',  text: 'text-blue-700 dark:text-blue-300',  border: 'border-blue-200 dark:border-blue-800',  bar: 'bg-blue-400 dark:bg-blue-500' },
  Ei:      { bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800', bar: 'bg-yellow-400 dark:bg-yellow-500' },
  Fisch:   { bg: 'bg-cyan-50 dark:bg-cyan-950/30',  text: 'text-cyan-700 dark:text-cyan-300',  border: 'border-cyan-200 dark:border-cyan-800',  bar: 'bg-cyan-400 dark:bg-cyan-500' },
};

const DEFAULT_FARBE = { bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', bar: 'bg-slate-400 dark:bg-slate-500' };

const AKTIVE_STATUSES = new Set(['pending', 'preparing', 'in_zubereitung', 'fertig', 'confirmed', 'accepted']);

interface OrderItem {
  name?: string | null;
  allergen?: string | null;
}

interface Order {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
  kunde_allergen?: string | null;
}

interface Props {
  orders: Order[];
}

interface AllergenEintrag {
  gruppe: string;
  anzahlBestellungen: number;
  prozent: number;
}

function allergenGruppe(name: string): string | null {
  const n = name.toLowerCase();
  for (const [gruppe, items] of Object.entries(ALLERGEN_GRUPPEN)) {
    if (items.some(i => n.includes(i.toLowerCase()))) return gruppe;
  }
  return null;
}

const ZWEI_STUNDEN_MS = 2 * 60 * 60 * 1000;

export function KitchenPhase1450AllergenStatistikMonitor({ orders }: Props) {
  const { top5, gesamtBestellungen } = useMemo(() => {
    const jetzt = Date.now();
    const aktiv = orders.filter(o => {
      if (!AKTIVE_STATUSES.has(o.status ?? '')) return false;
      if (o.bestellt_am) {
        return jetzt - new Date(o.bestellt_am).getTime() <= ZWEI_STUNDEN_MS;
      }
      return true;
    });

    const allergenCount = new Map<string, number>();

    for (const o of aktiv) {
      const gefunden = new Set<string>();

      // Aus Kunden-Allergen-Feld
      if (o.kunde_allergen) {
        const g = allergenGruppe(o.kunde_allergen);
        if (g) gefunden.add(g);
      }

      // Aus Artikel-Namen
      for (const item of o.items ?? []) {
        const g = allergenGruppe(item.name ?? '') ?? allergenGruppe(item.allergen ?? '');
        if (g) gefunden.add(g);
      }

      for (const g of gefunden) {
        allergenCount.set(g, (allergenCount.get(g) ?? 0) + 1);
      }
    }

    const sorted = Array.from(allergenCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxAnzahl = sorted[0]?.[1] ?? 1;

    const top5: AllergenEintrag[] = sorted.map(([gruppe, anzahl]) => ({
      gruppe,
      anzahlBestellungen: anzahl,
      prozent: Math.round((anzahl / maxAnzahl) * 100),
    }));

    return { top5, gesamtBestellungen: aktiv.length };
  }, [orders]);

  if (top5.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Allergen-Monitor (aktive Queue)
        </span>
        <span className="text-[10px] text-slate-400">{gesamtBestellungen} Bestellungen</span>
      </div>

      {/* Top-5-Liste */}
      <div className="px-4 py-3 space-y-2.5">
        {top5.map((eintrag, i) => {
          const farbe = ALLERGEN_FARBEN[eintrag.gruppe] ?? DEFAULT_FARBE;
          return (
            <div key={eintrag.gruppe} className={cn('rounded-lg border px-3 py-2', farbe.bg, farbe.border)}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black tabular-nums text-slate-400 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span className={cn('text-sm font-semibold flex-1', farbe.text)}>
                  {eintrag.gruppe}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn('text-xs font-black tabular-nums', farbe.text)}>
                    {eintrag.anzahlBestellungen}×
                  </span>
                  <ChevronRight className={cn('w-3 h-3', farbe.text)} />
                  <span className="text-[10px] text-slate-400">{eintrag.prozent}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', farbe.bar)}
                  style={{ width: `${eintrag.prozent}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-slate-400 text-center pt-1">
          Erkannte Allergene: Gluten · Nuss · Lactose · Ei · Fisch
        </p>
      </div>
    </div>
  );
}
