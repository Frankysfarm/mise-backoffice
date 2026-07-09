'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type MerkzettelItem = {
  id: string;
  name: string;
  preis: number;
  kategorie?: string;
  bild_url?: string | null;
};

const STORAGE_KEY = 'mise_merkzettel';

function loadMerkzettel(): MerkzettelItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveMerkzettel(items: MerkzettelItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useMerkzettel() {
  const [items, setItems] = useState<MerkzettelItem[]>([]);

  useEffect(() => {
    setItems(loadMerkzettel());
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(loadMerkzettel());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggle = (item: MerkzettelItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      const next = exists ? prev.filter((i) => i.id !== item.id) : [...prev, item];
      saveMerkzettel(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveMerkzettel(next);
      return next;
    });
  };

  const isOnMerkzettel = (id: string) => items.some((i) => i.id === id);

  return { items, toggle, remove, isOnMerkzettel };
}

export function MerkzettelButton({
  item,
  merkzettel,
  size = 16,
}: {
  item: MerkzettelItem;
  merkzettel: ReturnType<typeof useMerkzettel>;
  size?: number;
}) {
  const onList = merkzettel.isOnMerkzettel(item.id);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        merkzettel.toggle(item);
      }}
      title={onList ? 'Vom Merkzettel entfernen' : 'Auf Merkzettel setzen'}
      className={cn(
        'rounded-full p-1 transition-colors',
        onList
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-gray-300 hover:text-amber-400 dark:text-gray-600 dark:hover:text-amber-400'
      )}
    >
      {onList ? <BookmarkCheck size={size} /> : <Bookmark size={size} />}
    </button>
  );
}

export function Phase1052MerkzettelWidget({
  merkzettel,
  onAddToCart,
}: {
  merkzettel: ReturnType<typeof useMerkzettel>;
  onAddToCart?: (item: MerkzettelItem) => void;
}) {
  const [open, setOpen] = useState(false);

  if (merkzettel.items.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
      >
        <Bookmark size={15} />
        Merkzettel
        <span className="ml-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
          {merkzettel.items.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 dark:border-amber-900">
            <span className="font-bold text-sm text-amber-700 dark:text-amber-300">Mein Merkzettel</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-amber-50 dark:divide-amber-900/50">
            {merkzettel.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    {item.preis.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onAddToCart && (
                    <button
                      onClick={() => onAddToCart(item)}
                      title="In Warenkorb"
                      className="rounded-lg bg-matcha-600 hover:bg-matcha-700 text-white p-1.5 transition-colors"
                    >
                      <ShoppingCart size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => merkzettel.remove(item.id)}
                    title="Entfernen"
                    className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-400 p-1.5 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-amber-100 dark:border-amber-900">
            <p className="text-[10px] text-amber-400 dark:text-amber-500">
              Gespeichert im Browser — beim nächsten Besuch noch verfügbar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
