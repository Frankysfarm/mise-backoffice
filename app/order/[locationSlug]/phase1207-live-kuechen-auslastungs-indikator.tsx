'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Phase 1207 — Live-Küchen-Auslastungs-Indikator (Storefront)
// Ampel (grün/gelb/rot) wie ausgelastet die Küche ist + Wartezeit-Schätzung

type AmpelStatus = 'gruen' | 'gelb' | 'rot';

interface ApiData {
  level: string;
  ampel: AmpelStatus;
  aktive_bestellungen: number;
  wartezeit_zusatz_min: number;
  wartezeit_text: string;
  location_id: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string;
}

const AMPEL_STYLES: Record<AmpelStatus, { dot: string; border: string; bg: string; text: string; label: string }> = {
  gruen: { dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Küche bereit' },
  gelb:  { dot: 'bg-amber-500',   border: 'border-amber-200 dark:border-amber-800',   bg: 'bg-amber-50 dark:bg-amber-950/20',   text: 'text-amber-700 dark:text-amber-400',   label: 'Gut ausgelastet' },
  rot:   { dot: 'bg-rose-500',    border: 'border-rose-200 dark:border-rose-800',    bg: 'bg-rose-50 dark:bg-rose-950/20',    text: 'text-rose-700 dark:text-rose-400',    label: 'Stark ausgelastet' },
};

export function Phase1207LiveKuechenAuslastungsIndikator({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.fetch(`/api/delivery/customer/kuechen-auslastung?location_id=${locationId}`);
      const json = await res.json();
      if (json.ampel) setData(json);
    } catch {
      /* silent */
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!data) return null;

  const s = AMPEL_STYLES[data.ampel];

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', s.border, s.bg)}>
      <span className={cn('h-3 w-3 rounded-full shrink-0 animate-pulse', s.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm font-bold', s.text)}>{s.label}</span>
          {data.wartezeit_zusatz_min > 0 && (
            <span className={cn('text-xs font-semibold shrink-0', s.text)}>
              +{data.wartezeit_zusatz_min} Min
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{data.wartezeit_text}</p>
      </div>
    </div>
  );
}
