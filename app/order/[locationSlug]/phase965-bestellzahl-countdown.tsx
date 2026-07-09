'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Flame, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Phase 965 — Bestellzahl-Countdown (Storefront)
 *
 * "Nur noch X Bestellungen heute" Dringlichkeits-Badge wenn Tages-Kapazität fast ausgeschöpft.
 * 5-Min-Polling. Nur sichtbar wenn fast_ausgeschoepft oder ausgeschoepft.
 */

interface Props {
  locationId: string;
}

interface KapazitaetData {
  bestellungen_heute: number;
  kapazitaet_max: number;
  verbleibend: number;
  auslastung_pct: number;
  status: 'offen' | 'fast_ausgeschoepft' | 'ausgeschoepft';
}

export function Phase965BestellzahlCountdown({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetData | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/storefront/tages-kapazitaet?location_id=${locationId}`);
        if (!res.ok) return;
        const json: KapazitaetData = await res.json();
        setData(json);
      } catch {
        // silent
      }
    };

    laden();
    const interval = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationId]);

  if (!data || data.status === 'offen') return null;

  const ausgeschoepft = data.status === 'ausgeschoepft';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium',
        ausgeschoepft
          ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
          : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
      )}
    >
      {ausgeschoepft ? (
        <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
      ) : (
        <Flame className="h-4 w-4 shrink-0 animate-pulse" />
      )}
      <span>
        {ausgeschoepft
          ? 'Tages-Kapazität erschöpft — keine weiteren Bestellungen möglich.'
          : `Nur noch ${data.verbleibend} ${data.verbleibend === 1 ? 'Bestellung' : 'Bestellungen'} für heute verfügbar!`}
      </span>
      {!ausgeschoepft && (
        <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
          {data.auslastung_pct}%
        </span>
      )}
    </div>
  );
}
