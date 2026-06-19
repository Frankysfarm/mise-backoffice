'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Flame, UtensilsCrossed, Leaf, Fish, Pizza, Sandwich, Coffee } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Item = {
  id: string;
  name: string;
  menge: number;
};

type Order = {
  id: string;
  status: string;
  items: Item[];
};

interface Props {
  orders: Order[];
}

type KategorieKey = 'burger' | 'pizza' | 'pasta' | 'salat' | 'fisch' | 'getraenk' | 'dessert' | 'sonstiges';

const KATEGORIE_PATTERNS: { key: KategorieKey; pattern: RegExp; label: string; farbe: string; icon: React.ElementType }[] = [
  { key: 'burger', pattern: /burger|wrap|sandwich|pulled|bun/i, label: 'Burger & Wraps', farbe: 'bg-orange-500', icon: Sandwich },
  { key: 'pizza', pattern: /pizza|flammkuchen|calzone/i, label: 'Pizza', farbe: 'bg-red-500', icon: Pizza },
  { key: 'pasta', pattern: /pasta|nudel|spaghetti|penne|lasagne|risotto/i, label: 'Pasta & Risotto', farbe: 'bg-yellow-500', icon: UtensilsCrossed },
  { key: 'salat', pattern: /salat|bowl|vegan|vegetar|quinoa/i, label: 'Salate & Bowls', farbe: 'bg-matcha-500', icon: Leaf },
  { key: 'fisch', pattern: /fisch|lachs|thunfisch|garnele|shrimp|sushi/i, label: 'Fisch & Meeresfrüchte', farbe: 'bg-blue-500', icon: Fish },
  { key: 'getraenk', pattern: /kaffee|getränk|latte|espresso|tee|smoothie|saft|cola|wasser/i, label: 'Getränke', farbe: 'bg-cyan-500', icon: Coffee },
];

function detectKategorie(name: string): KategorieKey {
  for (const k of KATEGORIE_PATTERNS) {
    if (k.pattern.test(name)) return k.key;
  }
  return 'sonstiges';
}

export function KitchenKategorieAuslastung({ orders }: Props) {
  const inZubereitung = orders.filter(o => o.status === 'in_zubereitung');

  const kategorien = useMemo(() => {
    const map = new Map<KategorieKey, number>();
    for (const o of inZubereitung) {
      for (const item of o.items) {
        const kat = detectKategorie(item.name);
        map.set(kat, (map.get(kat) ?? 0) + item.menge);
      }
    }
    return map;
  }, [inZubereitung]);

  if (inZubereitung.length === 0) return null;

  const total = Array.from(kategorien.values()).reduce((a, b) => a + b, 0);

  const entries = [
    ...KATEGORIE_PATTERNS.filter(k => (kategorien.get(k.key) ?? 0) > 0).map(k => ({
      ...k,
      count: kategorien.get(k.key) ?? 0,
    })),
    ...(kategorien.get('sonstiges') ?? 0) > 0
      ? [{ key: 'sonstiges' as KategorieKey, label: 'Sonstiges', farbe: 'bg-gray-400', icon: Flame, count: kategorien.get('sonstiges') ?? 0 }]
      : [],
  ].sort((a, b) => b.count - a.count);

  const maxCount = entries[0]?.count ?? 1;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-orange-50">
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-orange-800">
          Stations-Auslastung
        </span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-bold">
          {total} Artikel · {inZubereitung.length} Bestellungen
        </span>
      </div>

      <div className="p-3 space-y-2">
        {entries.map(({ key, label, farbe, icon: Icon, count }) => {
          const pct = Math.round((count / maxCount) * 100);
          const isHot = count >= 4 || pct === 100;
          return (
            <div key={key} className="flex items-center gap-2.5">
              <div className={cn(
                'h-6 w-6 rounded-lg flex items-center justify-center shrink-0',
                farbe,
              )}>
                <Icon size={12} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-foreground truncate">{label}</span>
                  <span className={cn(
                    'text-[11px] font-black tabular-nums shrink-0 ml-2',
                    isHot ? 'text-red-600' : 'text-muted-foreground',
                  )}>
                    {count}×
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', farbe)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {isHot && (
                <span className="shrink-0 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-black animate-pulse">
                  Hoch
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t bg-muted/20 text-[9px] text-muted-foreground">
        Nur Bestellungen in Zubereitung · wird automatisch aktualisiert
      </div>
    </Card>
  );
}
