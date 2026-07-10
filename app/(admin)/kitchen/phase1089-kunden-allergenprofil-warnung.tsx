'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1089 — Kunden-Allergenprofil-Warnung (Kitchen)
// Bei bekannten Stammkunden: Allergen-Historie aus letzten 5 Bestellungen anzeigen

interface Item { name?: string; title?: string; allergene?: string[] | null }
interface Order {
  id: string;
  status: string;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const ACTIVE_STATUSES = ['neu', 'angenommen', 'confirmed', 'in_preparation', 'zubereitung', 'ready'];

// Common allergen keywords for inference when structured data is absent
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  Gluten:   ['brot', 'brötchen', 'pasta', 'nudel', 'mehl', 'weizen', 'semmel', 'pizza', 'wrap', 'gebäck'],
  Laktose:  ['käse', 'sahne', 'milch', 'butter', 'joghurt', 'rahm', 'mozzarella', 'parmesan', 'béchamel'],
  Nüsse:    ['nuss', 'nüsse', 'mandel', 'cashew', 'walnuss', 'erdnuss', 'pistazie', 'pesto', 'praline'],
  Ei:       ['ei', 'eier', 'mayonnaise', 'mayo', 'omelette', 'frittata', 'Benedict'],
  Fisch:    ['fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'seezunge', 'sushi', 'meeresfrüchte'],
  Soja:     ['soja', 'tofu', 'edamame', 'miso', 'teriyaki', 'tempeh'],
  Sellerie: ['sellerie', 'selleriesalat', 'knollensellerie', 'staudensellerie'],
};

function extractAllergens(item: Item): string[] {
  // Prefer structured allergen data
  if (item.allergene && item.allergene.length > 0) return item.allergene;
  // Fallback: keyword matching
  const name = ((item.name ?? '') + ' ' + (item.title ?? '')).toLowerCase();
  return Object.entries(ALLERGEN_KEYWORDS)
    .filter(([, kws]) => kws.some(kw => name.includes(kw)))
    .map(([allergen]) => allergen);
}

// Group orders by customer identity (telefon preferred, else name)
function groupByCustomer(orders: Order[]): Map<string, Order[]> {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.kunde_telefon?.trim() || o.kunde_name?.trim() || null;
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  }
  return map;
}

type AllergenProfile = {
  customerId: string;
  customerName: string;
  allergens: string[];
  orderCount: number;
  lastSeen: Date;
};

export function KitchenPhase1089KundenAllergenprofil({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const profiles = useMemo(() => {
    // All orders last 30 days for history (active + recent)
    const byCustomer = groupByCustomer(orders);
    const result: AllergenProfile[] = [];

    for (const [key, custOrders] of byCustomer) {
      if (custOrders.length < 2) continue; // only Stammkunden (≥2 orders)

      // Collect allergens from last 5 orders
      const last5 = custOrders
        .slice()
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, 5);

      const allergenSet = new Set<string>();
      for (const ord of last5) {
        for (const item of ord.items ?? []) {
          extractAllergens(item).forEach(a => allergenSet.add(a));
        }
      }
      if (allergenSet.size === 0) continue;

      const latest = last5[0];
      result.push({
        customerId: key,
        customerName: latest.kunde_name ?? key,
        allergens: Array.from(allergenSet),
        orderCount: custOrders.length,
        lastSeen: new Date(latest.created_at ?? 0),
      });
    }

    // Show only customers with active orders right now
    const activeCustomerKeys = new Set(
      orders
        .filter(o => ACTIVE_STATUSES.includes(o.status ?? ''))
        .map(o => o.kunde_telefon?.trim() || o.kunde_name?.trim())
        .filter(Boolean) as string[]
    );

    return result
      .filter(p => activeCustomerKeys.has(p.customerId))
      .sort((a, b) => b.allergens.length - a.allergens.length);
  }, [orders]);

  if (profiles.length === 0) return null;

  const ALLERGEN_COLOR: Record<string, string> = {
    Gluten:   'bg-yellow-100 text-yellow-800 border-yellow-300',
    Laktose:  'bg-blue-100 text-blue-800 border-blue-300',
    Nüsse:    'bg-orange-100 text-orange-800 border-orange-300',
    Ei:       'bg-amber-100 text-amber-800 border-amber-300',
    Fisch:    'bg-cyan-100 text-cyan-800 border-cyan-300',
    Soja:     'bg-green-100 text-green-800 border-green-300',
    Sellerie: 'bg-lime-100 text-lime-800 border-lime-300',
  };

  return (
    <div className="rounded-xl border border-rose-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100/50 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldAlert className="h-4 w-4 text-rose-600" />
          <span className="text-sm font-bold">Stammkunden-Allergen-Profile</span>
          <span className="inline-flex items-center rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-700">
            {profiles.length} Kunden mit Allergen-Historie
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-rose-100 dark:divide-rose-900/30 bg-white dark:bg-background">
          {profiles.map(p => (
            <div key={p.customerId} className="px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span className="text-sm font-semibold">{p.customerName}</span>
                  <span className="text-[10px] text-muted-foreground">{p.orderCount} Bestellungen</span>
                </div>
                <span className="text-[10px] text-muted-foreground">aus letzten {Math.min(p.orderCount, 5)} Bestellungen</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.allergens.map(a => (
                  <span
                    key={a}
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      ALLERGEN_COLOR[a] ?? 'bg-gray-100 text-gray-700 border-gray-300'
                    )}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
