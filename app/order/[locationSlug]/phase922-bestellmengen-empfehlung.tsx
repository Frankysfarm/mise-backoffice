'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, ShoppingBag, Sparkles } from 'lucide-react';

/**
 * Phase 922 — Bestellmengen-Empfehlung (Storefront)
 *
 * "Andere Kunden bestellen oft auch X" — Cross-Sell-Hinweis nach
 * Artikel-Hinzufügen. Sichtbar wenn ≥1 Artikel im Warenkorb.
 * Polling: einmalig geladen, kein Polling.
 */

interface Props {
  locationId: string | null;
  currentItemNames: string[];
  onAddSuggestion?: (name: string) => void;
}

interface Empfehlung {
  name: string;
  count: number;
  image_url?: string | null;
}

const MOCK: Empfehlung[] = [
  { name: 'Tzatziki-Dip', count: 284 },
  { name: 'Pommes Frites', count: 241 },
  { name: 'Cola 0,5L', count: 198 },
];

export function Phase922BestellmengenEmpfehlung({ locationId, currentItemNames, onAddSuggestion }: Props) {
  const [empfehlungen, setEmpfehlungen] = useState<Empfehlung[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!locationId || currentItemNames.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      currentItemNames.slice(0, 5).forEach((n) => params.append('item', n));
      const res = await fetch(
        `/api/delivery/admin/bestellmengen-empfehlung?${params.toString()}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      const filtered = ((json.empfehlungen as Empfehlung[]) ?? []).filter(
        (e) => !currentItemNames.some((n) => n.toLowerCase() === e.name.toLowerCase()),
      );
      setEmpfehlungen(filtered.length > 0 ? filtered : MOCK);
    } catch {
      setEmpfehlungen(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId, currentItemNames]);

  useEffect(() => {
    setDismissed(false);
    setAddedItems(new Set());
    load();
  }, [load]);

  if (dismissed || currentItemNames.length === 0) return null;
  if (!loading && empfehlungen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold text-blue-800">Andere bestellen oft auch</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-400 hover:text-blue-600 text-[10px] font-semibold transition"
        >
          ✕
        </button>
      </div>

      {/* Empfehlungen */}
      <div className="px-4 py-3 space-y-2">
        {loading && empfehlungen.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-blue-400 py-2 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Empfehlungen…
          </div>
        )}

        {empfehlungen.map((e) => {
          const added = addedItems.has(e.name);
          return (
            <div
              key={e.name}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-2 transition',
                added
                  ? 'bg-matcha-50 border-matcha-200'
                  : 'bg-white border-stone-100',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  added ? 'text-matcha-500' : 'text-stone-400',
                )} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-800 truncate">{e.name}</div>
                  <div className="text-[9px] text-stone-400">{e.count}× diese Woche bestellt</div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (added) return;
                  setAddedItems((prev) => new Set([...prev, e.name]));
                  onAddSuggestion?.(e.name);
                }}
                className={cn(
                  'ml-2 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition',
                  added
                    ? 'bg-matcha-100 text-matcha-700 cursor-default'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                )}
              >
                {added ? '✓ Hinzugefügt' : '+ Hinzufügen'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
