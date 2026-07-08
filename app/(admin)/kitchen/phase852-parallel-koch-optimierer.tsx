'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GitMerge, Layers2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KitchenItem = { id: string; name: string; menge: number };
type KitchenOrder = {
  id: string;
  bestellnummer: string;
  items: KitchenItem[];
  geschaetzte_zubereitung_min?: number | null;
  bestellt_am?: string | null;
};

interface ParallelGroup {
  gemeinsame_items: string[];
  orders: KitchenOrder[];
  ersparnis_min: number; // geschätzte Zeitersparnis
}

function buildGroups(orders: KitchenOrder[]): ParallelGroup[] {
  const active = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung'].some(s => (o as { status?: string }).status === s || true)
  );
  if (active.length < 2) return [];

  // Item-Namen je Bestellung als Set
  const orderItems: Map<string, Set<string>> = new Map();
  for (const o of active) {
    orderItems.set(o.id, new Set(o.items.map(i => i.name)));
  }

  const groups: ParallelGroup[] = [];
  const grouped = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    if (grouped.has(active[i].id)) continue;
    const aItems = orderItems.get(active[i].id)!;
    const group: KitchenOrder[] = [active[i]];
    const gemeinsam: Set<string> = new Set(aItems);

    for (let j = i + 1; j < active.length; j++) {
      if (grouped.has(active[j].id)) continue;
      const bItems = orderItems.get(active[j].id)!;
      const intersection = [...aItems].filter(x => bItems.has(x));
      if (intersection.length > 0) {
        group.push(active[j]);
        grouped.add(active[j].id);
        // behalte nur gemeinsame Items
        for (const k of [...gemeinsam]) {
          if (!bItems.has(k)) gemeinsam.delete(k);
        }
      }
    }

    if (group.length >= 2 && gemeinsam.size > 0) {
      grouped.add(active[i].id);
      const avgPrep = group.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 10), 0) / group.length;
      groups.push({
        gemeinsame_items: [...gemeinsam],
        orders: group,
        ersparnis_min: Math.round((group.length - 1) * avgPrep * 0.4),
      });
    }
  }

  return groups.sort((a, b) => b.ersparnis_min - a.ersparnis_min);
}

export function KitchenPhase852ParallelKochOptimierer({ orders }: { orders: KitchenOrder[] }) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => buildGroups(orders), [orders]);

  if (groups.length === 0) return null;

  const totalErsparnis = groups.reduce((s, g) => s + g.ersparnis_min, 0);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Parallel-Koch-Optimierer</span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''} · ~{totalErsparnis} Min Ersparnis
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {groups.map((g, idx) => (
            <div key={idx} className="px-5 py-3 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <Layers2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                <span className="text-xs font-bold text-stone-700">
                  {g.orders.length} Bestellungen gleichzeitig
                </span>
                <span className={cn(
                  'ml-auto text-[10px] font-black rounded-full px-2 py-0.5',
                  g.ersparnis_min >= 10 ? 'bg-matcha-600 text-white' : 'bg-matcha-100 text-matcha-700',
                )}>
                  ~{g.ersparnis_min} Min gespart
                </span>
              </div>

              {/* Gemeinsame Artikel */}
              <div className="flex flex-wrap gap-1">
                {g.gemeinsame_items.map(item => (
                  <span
                    key={item}
                    className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                  >
                    {item}
                  </span>
                ))}
              </div>

              {/* Bestellungen */}
              <div className="flex flex-wrap gap-1.5">
                {g.orders.map(o => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px]"
                  >
                    <span className="font-bold text-stone-700">#{o.bestellnummer}</span>
                    <span className="text-stone-400 ml-1">
                      {o.items.length} Art.
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-muted-foreground">
                Gemeinsam kochen → Artikel einmal vorbereiten, mehrfach verwenden
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
