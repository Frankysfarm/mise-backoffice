'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * Phase 1006 — Live-Küchen-Auslastungs-Anzeige (Storefront)
 *
 * Zeigt Kunden eine einfache Auslastungsampel (Niedrig/Normal/Hoch/Peak),
 * damit sie wissen, ob Wartezeiten länger sein könnten.
 * Polling: 3 Min.
 */

interface Props {
  locationId: string;
  className?: string;
}

interface AuslastungData {
  auslastung_pct: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'peak';
  aktive_bestellungen: number;
  erwartete_wartezeit_min: number;
}

const MOCK: AuslastungData = {
  auslastung_pct: 55,
  status: 'normal',
  aktive_bestellungen: 8,
  erwartete_wartezeit_min: 22,
};

type StatusMeta = {
  label: string;
  bg: string;
  text: string;
  dot: string;
  border: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  niedrig: {
    label: 'Küche frei',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
    border: 'border-green-200 dark:border-green-700',
  },
  normal: {
    label: 'Normale Auslastung',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-700',
  },
  hoch: {
    label: 'Küche ausgelastet',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-700',
  },
  peak: {
    label: 'Stoßzeit — längere Wartezeiten',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-700',
  },
};

export function StorefrontPhase1006KuechenAuslastungsAnzeige({ locationId, className }: Props) {
  const [data, setData] = useState<AuslastungData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-auslastung-live?location_id=${locationId}`,
        { cache: 'no-store' }
      );
      const json: AuslastungData = res.ok ? await res.json() : MOCK;
      setData(json);
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 180_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const meta = STATUS_META[data.status] ?? STATUS_META.normal;

  return (
    <div className={cn(
      'flex items-center justify-between rounded-xl border px-3 py-2.5',
      meta.bg, meta.border, className,
    )}>
      <div className="flex items-center gap-2.5">
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', meta.dot)} />
        </span>
        <div>
          <div className={cn('text-xs font-bold', meta.text)}>{meta.label}</div>
          <div className="text-[10px] text-muted-foreground">
            ca. {data.erwartete_wartezeit_min} Min Wartezeit
          </div>
        </div>
      </div>

      {/* Auslastungs-Balken */}
      <div className="flex flex-col items-end gap-1 shrink-0 w-20">
        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', meta.dot)}
            style={{ width: `${data.auslastung_pct}%` }}
          />
        </div>
        <span className={cn('text-[9px] font-bold tabular-nums', meta.text)}>
          {data.auslastung_pct}% ausgelastet
        </span>
      </div>
    </div>
  );
}
