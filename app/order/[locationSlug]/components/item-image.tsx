'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { visualFor, seedFor } from './category-visuals';
import type { Category, MenuItem } from './types';

type Props = {
  item: MenuItem;
  category?: Category | null;
  className?: string;
  /** Optional size for the emoji. */
  emojiClass?: string;
  /** If true, applies subtle hover-scale (card-level). */
  hoverable?: boolean;
  rounded?: string;
};

/**
 * Unified placeholder / image wrapper for menu items.
 * Uses real image if `bild_url` set, else a deterministic gradient + emoji.
 */
export const ItemImage = React.memo(function ItemImage({
  item,
  category,
  className,
  emojiClass,
  hoverable,
  rounded = 'rounded-xl',
}: Props) {
  const visual = visualFor(category?.name);
  const seed = seedFor(item.id);
  // Deterministic rotation for the emoji blob, slight variance.
  const rotate = (seed % 12) - 6;
  const translate = (seed % 20) - 10;

  if (item.bild_url) {
    return (
      <div className={cn('relative overflow-hidden', rounded, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.bild_url}
          alt={item.name}
          className={cn(
            'h-full w-full object-cover',
            hoverable && 'transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]',
          )}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        'bg-gradient-to-br text-white/90 shadow-inner',
        visual.gradient,
        rounded,
        className,
      )}
      aria-hidden
    >
      {/* subtle noise using radial-gradient dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.3) 1px, transparent 1px)',
          backgroundSize: '14px 14px, 22px 22px',
          backgroundPosition: '0 0, 7px 11px',
        }}
      />
      <span
        className={cn('select-none drop-shadow-sm transition-transform duration-500', emojiClass ?? 'text-5xl')}
        style={{ transform: `translate(${translate / 4}px, ${translate / 6}px) rotate(${rotate}deg)` }}
      >
        {visual.icon}
      </span>
    </div>
  );
});
