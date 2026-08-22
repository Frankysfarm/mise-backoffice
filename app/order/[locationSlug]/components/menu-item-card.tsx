'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus, Star } from 'lucide-react';
import { ItemImage } from './item-image';
import type { Category, MenuItem } from './types';
import { ALLERGEN_LABEL } from './types';

export type CardThemeId = 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';

type Props = {
  item: MenuItem;
  category?: Category | null;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpenDetail?: () => void;
  verfuegbar?: boolean;
  variant?: 'row' | 'tall';
  themeId?: CardThemeId;
};

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CARD_PALETTE: Record<CardThemeId, {
  card: string;
  cardRing: string;
  imageBg: string;
  rounding: string;
  imgRounding: string;
  hover: string;
  title: string;
  price: string;
  signatureBadge: string;
  beliebtBadge: string;
  veganBadge: string;
  sterneFill: string;
  allergenDot: string;
  ausverkauftBg: string;
  ausverkauftText: string;
  plusBtn: string;
  qtyContainer: string;
  qtyContainerHover: string;
  qtyFocusRing: string;
  signatureMove?: string;
}> = {
  classic: {
    card: 'bg-white',
    cardRing: 'ring-1 ring-black/5',
    imageBg: 'bg-matcha-50',
    rounding: 'rounded-2xl',
    imgRounding: 'rounded-none',
    hover: 'hover:shadow-soft motion-safe:hover:rotate-[0.3deg] motion-safe:hover:-translate-y-0.5',
    title: 'text-matcha-900',
    price: 'text-matcha-900',
    signatureBadge: 'bg-gold text-matcha-900',
    beliebtBadge: 'bg-white/95 text-matcha-900',
    veganBadge: 'bg-matcha-700 text-white',
    sterneFill: 'fill-matcha-900',
    allergenDot: 'bg-matcha-900/30',
    ausverkauftBg: 'bg-matcha-900/85',
    ausverkauftText: 'text-matcha-50',
    plusBtn: 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
    qtyContainer: 'bg-accent text-matcha-900',
    qtyContainerHover: 'hover:bg-matcha-900/10',
    qtyFocusRing: 'focus-visible:ring-matcha-900 focus-visible:ring-offset-accent',
  },
  bold: {
    card: 'bg-white',
    cardRing: 'ring-1 ring-black/20',
    imageBg: 'bg-neutral-100',
    rounding: 'rounded-none',
    imgRounding: 'rounded-none',
    hover: 'hover:shadow-[6px_6px_0_#ff5a1f] motion-safe:hover:-translate-y-1',
    title: 'text-black uppercase tracking-tight',
    price: 'text-[#ff5a1f]',
    signatureBadge: 'bg-[#ff5a1f] text-white',
    beliebtBadge: 'bg-black text-white',
    veganBadge: 'bg-black text-white',
    sterneFill: 'fill-white',
    allergenDot: 'bg-black/40',
    ausverkauftBg: 'bg-[#ff5a1f]',
    ausverkauftText: 'text-white',
    plusBtn: 'bg-[#ff5a1f] text-white hover:bg-black rounded-none',
    qtyContainer: 'bg-black text-white rounded-none',
    qtyContainerHover: 'hover:bg-[#ff5a1f]',
    qtyFocusRing: 'focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-black',
    signatureMove: 'before:absolute before:top-2 before:right-3 before:font-display before:text-7xl before:font-black before:text-[#ff5a1f]/10 before:content-[attr(data-num)]',
  },
  minimal: {
    card: 'bg-white',
    cardRing: 'ring-1 ring-neutral-200',
    imageBg: 'bg-neutral-50',
    rounding: 'rounded-lg',
    imgRounding: 'rounded-md',
    hover: 'hover:border-neutral-400 hover:ring-neutral-300',
    title: 'text-neutral-900 font-light',
    price: 'text-neutral-900 font-light',
    signatureBadge: 'bg-neutral-900 text-white',
    beliebtBadge: 'bg-white border border-neutral-300 text-neutral-700',
    veganBadge: 'bg-neutral-100 text-neutral-700',
    sterneFill: 'fill-white',
    allergenDot: 'bg-neutral-400',
    ausverkauftBg: 'bg-neutral-900',
    ausverkauftText: 'text-white',
    plusBtn: 'bg-neutral-900 text-white hover:bg-neutral-700',
    qtyContainer: 'bg-neutral-900 text-white',
    qtyContainerHover: 'hover:bg-neutral-700',
    qtyFocusRing: 'focus-visible:ring-neutral-500 focus-visible:ring-offset-neutral-900',
  },
  farmhouse: {
    card: 'bg-white',
    cardRing: 'ring-1 ring-[#E2D3B7]',
    imageBg: 'bg-[#F8F1E4]',
    rounding: 'rounded-2xl',
    imgRounding: 'rounded-none',
    hover: 'hover:shadow-md hover:shadow-[#D2463A]/10 motion-safe:hover:rotate-[1deg] motion-safe:hover:-translate-y-0.5',
    title: 'text-[#2B1F17] font-display',
    price: 'text-[#D2463A] font-display',
    signatureBadge: 'bg-[#D2463A] text-white',
    beliebtBadge: 'bg-white text-[#2B1F17] border border-[#D2463A]',
    veganBadge: 'bg-[#6B8E4E] text-white',
    sterneFill: 'fill-[#D2463A]',
    allergenDot: 'bg-[#7A6A5C]',
    ausverkauftBg: 'bg-[#2B1F17]/90',
    ausverkauftText: 'text-[#F8F1E4]',
    plusBtn: 'bg-[#D2463A] text-white hover:bg-[#B83A30] shadow-[2px_2px_0_#2B1F17]',
    qtyContainer: 'bg-[#6B8E4E] text-white',
    qtyContainerHover: 'hover:bg-white/20',
    qtyFocusRing: 'focus-visible:ring-[#D2463A] focus-visible:ring-offset-white',
  },
  urban: {
    card: 'bg-[#1A1A1A]',
    cardRing: 'ring-1 ring-[#262626]',
    imageBg: 'bg-[#0A0A0A]',
    rounding: 'rounded-xl',
    imgRounding: 'rounded-none',
    hover: 'hover:ring-[#00D964] hover:shadow-[0_0_24px_rgba(0,217,100,0.4)] motion-safe:hover:-translate-y-0.5',
    title: 'text-[#FAFAFA] font-mono',
    price: 'text-[#00D964] font-mono tabular-nums',
    signatureBadge: 'bg-[#00D964] text-[#0A0A0A]',
    beliebtBadge: 'bg-[#262626] text-[#FAFAFA] border border-[#00D964]/40',
    veganBadge: 'bg-[#00D964]/20 text-[#00D964] border border-[#00D964]/40',
    sterneFill: 'fill-[#00D964]',
    allergenDot: 'bg-[#A3A3A3]/50',
    ausverkauftBg: 'bg-[#0A0A0A]/85',
    ausverkauftText: 'text-[#00D964]',
    plusBtn: 'bg-[#00D964] text-[#0A0A0A] hover:shadow-[0_0_20px_rgba(0,217,100,0.6)]',
    qtyContainer: 'bg-[#00D964] text-[#0A0A0A]',
    qtyContainerHover: 'hover:bg-[#0A0A0A]/15',
    qtyFocusRing: 'focus-visible:ring-[#00D964] focus-visible:ring-offset-[#0A0A0A]',
  },
  aurora: {
    card: 'bg-white/85 backdrop-blur-xl',
    cardRing: 'ring-1 ring-[#F0F0F0]',
    imageBg: 'bg-[#EEF2FF]',
    rounding: 'rounded-2xl',
    imgRounding: 'rounded-2xl',
    hover: 'hover:shadow-[0_8px_28px_rgba(79,70,229,0.10)] motion-safe:hover:-translate-y-0.5 hover:scale-[1.01]',
    title: 'text-[#0A0A0A]',
    price: 'text-[#4F46E5] font-semibold',
    signatureBadge: 'bg-[#4F46E5] text-white',
    beliebtBadge: 'bg-white/90 text-[#4F46E5] border border-[#EEF2FF]',
    veganBadge: 'bg-[#10B981] text-white',
    sterneFill: 'fill-white',
    allergenDot: 'bg-[#A1A1AA]',
    ausverkauftBg: 'bg-[#0A0A0A]/85',
    ausverkauftText: 'text-white',
    plusBtn: 'bg-[#4F46E5] text-white hover:bg-[#3730A3] hover:scale-[1.05] transition-transform duration-300',
    qtyContainer: 'bg-[#4F46E5] text-white',
    qtyContainerHover: 'hover:bg-white/20',
    qtyFocusRing: 'focus-visible:ring-[#4F46E5] focus-visible:ring-offset-white',
  },
};

export const MenuItemCard = React.memo(function MenuItemCard({
  item,
  category,
  qty,
  onAdd,
  onRemove,
  onOpenDetail,
  verfuegbar = true,
  variant = 'row',
  themeId = 'classic',
}: Props) {
  const tags = (item.tags ?? []).filter((t) => !['hot', 'iced', 'food', 'signature'].includes(t));
  const signature = (item.tags ?? []).includes('signature');
  const vegan = (item.tags ?? []).includes('vegan');
  const p = CARD_PALETTE[themeId] ?? CARD_PALETTE.classic;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-stop-detail]')) return;
    onOpenDetail?.();
  };

  const tallLayout = variant === 'tall';

  if (tallLayout) {
    return (
      <article
        onClick={handleCardClick}
        className={cn(
          'group relative flex w-[260px] shrink-0 cursor-pointer flex-col overflow-hidden shadow-subtle transition duration-200 ease-out',
          p.rounding, p.card, p.cardRing, p.hover,
          !verfuegbar && 'pointer-events-none opacity-60',
        )}
      >
        <div className="relative h-[280px] w-full">
          <ItemImage item={item} category={category} className="h-full w-full" rounded="rounded-none" emojiClass="text-7xl" hoverable />
          {(item.beliebt || signature) && (
            <div
              className={cn(
                'absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-soft',
                signature ? p.signatureBadge : p.beliebtBadge,
              )}
              style={{ transform: 'rotate(-4deg)' }}
            >
              <Star className={cn('h-3 w-3', p.sterneFill)} />
              {signature ? 'Signature' : 'Beliebt'}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white">
            <div className="pr-3">
              <h3 className="font-display text-lg font-bold leading-tight tracking-tight">{item.name}</h3>
              <div className="mt-0.5 font-mono text-sm tabular-nums opacity-90">{formatEuro(item.preis)}&nbsp;€</div>
            </div>
            <QtyControl qty={qty} onAdd={onAdd} onRemove={onRemove} size="sm" theme="onDark" palette={p} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={handleCardClick}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col overflow-hidden transition duration-200 ease-out active:scale-[0.98]',
        p.rounding, p.card, p.cardRing, p.hover,
        !verfuegbar && 'pointer-events-none opacity-50',
      )}
    >
      <div className={cn('relative aspect-square w-full', p.imageBg)}>
        <ItemImage
          item={item}
          category={category}
          className="h-full w-full"
          rounded={p.imgRounding}
          emojiClass="text-6xl"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {(item.beliebt || signature) && (
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm', signature ? p.signatureBadge : p.beliebtBadge)}>
              <Star className={cn('h-2.5 w-2.5', p.sterneFill)} />
              {signature ? 'Top' : 'Beliebt'}
            </span>
          )}
          {vegan && (
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm', p.veganBadge)}>
              Vegan
            </span>
          )}
        </div>

        <div className="absolute bottom-2 right-2">
          <QtyControl qty={qty} onAdd={onAdd} onRemove={onRemove} size="sm" theme="onLight" palette={p} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <h3 className={cn('font-display text-[13px] font-bold leading-tight line-clamp-2 min-h-[2.3em]', p.title)}>
          {item.name}
        </h3>
        <div className={cn('mt-1 font-display text-[15px] font-black tabular-nums', p.price)}>
          {formatEuro(item.preis)}&nbsp;€
        </div>
        {(item.allergene?.length ?? 0) > 0 && (
          <div className="mt-1 flex items-center gap-0.5">
            {item.allergene!.slice(0, 5).map((a) => (
              <span
                key={a}
                title={ALLERGEN_LABEL[a] ?? a}
                aria-label={ALLERGEN_LABEL[a] ?? a}
                className={cn('inline-block h-1 w-1 rounded-full', p.allergenDot)}
              />
            ))}
          </div>
        )}
      </div>

      {!verfuegbar && (
        <div className={cn('absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-6deg] py-1 text-center text-[10px] font-bold uppercase tracking-widest', p.ausverkauftBg, p.ausverkauftText)}>
          Ausverkauft
        </div>
      )}
    </article>
  );
});

function QtyControl({
  qty,
  onAdd,
  onRemove,
  size = 'md',
  theme = 'onLight',
  palette,
}: {
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  size?: 'sm' | 'md';
  theme?: 'onLight' | 'onDark';
  palette: typeof CARD_PALETTE['classic'];
}) {
  const hapticAdd = () => {
    try {
      if (typeof window !== 'undefined' && 'ontouchstart' in window && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      /* ignore */
    }
    onAdd();
  };

  const dim = size === 'sm' ? 'h-11 w-11' : 'h-11 w-11';
  const stepperDim = size === 'sm' ? 'h-9 w-9' : 'h-9 w-9';

  if (qty === 0) {
    const plusClass = theme === 'onDark'
      ? 'bg-white text-zinc-900 hover:scale-105'
      : palette.plusBtn;
    return (
      <button
        type="button"
        data-stop-detail
        onClick={(e) => {
          e.stopPropagation();
          hapticAdd();
        }}
        aria-label="Hinzufügen"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full shadow-soft transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          palette.qtyFocusRing,
          dim,
          plusClass,
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <div
      data-stop-detail
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-full shadow-soft',
        palette.qtyContainer,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Weniger"
        className={cn(
          'inline-flex items-center justify-center rounded-full transition',
          palette.qtyContainerHover,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          palette.qtyFocusRing,
          stepperDim,
        )}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="min-w-[1.25rem] text-center font-mono text-sm font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hapticAdd();
        }}
        aria-label="Mehr"
        className={cn(
          'inline-flex items-center justify-center rounded-full transition',
          palette.qtyContainerHover,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          palette.qtyFocusRing,
          stepperDim,
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
