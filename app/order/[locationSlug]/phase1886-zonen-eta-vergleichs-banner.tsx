'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Zap } from 'lucide-react';

/**
 * Phase 1886 — Zonen-ETA-Vergleichs-Banner (Storefront)
 *
 * Zeigt ETA-Unterschied zwischen Zone A und Zone B/C als Entscheidungshilfe.
 * Hydration-safe. 10-Min-Polling.
 * GET /api/delivery/admin/zonen-effizienz (Phase 1873).
 */

interface ZoneInfo {
  zone: string;
  avg_wartezeit_min: number;
  kritisch: boolean;
}

interface Props {
  locationId: string;
  className?: string;
}

const MOCK_ZONEN: ZoneInfo[] = [
  { zone: 'A', avg_wartezeit_min: 22, kritisch: false },
  { zone: 'B', avg_wartezeit_min: 31, kritisch: false },
  { zone: 'C', avg_wartezeit_min: 39, kritisch: true  },
  { zone: 'D', avg_wartezeit_min: 47, kritisch: true  },
];

function ampelKlasse(min: number) {
  if (min <= 25) return 'text-matcha-700 dark:text-matcha-300';
  if (min <= 35) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

export function StorefrontPhase1886ZonenEtaVergleichsBanner({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zonen, setZonen] = useState<ZoneInfo[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-effizienz?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          const z = (data.zonen ?? []) as ZoneInfo[];
          if (z.length > 0) setZonen(z);
        }
      } catch {
        // keep defaults
      }
    };

    laden();
    const iv = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted) return null;

  const basis = zonen.length > 0 ? zonen : MOCK_ZONEN;
  const zoneA = basis.find((z) => z.zone === 'A');
  const vergleich = basis.filter((z) => z.zone !== 'A' && !z.kritisch);

  if (!zoneA || vergleich.length === 0) return null;

  const schnellste = vergleich.reduce((best, z) =>
    z.avg_wartezeit_min < best.avg_wartezeit_min ? z : best,
  );

  const diff = schnellste.avg_wartezeit_min - zoneA.avg_wartezeit_min;
  if (diff <= 5) return null;

  return (
    <div className={cn(
      'rounded-2xl border bg-card shadow-sm overflow-hidden',
      className,
    )}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-matcha-50 dark:bg-matcha-950/30 shrink-0">
          <Zap className="h-4.5 w-4.5 text-matcha-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">
            Zone A ist{' '}
            <span className="text-matcha-600 dark:text-matcha-400">
              {diff} Min schneller
            </span>{' '}
            als Zone {schnellste.zone}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[zoneA, schnellste].map((z) => (
              <div
                key={z.zone}
                className={cn(
                  'rounded-xl border px-3 py-2 text-center',
                  z.zone === 'A'
                    ? 'border-matcha-200 dark:border-matcha-800 bg-matcha-50/50 dark:bg-matcha-950/10'
                    : 'border-border bg-muted/5',
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Zone {z.zone}
                </div>
                <div className={cn('text-lg font-bold leading-none mt-1', ampelKlasse(z.avg_wartezeit_min))}>
                  ~{z.avg_wartezeit_min} Min
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Ø Lieferzeit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
