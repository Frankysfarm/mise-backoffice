'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

/**
 * Phase 1726 — Dynamischer Liefer-ETA-Badge (Storefront)
 *
 * Einzel-Badge mit ETA-Minuten basierend auf Zone + aktueller Auslastung.
 * Keine Bestellnummer notwendig. 3-Min-Polling. Hydration-safe.
 */

interface Props {
  locationId: string;
  className?: string;
}

interface ZoneData {
  status: 'ok' | 'hoch' | 'kritisch';
  auslastungPct: number;
}

interface ApiResponse {
  ok: boolean;
  zonen?: ZoneData[];
  alarm?: boolean;
}

type EtaStufe = 'schnell' | 'normal' | 'langsam';

function calcEta(data: ApiResponse): { minuten: number; stufe: EtaStufe; label: string } {
  if (!data.ok || !data.zonen?.length) {
    return { minuten: 25, stufe: 'schnell', label: '~25 Min' };
  }
  const kritisch = data.zonen.filter(z => z.status === 'kritisch').length;
  const hoch = data.zonen.filter(z => z.status === 'hoch').length;
  const avgPct = data.zonen.reduce((s, z) => s + z.auslastungPct, 0) / data.zonen.length;

  if (kritisch > 0 || avgPct >= 100) {
    return { minuten: 45, stufe: 'langsam', label: '~45 Min' };
  }
  if (hoch > 0 || avgPct >= 70) {
    return { minuten: 35, stufe: 'normal', label: '~35 Min' };
  }
  return { minuten: 25, stufe: 'schnell', label: '~25 Min' };
}

const STUFE_STYLE: Record<EtaStufe, { bg: string; text: string; dot: string }> = {
  schnell: {
    bg:   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
    text: 'text-emerald-800 dark:text-emerald-200',
    dot:  'bg-emerald-500',
  },
  normal: {
    bg:   'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    text: 'text-amber-800 dark:text-amber-200',
    dot:  'bg-amber-500',
  },
  langsam: {
    bg:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200',
    dot:  'bg-red-500',
  },
};

const STUFE_SUBTEXT: Record<EtaStufe, string> = {
  schnell: 'Schnelle Lieferung',
  normal:  'Normale Lieferzeit',
  langsam: 'Erhöhte Nachfrage',
};

const POLL_MS = 3 * 60_000;

export function StorefrontPhase1726DynamischerLieferEtaBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [eta, setEta] = useState<{ minuten: number; stufe: EtaStufe; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${locationId}`);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setEta(calcEta(json));
      }
    } catch {
      setEta({ minuten: 25, stufe: 'schnell', label: '~25 Min' });
    }
  }, [locationId]);

  useEffect(() => {
    setMounted(true);
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!mounted || !eta) return null;

  const s = STUFE_STYLE[eta.stufe];

  return (
    <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5', s.bg, className)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', s.dot)} />
      <Clock className={cn('h-3.5 w-3.5 shrink-0', s.text)} />
      <span className={cn('text-sm font-bold font-mono', s.text)}>{eta.label}</span>
      <span className={cn('text-xs', s.text, 'opacity-75')}>— {STUFE_SUBTEXT[eta.stufe]}</span>
    </div>
  );
}
