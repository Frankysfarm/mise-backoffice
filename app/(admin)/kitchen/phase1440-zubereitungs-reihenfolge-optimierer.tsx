'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, AlertTriangle, ChefHat, ShieldAlert } from 'lucide-react';

// Phase 1440 — Zubereitungs-Reihenfolge-Optimierer (Kitchen)
// Optimale Reihenfolge aktiver Bestellungen nach ETA-Frist + Allergen-Sicherheitsabstand

const ALLERGEN_GRUPPEN: Record<string, string[]> = {
  Gluten:    ['Weizen', 'Dinkel', 'Roggen', 'Gerste', 'Hafer'],
  Nuss:      ['Erdnuss', 'Mandel', 'Cashew', 'Haselnuss', 'Walnuss'],
  Lactose:   ['Milch', 'Butter', 'Käse', 'Sahne', 'Joghurt'],
  Ei:        ['Ei', 'Mayonnaise'],
  Fisch:     ['Lachs', 'Thunfisch', 'Scholle'],
};

function allergenGruppe(name: string): string | null {
  const n = name.toLowerCase();
  for (const [gruppe, items] of Object.entries(ALLERGEN_GRUPPEN)) {
    if (items.some(i => n.includes(i.toLowerCase()))) return gruppe;
  }
  return null;
}

interface OrderItem {
  name?: string | null;
  menge?: number | null;
}

interface Order {
  id: string;
  status?: string | null;
  eta?: string | null;
  geschaetzte_lieferzeit_min?: number | null;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
  kunde_name?: string | null;
  kunde_allergen?: string | null;
  zone?: string | null;
}

interface Props {
  orders: Order[];
}

interface ReihenfolgeEintrag {
  order: Order;
  rank: number;
  etaMinuten: number | null;
  dringlichkeit: 'kritisch' | 'hoch' | 'normal';
  allergenWarnung: string | null;
  konfliktMitVorherigemAllergen: boolean;
}

function etaMinutenBerechnen(o: Order): number | null {
  if (o.eta) {
    const diff = Math.round((new Date(o.eta).getTime() - Date.now()) / 60_000);
    return diff;
  }
  if (o.bestellt_am && o.geschaetzte_lieferzeit_min) {
    const ankunft = new Date(o.bestellt_am).getTime() + o.geschaetzte_lieferzeit_min * 60_000;
    return Math.round((ankunft - Date.now()) / 60_000);
  }
  return null;
}

function dringlichkeitStufe(min: number | null): ReihenfolgeEintrag['dringlichkeit'] {
  if (min === null) return 'normal';
  if (min <= 10) return 'kritisch';
  if (min <= 20) return 'hoch';
  return 'normal';
}

function allergenAusBestellung(o: Order): string | null {
  if (o.kunde_allergen) return o.kunde_allergen;
  for (const item of o.items ?? []) {
    const g = allergenGruppe(item.name ?? '');
    if (g) return g;
  }
  return null;
}

export function KitchenPhase1440ZubereitungsReihenfolgeOptimierer({ orders }: Props) {
  const reihenfolge = useMemo<ReihenfolgeEintrag[]>(() => {
    const aktiv = orders.filter(
      o => o.status && ['in_zubereitung', 'angenommen', 'neu'].includes(o.status),
    );

    const mitEta = aktiv.map(o => ({
      order: o,
      etaMinuten: etaMinutenBerechnen(o),
      allergen: allergenAusBestellung(o),
    }));

    // Sortierung: zuerst kritisch (eta ≤10), dann nach aufsteigendem ETA
    mitEta.sort((a, b) => {
      const aMin = a.etaMinuten ?? 999;
      const bMin = b.etaMinuten ?? 999;
      return aMin - bMin;
    });

    // Allergen-Konflikterkennung: gleiche Gruppe wie vorheriger Auftrag = Warnung
    const result: ReihenfolgeEintrag[] = [];
    let vorherigesAllergen: string | null = null;

    mitEta.forEach((entry, idx) => {
      const konflikt = entry.allergen !== null && entry.allergen === vorherigesAllergen;
      result.push({
        order: entry.order,
        rank: idx + 1,
        etaMinuten: entry.etaMinuten,
        dringlichkeit: dringlichkeitStufe(entry.etaMinuten),
        allergenWarnung: entry.allergen,
        konfliktMitVorherigemAllergen: konflikt,
      });
      vorherigesAllergen = entry.allergen;
    });

    return result;
  }, [orders]);

  if (reihenfolge.length === 0) return null;

  const dringlichkeitStyle: Record<ReihenfolgeEintrag['dringlichkeit'], string> = {
    kritisch: 'border-red-400 bg-red-50 dark:bg-red-950/30',
    hoch:     'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
    normal:   'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700',
  };

  const rankStyle: Record<ReihenfolgeEintrag['dringlichkeit'], string> = {
    kritisch: 'bg-red-500 text-white',
    hoch:     'bg-amber-500 text-white',
    normal:   'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ChefHat className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reihenfolge-Optimierer</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{reihenfolge.length} aktive Bestellungen</span>
      </div>

      <div className="space-y-2">
        {reihenfolge.map(entry => (
          <div
            key={entry.order.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3 py-2',
              dringlichkeitStyle[entry.dringlichkeit],
            )}
          >
            {/* Rang */}
            <div className={cn('shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black', rankStyle[entry.dringlichkeit])}>
              {entry.rank}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {entry.order.kunde_name ?? `Bestellung ${entry.order.id.slice(0, 6)}`}
                </span>
                {entry.order.zone && (
                  <span className="text-[10px] font-bold bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-1.5 py-0.5 rounded-full">
                    Zone {entry.order.zone}
                  </span>
                )}
                {entry.dringlichkeit === 'kritisch' && (
                  <span className="text-[10px] font-black text-red-600 dark:text-red-400 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> SOFORT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                {entry.etaMinuten !== null && (
                  <span className={cn('flex items-center gap-0.5 font-mono font-semibold', entry.dringlichkeit === 'kritisch' ? 'text-red-600 dark:text-red-400' : entry.dringlichkeit === 'hoch' ? 'text-amber-600 dark:text-amber-400' : '')}>
                    <AlarmClock className="w-3 h-3" />
                    {entry.etaMinuten <= 0 ? 'Überfällig!' : `${entry.etaMinuten} Min`}
                  </span>
                )}
                {entry.order.items && entry.order.items.length > 0 && (
                  <span className="truncate">{entry.order.items.slice(0, 2).map(i => i.name).filter(Boolean).join(', ')}{entry.order.items.length > 2 ? ` +${entry.order.items.length - 2}` : ''}</span>
                )}
              </div>
              {entry.konfliktMitVorherigemAllergen && (
                <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                  <ShieldAlert className="w-3 h-3" />
                  Allergen-Sicherheitsabstand empfohlen ({entry.allergenWarnung})
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Reihenfolge nach ETA-Frist optimiert. Allergen-Konflikte markiert.
      </p>
    </div>
  );
}
