'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';

type Props = {
  totalItems: number;
  total: number;
  onClick: () => void;
  visible: boolean;
  themeId?: 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';
};

const FAB_PALETTE = {
  classic:   { bg: 'bg-matcha-900 hover:bg-matcha-800', text: 'text-matcha-50', ring: 'ring-matcha-50/5', icon: 'bg-white/10', badge: 'bg-accent text-matcha-900' },
  bold:      { bg: 'bg-[#ff5a1f] hover:bg-[#e84e15]', text: 'text-white', ring: 'ring-white/10', icon: 'bg-black/20', badge: 'bg-black text-[#ff5a1f]' },
  minimal:   { bg: 'bg-neutral-900 hover:bg-neutral-800', text: 'text-white', ring: 'ring-white/5', icon: 'bg-white/10', badge: 'bg-white text-neutral-900' },
  farmhouse: { bg: 'bg-[#D2463A] hover:bg-[#B83A30]', text: 'text-white', ring: 'ring-white/10', icon: 'bg-white/15', badge: 'bg-[#6B8E4E] text-white' },
  urban:     { bg: 'bg-[#00D964] hover:bg-[#00B854]', text: 'text-[#0A0A0A]', ring: 'ring-[#0A0A0A]/10', icon: 'bg-[#0A0A0A]/15', badge: 'bg-[#0A0A0A] text-[#00D964]' },
  aurora:    { bg: 'bg-[#4F46E5] hover:bg-[#3730A3]', text: 'text-white', ring: 'ring-white/10', icon: 'bg-white/15', badge: 'bg-white text-[#4F46E5]' },
} as const;

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mobile-only floating cart bar, fades in when items exist. */
export function CartFab({ totalItems, total, onClick, visible, themeId = 'classic' }: Props) {
  const p = FAB_PALETTE[themeId] ?? FAB_PALETTE.classic;
  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-4 z-40 lg:hidden',
        'transition duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-live="polite"
        className={cn(
          'flex h-14 w-full items-center justify-between gap-2 rounded-2xl px-4 shadow-strong ring-1 transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          p.bg, p.text, p.ring,
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span className={cn('relative inline-flex h-9 w-9 items-center justify-center rounded-full', p.icon)}>
            <ShoppingBag className="h-4 w-4" />
            <span className={cn('absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold', p.badge)}>
              {totalItems}
            </span>
          </span>
          <span className="font-display text-base font-bold">Zur Kasse</span>
        </span>
        <span className="font-mono text-base font-bold tabular-nums">{formatEuro(total)}&nbsp;€</span>
      </button>
    </div>
  );
}
