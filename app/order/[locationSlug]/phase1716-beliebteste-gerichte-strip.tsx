'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ShoppingBag } from 'lucide-react';

/**
 * Phase 1716 — Beliebteste-Gerichte-Vorschau-Strip (Storefront)
 *
 * Top-3 der Location heute (via API); Mini-Cards mit Name + Bestellanzahl.
 * GET /api/delivery/public/beliebteste-gerichte?location_id=<id>
 * 30-Min-Polling. Hydration-safe.
 */

interface GerichtEntry {
  rang: number;
  name: string;
  bestellungen: number;
  kategorie?: string | null;
}

interface ApiResponse {
  location_id: string;
  gerichte: GerichtEntry[];
  zeitraum_label: string;
  generiert_am: string;
}

interface Props {
  locationId: string;
  className?: string;
}

const MOCK: ApiResponse = {
  location_id: 'mock',
  gerichte: [
    { rang: 1, name: 'Margherita', bestellungen: 34, kategorie: 'Pizza' },
    { rang: 2, name: 'Pasta Bolognese', bestellungen: 27, kategorie: 'Pasta' },
    { rang: 3, name: 'Caesar Salad', bestellungen: 19, kategorie: 'Salat' },
  ],
  zeitraum_label: 'heute',
  generiert_am: new Date().toISOString(),
};

const RANG_STYLE = [
  { bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-700', badge: 'bg-amber-400 text-amber-900' },
  { bg: 'bg-zinc-50 dark:bg-zinc-900/20',     border: 'border-zinc-200 dark:border-zinc-700',   badge: 'bg-zinc-400 text-zinc-900' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', badge: 'bg-orange-400 text-orange-900' },
];

const POLL_MS = 30 * 60 * 1000;

export function StorefrontPhase1716BeliebtsteGerichteStrip({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    setMounted(true);

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/beliebteste-gerichte?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch {
        /* keep mock */
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || !data.gerichte.length) return null;

  return (
    <div className={cn('py-3', className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2 px-1">
        <Flame className="h-3.5 w-3.5 text-orange-500" />
        Beliebt {data.zeitraum_label}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {data.gerichte.slice(0, 3).map((g, i) => {
          const style = RANG_STYLE[i] ?? RANG_STYLE[2];
          return (
            <div
              key={g.rang}
              className={cn(
                'flex-shrink-0 rounded-xl border px-3 py-2 min-w-[120px] max-w-[160px]',
                style.bg, style.border,
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black', style.badge)}>
                  #{g.rang}
                </span>
                {g.kategorie && (
                  <span className="text-[9px] text-muted-foreground truncate ml-1">{g.kategorie}</span>
                )}
              </div>
              <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{g.name}</p>
              <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-1">
                <ShoppingBag className="h-2.5 w-2.5" />
                {g.bestellungen}×
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
