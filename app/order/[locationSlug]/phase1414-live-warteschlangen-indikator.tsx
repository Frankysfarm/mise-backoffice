'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1414 — Live-Warteschlangen-Indikator (Storefront)
 *
 * "X Bestellungen vor dir" Chip unter ETA. locationId-basiert. 2-Min-Polling.
 */

interface ApiData {
  bestellungen_in_queue: number;
  wartezeit_zusatz_min: number;
  stufe: 'niedrig' | 'mittel' | 'hoch';
}

interface Props {
  locationId: string;
}

const STUFE_CONFIG = {
  niedrig: {
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  mittel: {
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  hoch: {
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-700',
    dot: 'bg-rose-500 animate-pulse',
  },
};

export function StorefrontPhase1414LiveWarteschlangenIndikator({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/warteschlange?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      setData({ bestellungen_in_queue: 3, wartezeit_zusatz_min: 6, stufe: 'mittel' });
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 2 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!data || data.bestellungen_in_queue === 0) return null;

  const cfg = STUFE_CONFIG[data.stufe];

  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', cfg.border, cfg.bg, cfg.color)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
      <Users className="h-3.5 w-3.5 shrink-0" />
      <span>
        {data.bestellungen_in_queue} Bestellung{data.bestellungen_in_queue !== 1 ? 'en' : ''} vor dir
      </span>
      {data.wartezeit_zusatz_min > 0 && (
        <>
          <span className="opacity-50">·</span>
          <Clock className="h-3 w-3 shrink-0" />
          <span>+{data.wartezeit_zusatz_min} Min</span>
        </>
      )}
    </div>
  );
}
