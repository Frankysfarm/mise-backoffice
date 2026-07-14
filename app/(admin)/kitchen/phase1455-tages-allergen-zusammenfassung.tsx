'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

// Phase 1455 — Tages-Allergen-Zusammenfassung (Kitchen)
// Aggregat aller heute bearbeiteten Allergene: Anzahl betroffener Bestellungen + häufigster Typ
// Props-basiert; nach Phase1450

const ALLERGEN_GRUPPEN: Record<string, string[]> = {
  Gluten:  ['Weizen', 'Dinkel', 'Roggen', 'Gerste', 'Hafer'],
  Nuss:    ['Erdnuss', 'Mandel', 'Cashew', 'Haselnuss', 'Walnuss'],
  Lactose: ['Milch', 'Butter', 'Käse', 'Sahne', 'Joghurt'],
  Ei:      ['Ei', 'Mayonnaise'],
  Fisch:   ['Lachs', 'Thunfisch', 'Scholle'],
};

const BADGE_FARBEN: Record<string, string> = {
  Gluten:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  Nuss:    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  Lactose: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  Ei:      'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  Fisch:   'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800',
};
const BADGE_DEFAULT = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

function allergenGruppe(name: string): string | null {
  const n = name.toLowerCase();
  for (const [gruppe, items] of Object.entries(ALLERGEN_GRUPPEN)) {
    if (items.some(i => n.includes(i.toLowerCase()))) return gruppe;
  }
  return null;
}

const HEUTE_START_OFFSET_MS = new Date().setHours(0, 0, 0, 0) - Date.now(); // negative

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

const HEUTE_STATUSES = new Set(['preparing', 'in_zubereitung', 'fertig', 'geliefert', 'delivered', 'confirmed', 'accepted', 'pending']);

export function KitchenPhase1455TagesAllergenZusammenfassung({ orders }: Props) {
  const { allergenMap, heuteBestellungen, haeufigsterAllergen, betroffeneBestellungen } = useMemo(() => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteStr = heute.toISOString().slice(0, 10);

    const heuteOrders = orders.filter(o => {
      if (!HEUTE_STATUSES.has(o.status ?? '')) return false;
      if (o.bestellt_am) return o.bestellt_am.startsWith(heuteStr);
      return true;
    });

    const allergenCount = new Map<string, number>(); // gruppe → Anzahl Bestellungen
    let betroffene = 0;

    for (const o of heuteOrders) {
      const gefunden = new Set<string>();
      if (o.kunde_allergen) {
        const g = allergenGruppe(o.kunde_allergen);
        if (g) gefunden.add(g);
      }
      for (const item of o.items ?? []) {
        const g = allergenGruppe(item.name ?? '') ?? allergenGruppe(item.allergen ?? '');
        if (g) gefunden.add(g);
      }
      if (gefunden.size > 0) betroffene++;
      for (const g of gefunden) allergenCount.set(g, (allergenCount.get(g) ?? 0) + 1);
    }

    const sorted = Array.from(allergenCount.entries()).sort((a, b) => b[1] - a[1]);
    const haeufigster = sorted[0]?.[0] ?? null;

    return {
      allergenMap: sorted,
      heuteBestellungen: heuteOrders.length,
      haeufigsterAllergen: haeufigster,
      betroffeneBestellungen: betroffene,
    };
  }, [orders]);

  if (heuteBestellungen === 0) return null;

  const betroffenProzent = heuteBestellungen > 0
    ? Math.round((betroffeneBestellungen / heuteBestellungen) * 100)
    : 0;

  const warnLevel: 'ok' | 'warn' | 'critical' =
    betroffenProzent >= 30 ? 'critical' : betroffenProzent >= 15 ? 'warn' : 'ok';

  const headerColor =
    warnLevel === 'critical' ? 'text-red-600 dark:text-red-400' :
    warnLevel === 'warn'     ? 'text-amber-600 dark:text-amber-400' :
                               'text-emerald-600 dark:text-emerald-400';

  const Icon = warnLevel === 'ok' ? ShieldCheck : AlertTriangle;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <Icon className={cn('w-4 h-4 shrink-0', headerColor)} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Tages-Allergen-Zusammenfassung
        </span>
        <span className="text-[10px] text-slate-400">{heuteBestellungen} Bestellungen heute</span>
      </div>

      {/* Kennzahlen */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100">{betroffeneBestellungen}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Betroffen</p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-black tabular-nums', headerColor)}>{betroffenProzent}%</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Anteil</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight mt-1">
            {haeufigsterAllergen ?? '–'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Häufigster</p>
        </div>
      </div>

      {/* Allergen-Badges */}
      {allergenMap.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {allergenMap.map(([gruppe, anzahl]) => (
            <span
              key={gruppe}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold',
                BADGE_FARBEN[gruppe] ?? BADGE_DEFAULT,
              )}
            >
              {gruppe}
              <span className="font-black">{anzahl}×</span>
            </span>
          ))}
        </div>
      )}

      {allergenMap.length === 0 && (
        <p className="px-4 pb-3 text-[11px] text-slate-400">Keine Allergen-Hinweise heute</p>
      )}
    </div>
  );
}
