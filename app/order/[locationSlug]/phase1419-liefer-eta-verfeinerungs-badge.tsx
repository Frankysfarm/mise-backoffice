'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1419 — Liefer-ETA-Verfeinerungs-Badge (Storefront)
 *
 * Zeigt verfeinerte ETA aus Phase1410-API (/api/delivery/public/eta-verfeinert)
 * als kompaktes Inline-Badge unter der Lieferzeitangabe.
 *
 * 5-Min-Polling. Nach Phase1414 in storefront.tsx.
 */

interface ApiData {
  basis_eta_min: number;
  verfeinerte_eta_min: number;
  faktoren: {
    wetter_zusatz: number;
    queue_zusatz: number;
    fahrer_abzug: number;
  };
  status: 'normal' | 'erhoecht' | 'hoch';
  hinweis: string | null;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string;
}

const STATUS_CONFIG = {
  normal: {
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  erhoecht: {
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

export function StorefrontPhase1419LieferEtaVerfeinerungsBadge({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/eta-verfeinert?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      // silent — badge is optional
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!data) return null;

  const cfg = STATUS_CONFIG[data.status];
  const delta = data.verfeinerte_eta_min - data.basis_eta_min;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium',
      cfg.color, cfg.bg, cfg.border
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      <Clock className="w-3 h-3 shrink-0" />
      <span>ca. {data.verfeinerte_eta_min} Min</span>
      {delta !== 0 && (
        <span className="flex items-center gap-0.5 opacity-75">
          <TrendingUp className={cn('w-3 h-3', delta < 0 ? 'rotate-180' : '')} />
          {delta > 0 ? `+${delta}` : delta} Min
        </span>
      )}
    </div>
  );
}
