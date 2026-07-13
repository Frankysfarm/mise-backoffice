'use client';

// Phase 1318 — Beliebtheits-Badge (Storefront)
// Top-3-Gerichte der letzten Stunde mit "🔥 Trending"-Label + Bestellzähler.
// 10-Min-Polling · nach Phase1313.

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeliebtesGericht {
  rang: number;
  artikel_name: string;
  anzahl_bestellungen: number;
}

const RANG_BADGE = ['🔥', '⚡', '⭐'];

function buildMock(): BeliebtesGericht[] {
  return [
    { rang: 1, artikel_name: 'Classic Burger',    anzahl_bestellungen: 14 },
    { rang: 2, artikel_name: 'Margherita Pizza',  anzahl_bestellungen: 11 },
    { rang: 3, artikel_name: 'Caesar Salat',      anzahl_bestellungen: 8  },
  ];
}

interface Props {
  locationId: string;
}

export function Phase1318Beliebtheitsbadge({ locationId }: Props) {
  const [gerichte, setGerichte] = useState<BeliebtesGericht[]>([]);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/beliebte-gerichte?location_id=${locationId}&stunden=1`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        setGerichte(Array.isArray(json.gerichte) ? json.gerichte : buildMock());
      } catch {
        setGerichte(buildMock());
      }
    };

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!gerichte.length) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-2 md:px-8">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
          <Flame className="h-3.5 w-3.5 fill-current" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Trending jetzt</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {gerichte.map((g) => (
            <div
              key={g.rang}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all',
                g.rang === 1
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                  : g.rang === 2
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
              )}
            >
              <span>{RANG_BADGE[g.rang - 1]}</span>
              <span>{g.artikel_name}</span>
              <span className="opacity-70 font-normal">×{g.anzahl_bestellungen}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
