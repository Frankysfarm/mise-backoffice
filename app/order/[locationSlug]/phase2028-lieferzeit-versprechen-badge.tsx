'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

interface BadgeData {
  min_low: number;
  min_high: number;
}

const POLL_MS = 10 * 60 * 1000;
const BASE_MIN = 25;
const BASE_RANGE = 10;

export function StorefrontPhase2028LieferzeitVersprechenBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [badge, setBadge] = useState<BadgeData>({ min_low: BASE_MIN, min_high: BASE_MIN + BASE_RANGE });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [effizienzRes, auslastungRes] = await Promise.all([
          fetch(`/api/delivery/admin/tour-effizienz?location_id=${locationId}`),
          fetch(`/api/delivery/admin/fahrer-auslastungs-matrix?location_id=${locationId}`),
        ]);

        let effizienzIndex = 70;
        let auslastungPct = 50;

        if (effizienzRes.ok) {
          const ej = await effizienzRes.json();
          effizienzIndex = ej.effizienz_index ?? 70;
        }

        if (auslastungRes.ok) {
          const aj = await auslastungRes.json();
          const last = (aj.stunden ?? [])[((aj.stunden ?? []).length - 1)];
          const total = (last?.aktiv ?? 0) + (last?.pause ?? 0) + (last?.verfuegbar ?? 0);
          auslastungPct = total > 0 ? Math.round(((last?.aktiv ?? 0) / total) * 100) : 50;
        }

        // Higher efficiency → lower delivery time; higher load → higher delivery time
        const efficiencyBonus = Math.round((effizienzIndex - 70) / 10); // -ve adds time
        const loadPenalty = Math.round((auslastungPct - 50) / 10);      // +ve adds time

        const low = Math.max(15, BASE_MIN - efficiencyBonus + loadPenalty);
        const high = low + BASE_RANGE;

        if (!cancelled) setBadge({ min_low: low, min_high: high });
      } catch {
        // keep defaults
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!mounted) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border border-matcha-200 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-900/30 px-3 py-1.5',
      className,
    )}>
      <Clock className="h-3.5 w-3.5 text-matcha-600 dark:text-matcha-400 shrink-0" />
      <span className="text-xs font-semibold text-matcha-700 dark:text-matcha-300">
        Lieferung in {badge.min_low}–{badge.min_high} Min
      </span>
    </div>
  );
}
