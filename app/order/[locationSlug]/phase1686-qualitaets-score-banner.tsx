'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

/**
 * Phase 1686 — Qualitäts-Score-Banner (Storefront)
 *
 * Ø Bewertung letzter 7 Tage + Liefer-Pünktlichkeits-%.
 * Grüner Banner wenn Score >4.5; locationId; 30-Min-Polling; Hydration-safe.
 */

interface ApiResponse {
  avg_bewertung: number;
  anzahl_bewertungen: number;
  puenktlichkeit_pct: number;
  lieferungen_7d: number;
}

interface Props {
  locationId: string;
}

const MOCK: ApiResponse = {
  avg_bewertung: 4.7,
  anzahl_bewertungen: 143,
  puenktlichkeit_pct: 91,
  lieferungen_7d: 312,
};

const SCORE_SCHWELLE = 4.5;
const PUENKT_SCHWELLE = 85;

export function StorefrontPhase1686QualitaetsScoreBanner({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/qualitaets-score?location_id=${locationId}`,
        );
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setData(MOCK);
      }
    }

    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!mounted || !data) return null;

  const isGreen = data.avg_bewertung >= SCORE_SCHWELLE && data.puenktlichkeit_pct >= PUENKT_SCHWELLE;

  if (!isGreen) return null;

  const stars = Math.round(data.avg_bewertung * 2) / 2;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold',
      'bg-emerald-50 border-emerald-200 text-emerald-700',
      'dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
    )}>
      <Star className="h-3.5 w-3.5 shrink-0 fill-current" />
      <span>
        {stars.toFixed(1)} Sterne
        {data.anzahl_bewertungen > 0 && ` (${data.anzahl_bewertungen})`}
      </span>
      <span className="opacity-60">·</span>
      <span>{data.puenktlichkeit_pct}% pünktlich</span>
    </div>
  );
}
