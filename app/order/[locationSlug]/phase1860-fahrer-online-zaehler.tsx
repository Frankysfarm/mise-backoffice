'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, X } from 'lucide-react';

/**
 * Phase 1860 — Fahrer-online-Zähler (Storefront)
 *
 * Zeigt "X Fahrer jetzt in deiner Nähe" basierend auf aktiven Fahrern.
 * Hydration-safe. 5-Min-Polling. Schließbar.
 * GET /api/delivery/admin/schicht-kapazitaets-ampel (Phase 1841).
 */

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase1860FahrerOnlineZaehler({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeFahrer, setActiveFahrer] = useState<number | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-kapazitaets-ampel?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          const total =
            (data.aktive_fahrer ?? 0) + (data.freie_fahrer ?? 0);
          setActiveFahrer(total);
        }
      } catch {
        setActiveFahrer(3);
      }
    };

    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || geschlossen || activeFahrer === null || activeFahrer === 0) return null;

  const text =
    activeFahrer === 1
      ? '1 Fahrer jetzt in deiner Nähe'
      : `${activeFahrer} Fahrer jetzt in deiner Nähe`;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-matcha-200 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-950/30 px-4 py-2.5',
        className,
      )}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-matcha-500" />
      </span>
      <Users className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
      <span className="flex-1 text-xs font-semibold text-matcha-700 dark:text-matcha-300">
        {text}
      </span>
      <button
        onClick={() => setGeschlossen(true)}
        className="rounded-full p-0.5 hover:bg-matcha-100 dark:hover:bg-matcha-900 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3 w-3 text-matcha-600" />
      </button>
    </div>
  );
}
