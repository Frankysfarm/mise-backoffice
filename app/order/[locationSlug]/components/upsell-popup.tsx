'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { Plus, Sparkles, X } from 'lucide-react';
import { ItemImage } from './item-image';
import type { MenuItem } from './types';

type Props = {
  forItem: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
};

/** Zeigt nach "In den Warenkorb" passende Cross-Sells als Toast-Popup unten. */
export function UpsellPopup({ forItem, onClose, onAdd }: Props) {
  const [related, setRelated] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!forItem) {
      setRelated([]);
      return;
    }
    setLoading(true);
    const sb = createClient();
    sb
      .from('menu_item_relations')
      .select('related_item_id, typ, sort_order, related:menu_items!menu_item_relations_related_item_id_fkey(*)')
      .eq('item_id', forItem.id)
      .in('typ', ['upsell', 'crosssell'])
      .order('sort_order')
      .limit(3)
      .then((res: { data: unknown }) => {
        const items = ((res.data as any[]) ?? [])
          .map((r) => r.related)
          .filter(Boolean) as MenuItem[];
        setRelated(items);
        setLoading(false);
      });
  }, [forItem?.id]);

  // Auto-close nach 10 Sek wenn nicht interagiert
  React.useEffect(() => {
    if (!forItem || related.length === 0) return;
    const id = setTimeout(onClose, 10_000);
    return () => clearTimeout(id);
  }, [forItem, related.length, onClose]);

  if (!forItem || loading || related.length === 0) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 sm:max-w-md pointer-events-none">
      <div className="relative bg-white rounded-2xl shadow-strong border border-matcha-200 overflow-hidden pointer-events-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 bg-matcha-50 px-4 py-2.5 border-b border-matcha-100">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-matcha-700">
            <Sparkles className="h-3 w-3" />
            Passt gut dazu
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-matcha-100" aria-label="Schließen">
            <X className="h-3.5 w-3.5 text-matcha-700" />
          </button>
        </div>

        {/* Items */}
        <div className="divide-y">
          {related.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-matcha-100">
                {r.bild_url ? (
                  <img src={r.bild_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ItemImage item={r} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm text-matcha-900 truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{euro(r.preis)}</div>
              </div>
              <button
                onClick={() => { onAdd(r); onClose(); }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-matcha-900 text-matcha-50 hover:bg-matcha-800 shadow-soft"
                aria-label="Hinzufügen"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
