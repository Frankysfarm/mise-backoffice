'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';
import type { Category } from './types';

type Props = {
  categories: Category[];
  hasPopular: boolean;
  activeId: string | null;
  onJump: (id: string) => void;
  totalItems: number;
  totalPrice: number;
  onOpenCart: () => void;
  themeId?: 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';
};

const PALETTES = {
  classic:   { bg: 'bg-surface/85 backdrop-blur-md', border: 'border-black/5', chipActive: 'bg-matcha-900 text-matcha-50', chipInactive: 'text-matcha-800/70 hover:bg-black/5 hover:text-matcha-900', cart: 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800', cartBadge: 'bg-accent text-matcha-900' },
  bold:      { bg: 'bg-black text-white', border: 'border-white/10', chipActive: 'bg-[#ff5a1f] text-white', chipInactive: 'text-white/70 hover:text-white', cart: 'bg-[#ff5a1f] text-white hover:bg-[#e84e15]', cartBadge: 'bg-white text-black' },
  minimal:   { bg: 'bg-white/95 backdrop-blur-md', border: 'border-neutral-200', chipActive: 'bg-neutral-900 text-white', chipInactive: 'text-neutral-600 hover:text-neutral-900', cart: 'bg-neutral-900 text-white hover:bg-neutral-800', cartBadge: 'bg-white text-neutral-900' },
  farmhouse: { bg: 'bg-[#F8F1E4]/95 backdrop-blur-md', border: 'border-[#E2D3B7]', chipActive: 'bg-[#D2463A] text-white', chipInactive: 'text-[#4A3A2C] hover:bg-[#F0E5D0]', cart: 'bg-[#D2463A] text-white hover:bg-[#B83A30]', cartBadge: 'bg-[#6B8E4E] text-white' },
  urban:     { bg: 'bg-[#0A0A0A]/95 backdrop-blur-md', border: 'border-[#262626]', chipActive: 'bg-[#00D964] text-[#0A0A0A]', chipInactive: 'text-[#A3A3A3] hover:text-[#FAFAFA]', cart: 'bg-[#00D964] text-[#0A0A0A] hover:bg-[#00B854]', cartBadge: 'bg-[#0A0A0A] text-[#00D964]' },
  aurora:    { bg: 'bg-white/85 backdrop-blur-lg', border: 'border-[#F0F0F0]', chipActive: 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/30', chipInactive: 'text-[#52525B] hover:bg-[#EEF2FF]', cart: 'bg-[#4F46E5] text-white hover:bg-[#3730A3]', cartBadge: 'bg-white text-[#4F46E5]' },
} as const;

export function StickyCategoryBar({
  categories,
  hasPopular,
  activeId,
  onJump,
  totalItems,
  totalPrice,
  onOpenCart,
  themeId = 'classic',
}: Props) {
  const p = PALETTES[themeId] ?? PALETTES.classic;
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  // Keep active chip in view.
  React.useEffect(() => {
    if (!activeId || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLButtonElement>(`button[data-cat="${activeId}"]`);
    if (el) {
      const parentBox = scrollerRef.current.getBoundingClientRect();
      const childBox = el.getBoundingClientRect();
      const outOfView = childBox.left < parentBox.left + 24 || childBox.right > parentBox.right - 24;
      if (outOfView) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeId]);

  const chips: { id: string; label: string; icon: string | null }[] = [
    ...(hasPopular ? [{ id: 'beliebt', label: 'Beliebt', icon: '⭐' }] : []),
    ...categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
  ];

  return (
    <div
      className={cn(
        'sticky top-0 z-40 border-b',
        p.bg, p.border,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 md:px-8">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-x-auto py-2.5 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-center gap-1.5">
            {chips.map((c) => {
              const active = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-cat={c.id}
                  onClick={() => onJump(c.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    active ? p.chipActive : p.chipInactive,
                  )}
                >
                  {c.icon ? <span className="text-base leading-none">{c.icon}</span> : null}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop mini-cart */}
        {totalItems > 0 && (
          <button
            type="button"
            onClick={onOpenCart}
            className={cn(
              'hidden shrink-0 lg:inline-flex',
              'items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-soft transition',
              p.cart,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', p.cartBadge)}>
              {totalItems}
            </span>
            <span className="font-mono tabular-nums">{totalPrice.toFixed(2)} €</span>
          </button>
        )}
      </div>
    </div>
  );
}
