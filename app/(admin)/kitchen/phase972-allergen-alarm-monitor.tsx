'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Shield, ShieldAlert } from 'lucide-react';

/**
 * Phase 972 — Allergen-Alarm-Monitor (Kitchen)
 *
 * Warnt wenn mehrere Bestellungen mit gleichen Allergenen gleichzeitig in Zubereitung sind.
 * Kreuzkontaminations-Risiko-Erkennung. Client-seitig via useMemo.
 */

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  items?: Array<{ name?: string; title?: string }> | null;
  artikel?: Array<{ name?: string; title?: string }> | null;
  positionen?: Array<{ name?: string; title?: string }> | null;
  notes?: string | null;
  notizen?: string | null;
  allergens?: string[] | null;
}

interface Props {
  orders: Order[];
}

type Allergen = 'Gluten' | 'Laktose' | 'Nüsse' | 'Soja' | 'Ei' | 'Fisch' | 'Sellerie' | 'Senf';

interface AllergenAlarm {
  allergen: Allergen;
  betroffene_bestellungen: string[];
  risiko: 'hoch' | 'mittel';
}

const ACTIVE_STATUSES = [
  'in_zubereitung', 'zubereitung', 'in_preparation', 'preparing', 'in_kitchen',
];

const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  Gluten:   ['brot', 'pasta', 'nudel', 'mehl', 'weizen', 'gluten', 'brötchen', 'pizza', 'kuchen', 'semmel'],
  Laktose:  ['butter', 'sahne', 'käse', 'milch', 'quark', 'joghurt', 'laktose', 'cream', 'parmesan', 'mozzarella'],
  Nüsse:    ['nuss', 'mandel', 'cashew', 'walnuss', 'erdnuss', 'pistazie', 'nüsse', 'haselnuss'],
  Soja:     ['soja', 'tofu', 'sojasoße', 'edamame', 'miso'],
  Ei:       ['ei', 'eier', 'mayo', 'mayonnaise', 'omelette', 'rührei'],
  Fisch:    ['fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'dorsch', 'sushi', 'meeresfrüchte'],
  Sellerie: ['sellerie', 'celeriac', 'suppenwürze', 'würzmischung'],
  Senf:     ['senf', 'mustard', 'currywurst'],
};

function getItemTexts(order: Order): string[] {
  const arr = order.items ?? order.artikel ?? order.positionen ?? [];
  const texts: string[] = arr.map((i: { name?: string; title?: string }) => (i.name ?? i.title ?? '').toLowerCase());
  if (order.notes) texts.push(order.notes.toLowerCase());
  if (order.notizen) texts.push(order.notizen.toLowerCase());
  return texts;
}

function detectAllergens(order: Order): Set<Allergen> {
  const texts = getItemTexts(order);
  const found = new Set<Allergen>();
  // Also check explicit allergens field
  if (order.allergens?.length) {
    for (const a of order.allergens) {
      const al = a as Allergen;
      if (al in ALLERGEN_KEYWORDS) found.add(al);
    }
  }
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS) as [Allergen, string[]][]) {
    if (texts.some(t => keywords.some(kw => t.includes(kw)))) {
      found.add(allergen);
    }
  }
  return found;
}

const ALLERGEN_ICONS: Record<Allergen, string> = {
  Gluten: '🌾', Laktose: '🥛', Nüsse: '🥜', Soja: '🫘',
  Ei: '🥚', Fisch: '🐟', Sellerie: '🥬', Senf: '🌻',
};

export function KitchenPhase972AllergenAlarmMonitor({ orders }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const alarme = useMemo<AllergenAlarm[]>(() => {
    const active = orders.filter(o => ACTIVE_STATUSES.includes((o.status ?? '').toLowerCase()));
    const allergenMap = new Map<Allergen, string[]>();

    for (const order of active) {
      const found = detectAllergens(order);
      const nr = order.bestellnummer ?? order.id.slice(0, 6);
      for (const al of found) {
        if (!allergenMap.has(al)) allergenMap.set(al, []);
        allergenMap.get(al)!.push(`#${nr}`);
      }
    }

    const result: AllergenAlarm[] = [];
    for (const [allergen, bestellungen] of allergenMap) {
      if (bestellungen.length >= 2) {
        result.push({
          allergen,
          betroffene_bestellungen: bestellungen,
          risiko: bestellungen.length >= 3 ? 'hoch' : 'mittel',
        });
      }
    }
    return result.sort((a, b) => (a.risiko === 'hoch' ? -1 : 1) - (b.risiko === 'hoch' ? -1 : 1));
  }, [orders]);

  const hochCount = alarme.filter(a => a.risiko === 'hoch').length;

  if (alarme.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/40">
        <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          <Shield className="h-4 w-4 text-matcha-500" />
          <span>Allergen-Monitor: Kein Kreuzkontaminations-Risiko erkannt</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-800/40 dark:bg-stone-900">
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
        type="button"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn('h-5 w-5', hochCount > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500')} />
          <span className="font-semibold text-stone-800 dark:text-stone-100 text-sm">
            Allergen-Alarm-Monitor
          </span>
          {hochCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {hochCount} Hohes Risiko
            </span>
          )}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {alarme.length} Alarm{alarme.length !== 1 ? 'e' : ''}
          </span>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronUp className="h-4 w-4 text-stone-400" />}
      </button>

      {!collapsed && (
        <div className="border-t border-stone-100 px-4 pb-4 pt-3 dark:border-stone-800 space-y-2">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
            Mehrere aktive Bestellungen enthalten dasselbe Allergen — Kreuzkontaminationsrisiko!
          </p>
          {alarme.map(alarm => (
            <div
              key={alarm.allergen}
              className={cn(
                'flex items-start justify-between rounded-lg border px-3 py-2.5',
                alarm.risiko === 'hoch'
                  ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20'
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{ALLERGEN_ICONS[alarm.allergen]}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-stone-800 dark:text-stone-100">
                      {alarm.allergen}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        alarm.risiko === 'hoch'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      )}
                    >
                      {alarm.risiko === 'hoch' ? 'Hohes Risiko' : 'Mittel'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    {alarm.betroffene_bestellungen.join(' · ')} gleichzeitig aktiv
                  </p>
                </div>
              </div>
              <AlertTriangle
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  alarm.risiko === 'hoch' ? 'text-red-500' : 'text-amber-500'
                )}
              />
            </div>
          ))}
          <p className="text-[10px] text-stone-400 dark:text-stone-500 pt-1">
            Getrennte Arbeitsflächen + Utensilien verwenden
          </p>
        </div>
      )}
    </div>
  );
}
