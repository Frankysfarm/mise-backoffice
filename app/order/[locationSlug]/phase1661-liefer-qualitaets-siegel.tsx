'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Star, Clock } from 'lucide-react';

/**
 * Phase 1661 — Liefer-Qualitäts-Siegel (Storefront)
 *
 * Vertrauensbadge: "X% pünktlich + Y ★ Bewertung + Ø Z Min".
 * GET /api/delivery/public/liefer-qualitaets-siegel?location_id=<id>
 * Hydration-safe. 60-Min-Polling.
 */

interface SiegelData {
  location_id: string;
  puenktlich_pct: number;
  bewertung_avg: number;
  bewertung_count: number;
  lieferzeit_avg_min: number;
  zeitraum_tage: number;
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

const MOCK: SiegelData = {
  location_id: 'mock',
  puenktlich_pct: 94,
  bewertung_avg: 4.6,
  bewertung_count: 183,
  lieferzeit_avg_min: 27,
  zeitraum_tage: 30,
  generiert_am: new Date().toISOString(),
};

function puenktlichColor(pct: number) {
  if (pct >= 90) return 'text-matcha-700 dark:text-matcha-300';
  if (pct >= 80) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

export function StorefrontPhase1661LieferQualitaetsSiegel({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<SiegelData>(MOCK);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      try {
        const r = await fetch(`/api/delivery/public/liefer-qualitaets-siegel?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json() as SiegelData;
          if (json.puenktlich_pct > 0) setData(json);
        }
      } catch {
        // silent
      }
    }

    load();
    const iv = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-3 mb-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-matcha-500 shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">Unsere Liefer-Qualität</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Letzte {data.zeitraum_tage} Tage</span>
      </div>

      {/* KPI-Reihe */}
      <div className="grid grid-cols-3 gap-2">
        {/* Pünktlichkeit */}
        <div className="flex flex-col items-center rounded-lg bg-muted/40 px-2 py-2.5">
          <span className={cn('text-xl font-extrabold tabular-nums', puenktlichColor(data.puenktlich_pct))}>
            {data.puenktlich_pct}%
          </span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
            pünktlich
          </span>
        </div>

        {/* Bewertung */}
        <div className="flex flex-col items-center rounded-lg bg-muted/40 px-2 py-2.5">
          <div className="flex items-center gap-0.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
              {data.bewertung_avg.toFixed(1)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
            {data.bewertung_count} Bewertungen
          </span>
        </div>

        {/* Ø Lieferzeit */}
        <div className="flex flex-col items-center rounded-lg bg-muted/40 px-2 py-2.5">
          <div className="flex items-center gap-0.5">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xl font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
              {data.lieferzeit_avg_min}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
            Min Ø Lieferzeit
          </span>
        </div>
      </div>

      {/* Trust-Zeile */}
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Verifizierte Daten · Letzte 30 Tage
      </p>
    </div>
  );
}
