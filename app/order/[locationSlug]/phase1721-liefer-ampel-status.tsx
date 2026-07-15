'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Phase 1721 — Liefer-Ampel-Status (Storefront)
 *
 * Kompakte Ampel (grün/gelb/rot) mit kurzem Statustext
 * basierend auf aktueller Systemlast aus liefergebiet-auslastung API.
 * 5-Min-Polling. Hydration-safe.
 */

type Ampel = 'gruen' | 'gelb' | 'rot';

interface Props {
  locationId: string;
  className?: string;
}

interface ApiResponse {
  ok: boolean;
  zonen: Array<{ status: 'ok' | 'hoch' | 'kritisch'; auslastungPct: number }>;
  alarm: boolean;
}

function calcAmpel(data: ApiResponse): { ampel: Ampel; text: string } {
  if (!data.ok || !data.zonen?.length) {
    return { ampel: 'gruen', text: 'Lieferung verfügbar' };
  }
  const kritisch = data.zonen.filter(z => z.status === 'kritisch').length;
  const hoch = data.zonen.filter(z => z.status === 'hoch').length;
  const avgPct = data.zonen.reduce((s, z) => s + z.auslastungPct, 0) / data.zonen.length;

  if (kritisch > 0 || avgPct >= 100) {
    return { ampel: 'rot', text: 'Hohe Nachfrage — etwas längere Lieferzeit' };
  }
  if (hoch > 0 || avgPct >= 70) {
    return { ampel: 'gelb', text: 'Mäßige Auslastung — normale Lieferzeit' };
  }
  return { ampel: 'gruen', text: 'Schnelle Lieferung verfügbar' };
}

const AMPEL_DOT: Record<Ampel, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-300',
  gelb:  'text-amber-700 dark:text-amber-300',
  rot:   'text-red-700 dark:text-red-300',
};

const AMPEL_BG: Record<Ampel, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
  gelb:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
  rot:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
};

export function StorefrontPhase1721LieferAmpelStatus({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<{ ampel: Ampel; text: string }>({ ampel: 'gruen', text: 'Lieferung verfügbar' });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) return;
      const json = await res.json() as ApiResponse;
      setStatus(calcAmpel(json));
    } catch {
      // silent — keep last known status
    }
  }, [locationId]);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
    const id = setInterval(fetchStatus, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  if (!mounted) return null;

  const { ampel, text } = status;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
      AMPEL_BG[ampel],
      className,
    )}>
      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0 animate-pulse', AMPEL_DOT[ampel])} />
      <span className={cn('font-medium text-xs', AMPEL_TEXT[ampel])}>{text}</span>
    </div>
  );
}
