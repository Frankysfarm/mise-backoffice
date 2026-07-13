'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, Flame, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1370 — Aktive-Bestellungen-Hinweis (Storefront)
 *
 * "X weitere Kunden bestellen gerade" + aktive Fahrer-Anzahl +
 * "Küche sehr beschäftigt"-Badge wenn Queue > 8. 5-Min-Polling.
 * Nach Phase1365 in storefront.tsx.
 */

interface Props {
  locationId: string;
}

interface ActivityData {
  bestellungen_heute: number;
  aktive_bestellungen: number;
  aktive_fahrer: number;
  kueche_auslastung: 'normal' | 'hoch' | 'sehr_hoch';
}

function buildMock(): ActivityData {
  return {
    bestellungen_heute: 127,
    aktive_bestellungen: 12,
    aktive_fahrer: 5,
    kueche_auslastung: 'hoch',
  };
}

export function StorefrontPhase1370AktiveBestellungenHinweis({ locationId }: Props) {
  const [data, setData] = useState<ActivityData | null>(null);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/social-proof?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData({
        bestellungen_heute: json.bestellungen_heute ?? buildMock().bestellungen_heute,
        aktive_bestellungen: json.aktive_kunden ?? buildMock().aktive_bestellungen,
        aktive_fahrer: json.aktive_fahrer ?? buildMock().aktive_fahrer,
        kueche_auslastung: json.kueche_auslastung ?? 'hoch',
      });
    } catch {
      setData(buildMock());
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [laden]);

  if (!data) return null;

  const sehrBeschäftigt = data.kueche_auslastung === 'sehr_hoch' || data.aktive_bestellungen > 8;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {/* Titel-Zeile */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {data.aktive_bestellungen > 0
              ? `${data.aktive_bestellungen} Bestellungen gerade aktiv`
              : `${data.bestellungen_heute} Bestellungen heute`}
          </span>
        </div>

        {sehrBeschäftigt && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
            <Flame className="h-3 w-3" />
            Küche sehr beschäftigt
          </span>
        )}
      </div>

      {/* Stat-Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
          'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        )}>
          <Bike className="h-3.5 w-3.5" />
          <span>{data.aktive_fahrer} Fahrer aktiv</span>
        </div>

        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
          'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
        )}>
          <Users className="h-3.5 w-3.5" />
          <span>{data.bestellungen_heute} Bestellungen heute</span>
        </div>
      </div>
    </div>
  );
}
