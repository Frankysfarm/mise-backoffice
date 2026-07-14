'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

// Phase 1521 — Beliebte-Artikel-Chip-Leiste (Storefront)
// Horizontal scrollbare Chip-Leiste mit Top-5 Artikeln heute;
// localStorage-cached; Hydration-safe; nach Phase1516.

interface Artikel {
  id: string;
  name: string;
  bestellungen_heute: number;
  emoji?: string;
}

interface Props {
  locationId: string;
  artikel?: Artikel[];
  onArtikelClick?: (artikel: Artikel) => void;
  className?: string;
}

const LS_KEY_PREFIX = 'mise_beliebte_artikel_';
const CACHE_DURATION_MS = 30 * 60 * 1000;

const DEFAULT_ARTIKEL: Artikel[] = [
  { id: 'a1', name: 'Margherita', bestellungen_heute: 42, emoji: '🍕' },
  { id: 'a2', name: 'Pulled Pork Burger', bestellungen_heute: 35, emoji: '🍔' },
  { id: 'a3', name: 'Caesar Salad', bestellungen_heute: 28, emoji: '🥗' },
  { id: 'a4', name: 'Ramen', bestellungen_heute: 22, emoji: '🍜' },
  { id: 'a5', name: 'Tiramisu', bestellungen_heute: 19, emoji: '🍮' },
];

function getCachedArtikel(locationId: string): Artikel[] | null {
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${locationId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: Artikel[]; ts: number };
    if (Date.now() - ts > CACHE_DURATION_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedArtikel(locationId: string, data: Artikel[]): void {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${locationId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* noop */ }
}

export function StorefrontPhase1521BeliebtArtikelChips({ locationId, artikel, onArtikelClick, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Artikel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (artikel && artikel.length > 0) {
      setItems(artikel.slice(0, 5));
      return;
    }
    const cached = getCachedArtikel(locationId);
    if (cached) {
      setItems(cached);
      return;
    }
    setItems(DEFAULT_ARTIKEL);
    setCachedArtikel(locationId, DEFAULT_ARTIKEL);
  }, [locationId, artikel]);

  if (!mounted || items.length === 0) return null;

  const maxBestellungen = Math.max(...items.map(a => a.bestellungen_heute), 1);

  function handleClick(a: Artikel) {
    setActiveId(prev => prev === a.id ? null : a.id);
    onArtikelClick?.(a);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5 px-1">
        <Flame className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Heute beliebt
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map(a => {
          const isActive = activeId === a.id;
          const popularitaet = Math.round((a.bestellungen_heute / maxBestellungen) * 100);
          return (
            <button
              key={a.id}
              onClick={() => handleClick(a)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0',
                isActive
                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20',
              )}
            >
              {a.emoji && <span className="text-base leading-none">{a.emoji}</span>}
              <span>{a.name}</span>
              {popularitaet >= 80 && (
                <Flame className={cn('w-3 h-3 shrink-0', isActive ? 'text-rose-200' : 'text-rose-500')} />
              )}
              <span className={cn('text-[10px] font-bold ml-0.5', isActive ? 'text-rose-100' : 'text-slate-400')}>
                {a.bestellungen_heute}×
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
