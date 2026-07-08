'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type KitchenItem = { id: string; name: string; menge: number };
type KitchenOrder = {
  id: string;
  bestellnummer: string;
  batch_id?: string | null;
  status?: string | null;
  items: KitchenItem[];
  zone?: string | null;
};

interface BundleGroup {
  batch_id: string;
  zone: string | null;
  orders: KitchenOrder[];
}

const ZONE_COLORS: Record<string, string> = {
  A: 'border-matcha-400 bg-matcha-50',
  B: 'border-blue-400 bg-blue-50',
  C: 'border-amber-400 bg-amber-50',
  D: 'border-purple-400 bg-purple-50',
};
const ZONE_BADGE: Record<string, string> = {
  A: 'bg-matcha-100 text-matcha-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-purple-100 text-purple-700',
};

function buildBundles(orders: KitchenOrder[]): BundleGroup[] {
  const active = orders.filter(o =>
    o.batch_id && ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status ?? '')
  );
  const grouped = new Map<string, KitchenOrder[]>();
  for (const o of active) {
    const key = o.batch_id!;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(o);
  }
  return [...grouped.entries()]
    .filter(([, orders]) => orders.length >= 2)
    .map(([batch_id, orders]) => ({
      batch_id,
      zone: orders[0].zone ?? null,
      orders,
    }))
    .sort((a, b) => b.orders.length - a.orders.length);
}

export function KitchenPhase857BundleVisualisierung({ orders }: { orders: KitchenOrder[] }) {
  const [open, setOpen] = useState(false);

  const bundles = useMemo(() => buildBundles(orders), [orders]);

  if (bundles.length === 0) return null;

  const totalOrders = bundles.reduce((s, b) => s + b.orders.length, 0);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Bundle-Visualisierung</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            {bundles.length} Bundle{bundles.length !== 1 ? 's' : ''} · {totalOrders} Bestellungen
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {bundles.map(bundle => {
            const zoneKey = bundle.zone ?? '';
            const borderBg = ZONE_COLORS[zoneKey] ?? 'border-stone-300 bg-stone-50';
            const badge = ZONE_BADGE[zoneKey] ?? 'bg-stone-100 text-stone-700';
            const allItems = bundle.orders.flatMap(o => o.items.map(i => i.name));
            const itemCounts = allItems.reduce<Record<string, number>>((acc, name) => {
              acc[name] = (acc[name] ?? 0) + 1;
              return acc;
            }, {});
            const topItems = Object.entries(itemCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);

            return (
              <div key={bundle.batch_id} className={cn('px-5 py-3 space-y-2 border-l-4', borderBg)}>
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-stone-700">
                    Batch {bundle.batch_id.slice(-6).toUpperCase()}
                  </span>
                  {bundle.zone && (
                    <span className={cn('text-[9px] font-bold rounded-full px-2 py-0.5', badge)}>
                      Zone {bundle.zone}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-bold text-stone-500">
                    {bundle.orders.length} Bestellungen gemeinsam
                  </span>
                </div>

                {/* Bestellungen */}
                <div className="flex flex-wrap gap-1.5">
                  {bundle.orders.map(o => (
                    <div
                      key={o.id}
                      className="rounded-lg border border-white/70 bg-white/60 px-2.5 py-1.5 text-[11px] shadow-sm"
                    >
                      <div className="font-bold text-stone-800">#{o.bestellnummer}</div>
                      <div className="text-[9px] text-stone-500">{o.items.length} Art.</div>
                    </div>
                  ))}
                </div>

                {/* Top Artikel */}
                {topItems.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {topItems.map(([name, count]) => (
                      <span
                        key={name}
                        className="rounded-full bg-white/70 border border-stone-200 px-2 py-0.5 text-[9px] font-medium text-stone-600"
                      >
                        {name}{count > 1 ? ` ×${count}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground">
                  Zusammen zubereiten — ein Fahrer holt alle ab
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
