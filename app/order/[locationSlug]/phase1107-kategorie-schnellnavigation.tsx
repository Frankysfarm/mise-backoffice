'use client';

import { useState, useCallback } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1107 — Kategorie-Schnellnavigation (Storefront)
// Floating grid-overlay: alle Kategorien mit Icon + Artikel-Anzahl;
// Tipp auf Kategorie → Smooth-Scroll + Overlay schließt sich

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface MenuItem {
  id: string;
  category_id: string | null;
}

interface Props {
  categories: Category[];
  items: MenuItem[];
  onJump: (id: string) => void;
  hasPopular?: boolean;
  themeId?: 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';
}

const THEME_COLORS = {
  classic:   { fab: 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800', chip: 'bg-matcha-50 text-matcha-900 border-matcha-200 hover:bg-matcha-100', count: 'bg-matcha-900/10 text-matcha-800', overlay: 'bg-white dark:bg-gray-900', title: 'text-matcha-900 dark:text-matcha-100' },
  bold:      { fab: 'bg-[#ff5a1f] text-white hover:bg-[#e84e15]', chip: 'bg-black/80 text-white border-white/10 hover:bg-black', count: 'bg-white/20 text-white', overlay: 'bg-black text-white', title: 'text-white' },
  minimal:   { fab: 'bg-neutral-900 text-white hover:bg-neutral-800', chip: 'bg-neutral-50 text-neutral-900 border-neutral-200 hover:bg-neutral-100', count: 'bg-neutral-200 text-neutral-700', overlay: 'bg-white dark:bg-neutral-900', title: 'text-neutral-900 dark:text-neutral-100' },
  farmhouse: { fab: 'bg-[#D2463A] text-white hover:bg-[#B83A30]', chip: 'bg-[#F8F1E4] text-[#4A3A2C] border-[#E2D3B7] hover:bg-[#F0E5D0]', count: 'bg-[#D2463A]/15 text-[#D2463A]', overlay: 'bg-[#F8F1E4]', title: 'text-[#4A3A2C]' },
  urban:     { fab: 'bg-[#00D964] text-[#0A0A0A] hover:bg-[#00B854]', chip: 'bg-[#1A1A1A] text-[#FAFAFA] border-[#333] hover:bg-[#262626]', count: 'bg-[#00D964]/20 text-[#00D964]', overlay: 'bg-[#0A0A0A]', title: 'text-[#FAFAFA]' },
  aurora:    { fab: 'bg-[#4F46E5] text-white hover:bg-[#3730A3] shadow-lg shadow-[#4F46E5]/30', chip: 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE] hover:bg-[#E0E7FF]', count: 'bg-[#4F46E5]/15 text-[#4F46E5]', overlay: 'bg-white dark:bg-[#1E1B4B]', title: 'text-[#1E1B4B] dark:text-white' },
} as const;

export function Phase1107KategorieSchnellnavigation({ categories, items, onJump, hasPopular, themeId = 'classic' }: Props) {
  const [open, setOpen] = useState(false);
  const t = THEME_COLORS[themeId] ?? THEME_COLORS.classic;

  const chips: { id: string; label: string; icon: string; count: number }[] = [
    ...(hasPopular
      ? [{ id: 'beliebt', label: 'Beliebt', icon: '⭐', count: items.filter(i => (i as { beliebt?: boolean }).beliebt).length }]
      : []
    ),
    ...categories.map(c => ({
      id: c.id,
      label: c.name,
      icon: c.icon ?? '🍽️',
      count: items.filter(i => i.category_id === c.id).length,
    })),
  ].filter(c => c.count > 0);

  const handleJump = useCallback((id: string) => {
    onJump(id);
    setOpen(false);
  }, [onJump]);

  if (chips.length <= 3) return null; // not worth showing for tiny menus

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Menü-Kategorien anzeigen"
        className={cn(
          'fixed bottom-24 right-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-2 shadow-lg text-sm font-semibold transition-all',
          t.fab,
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Alle Kategorien</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Kategorie-Schnellnavigation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet from bottom */}
          <div className={cn(
            'absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto',
            t.overlay,
          )}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-black/5">
              <h2 className={cn('font-bold text-base', t.title)}>Kategorien</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label="Schließen"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-4">
              {chips.map(chip => (
                <button
                  key={chip.id}
                  onClick={() => handleJump(chip.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all active:scale-95',
                    t.chip,
                  )}
                >
                  <span className="text-2xl leading-none">{chip.icon}</span>
                  <span className="text-[11px] font-semibold leading-tight line-clamp-2">{chip.label}</span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', t.count)}>
                    {chip.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Safe area spacer */}
            <div className="h-4" />
          </div>
        </div>
      )}
    </>
  );
}
