'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { MenuItemCard } from './menu-item-card';
import type { Category, MenuItem } from './types';

type Props = {
  items: MenuItem[];
  getCategory: (categoryId: string | null) => Category | undefined;
  getQty: (id: string) => number;
  onAdd: (item: MenuItem) => void;
  onRemove: (id: string) => void;
  onOpenDetail: (item: MenuItem) => void;
  themeId?: 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';
};

const POP_PALETTE = {
  classic:   { eyebrow: 'text-matcha-600', flame: 'text-gold', title: 'text-matcha-900', navBtn: 'bg-white text-matcha-900 hover:bg-matcha-50', focusRing: 'focus-visible:ring-accent' },
  bold:      { eyebrow: 'text-[#ff5a1f]', flame: 'text-[#ff5a1f]', title: 'text-black uppercase', navBtn: 'bg-black text-white hover:bg-[#ff5a1f]', focusRing: 'focus-visible:ring-[#ff5a1f]' },
  minimal:   { eyebrow: 'text-neutral-500', flame: 'text-neutral-700', title: 'text-neutral-900 font-light', navBtn: 'bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50', focusRing: 'focus-visible:ring-neutral-500' },
  farmhouse: { eyebrow: 'text-[#D2463A]', flame: 'text-[#D2463A]', title: 'text-[#2B1F17]', navBtn: 'bg-white text-[#D2463A] ring-1 ring-[#E2D3B7] hover:bg-[#F8F1E4]', focusRing: 'focus-visible:ring-[#D2463A]' },
  urban:     { eyebrow: 'text-[#00D964]', flame: 'text-[#00D964]', title: 'text-[#FAFAFA] font-mono', navBtn: 'bg-[#1A1A1A] text-[#00D964] ring-1 ring-[#262626] hover:ring-[#00D964]', focusRing: 'focus-visible:ring-[#00D964]' },
  aurora:    { eyebrow: 'text-[#4F46E5]', flame: 'text-[#4F46E5]', title: 'text-[#0A0A0A]', navBtn: 'bg-white/80 text-[#4F46E5] backdrop-blur-md ring-1 ring-[#EEF2FF] hover:bg-[#EEF2FF]', focusRing: 'focus-visible:ring-[#4F46E5]' },
} as const;

export function PopularCarousel({ items, getCategory, getQty, onAdd, onRemove, onOpenDetail, themeId = 'classic' }: Props) {
  const p = POP_PALETTE[themeId] ?? POP_PALETTE.classic;
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section id="beliebt" className="scroll-mt-20 py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className={cn('flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]', p.eyebrow)}>
              <Flame className={cn('h-3.5 w-3.5', p.flame)} />
              Am beliebtesten
            </div>
            <h2 className={cn('mt-1 font-display text-3xl font-bold tracking-[-0.02em] md:text-4xl', p.title)}>
              Das lieben unsere Gäste
            </h2>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Zurück"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full shadow-subtle transition',
                p.navBtn,
                'focus-visible:outline-none focus-visible:ring-2',
                p.focusRing,
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Weiter"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full shadow-subtle transition',
                p.navBtn,
                'focus-visible:outline-none focus-visible:ring-2',
                p.focusRing,
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className={cn(
            'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4',
            '[&::-webkit-scrollbar]:hidden',
          )}
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="snap-start">
              <MenuItemCard
                item={item}
                category={getCategory(item.category_id)}
                qty={getQty(item.id)}
                onAdd={() => onAdd(item)}
                onRemove={() => onRemove(item.id)}
                onOpenDetail={() => onOpenDetail(item)}
                variant="tall"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
