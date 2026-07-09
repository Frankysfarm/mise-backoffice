'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrendingArtikel = {
  id: string;
  name: string;
  anzahl_bestellungen: number;
  rang: number;
};

const RANG_EMOJI = ['🔥', '⚡', '⭐'];

function mockTrending(): TrendingArtikel[] {
  return [
    { id: 'art1', name: 'Classic Burger', anzahl_bestellungen: 23, rang: 1 },
    { id: 'art2', name: 'Margherita Pizza', anzahl_bestellungen: 18, rang: 2 },
    { id: 'art3', name: 'Caesar Salat', anzahl_bestellungen: 14, rang: 3 },
  ];
}

export function Phase1057LivePopularitaetsRanking({
  locationId,
  trendingIds,
}: {
  locationId: string;
  trendingIds: Set<string>;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 dark:text-orange-300',
        !trendingIds.size && 'hidden'
      )}
    >
      <Flame size={8} className="text-orange-500" />
      Trending
    </span>
  );
}

export function useTrendingArtikelIds(locationId: string): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/storefront/trending-artikel?location_id=${encodeURIComponent(locationId)}&limit=3`);
        if (!res.ok) throw new Error();
        const json: { trending: TrendingArtikel[] } = await res.json();
        setIds(new Set(json.trending.map((t) => t.id)));
      } catch {
        setIds(new Set(mockTrending().map((t) => t.id)));
      }
    };

    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  return ids;
}

export function TrendingBadge({ rang }: { rang: number }) {
  const emoji = RANG_EMOJI[rang - 1] ?? '⭐';
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 dark:text-orange-300 animate-pulse">
      {emoji} Trending
    </span>
  );
}

export function Phase1057TrendingBanner({ locationId }: { locationId: string }) {
  const [trending, setTrending] = useState<TrendingArtikel[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/storefront/trending-artikel?location_id=${encodeURIComponent(locationId)}&limit=3`);
        if (!res.ok) throw new Error();
        const json: { trending: TrendingArtikel[] } = await res.json();
        setTrending(json.trending);
      } catch {
        setTrending(mockTrending());
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!visible || trending.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-2">
      <div className="flex items-center gap-3 rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-2.5">
        <Flame size={16} className="text-orange-500 shrink-0" />
        <span className="text-xs font-bold text-orange-800 dark:text-orange-200 shrink-0">Trending jetzt:</span>
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {trending.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300"
            >
              {RANG_EMOJI[t.rang - 1]} {t.name}
              <span className="text-[9px] text-orange-500 dark:text-orange-400">{t.anzahl_bestellungen}×</span>
            </span>
          ))}
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 text-orange-400 hover:text-orange-600 dark:text-orange-600 dark:hover:text-orange-400 text-xs leading-none"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
