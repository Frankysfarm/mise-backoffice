'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Leaf, X } from 'lucide-react';

/**
 * Phase 1770 — Nachhaltigkeits-Liefer-Badge (Storefront)
 *
 * "Klimaoptimierte Lieferung" wenn Tour-Auslastung ≥80% (min. 3 Stopps/Tour Ø);
 * 60-Min-Polling; Hydration-safe; schließbar.
 */

interface TourAuslastungsStatus {
  klimaoptimiert: boolean;
  avg_stopps_pro_tour: number;
  auslastung_pct: number;
  aktive_touren: number;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase1770NachhaltigkeitsLieferBadge({ locationId, className }: Props) {
  const [data, setData] = useState<TourAuslastungsStatus | null>(null);
  const [closed, setClosed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/delivery/public/tour-auslastungs-status?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!mounted) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, locationId]);

  if (!mounted || !data || !data.klimaoptimiert || closed) return null;

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3',
      className,
    )}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-800/60">
        <Leaf className="h-4 w-4 text-green-600 dark:text-green-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-green-800 dark:text-green-200">
          Klimaoptimierte Lieferung
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
          Deine Bestellung wird gebündelt geliefert — weniger Fahrten, weniger CO₂.
          Heute Ø {data.avg_stopps_pro_tour.toFixed(1)} Stopps je Tour ({data.auslastung_pct}% Auslastung).
        </p>
      </div>

      <button
        onClick={() => setClosed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-green-100 dark:hover:bg-green-800/40 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-4 w-4 text-green-600 dark:text-green-400" />
      </button>
    </div>
  );
}
