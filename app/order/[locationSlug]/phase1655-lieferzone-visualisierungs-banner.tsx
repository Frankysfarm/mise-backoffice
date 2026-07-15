'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ZoneInfo {
  zone: 'A' | 'B' | 'C' | 'D' | null;
  eta_min: number;
  radius_km: number;
  beschreibung: string;
  verfuegbar: boolean;
}

interface Props {
  locationId: string;
}

const ZONE_STYLE: Record<'A' | 'B' | 'C' | 'D', { dot: string; bg: string; border: string; text: string; label: string }> = {
  A: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900', text: 'text-emerald-700 dark:text-emerald-400', label: 'Nähe' },
  B: { dot: 'bg-sky-500',     bg: 'bg-sky-50 dark:bg-sky-950/20',         border: 'border-sky-200 dark:border-sky-900',         text: 'text-sky-700 dark:text-sky-400',         label: 'Mittel' },
  C: { dot: 'bg-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/20',     border: 'border-amber-200 dark:border-amber-900',     text: 'text-amber-700 dark:text-amber-400',     label: 'Weiter' },
  D: { dot: 'bg-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/20',   border: 'border-orange-200 dark:border-orange-900',   text: 'text-orange-700 dark:text-orange-400',   label: 'Rand' },
};

function buildMock(locationId: string): ZoneInfo {
  const seed = locationId.charCodeAt(0) % 4;
  const zones = ['A', 'B', 'C', 'D'] as const;
  const zone = zones[seed];
  const etaMap = { A: 20, B: 30, C: 40, D: 50 };
  const radiusMap = { A: 3, B: 5, C: 8, D: 12 };
  return {
    zone,
    eta_min: etaMap[zone],
    radius_km: radiusMap[zone],
    beschreibung: `Zone ${zone} — innerhalb ${radiusMap[zone]} km`,
    verfuegbar: true,
  };
}

export function StorefrontPhase1655LieferzoneVisualisierungsBanner({ locationId }: Props) {
  const [data, setData] = useState<ZoneInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(`lieferzone_dismiss:${locationId}`);
      if (stored && Date.now() - Number(stored) < 60 * 60_000) {
        setDismissed(true);
        return;
      }
    } catch { /* ignore */ }

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/lieferzone-info?location_id=${locationId}`);
        if (res.ok) { setData(await res.json()); return; }
      } catch { /* ignore */ }
      setData(buildMock(locationId));
    };
    load();

    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted || dismissed || !data || !data.verfuegbar || !data.zone) return null;

  const style = ZONE_STYLE[data.zone];

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-3', style.bg, style.border)}>
      {/* Zone-Badge */}
      <div className="flex shrink-0 flex-col items-center gap-0.5 mt-0.5">
        <span className={cn('h-3 w-3 rounded-full', style.dot)} />
        <span className={cn('text-[11px] font-black', style.text)}>Zone {data.zone}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-foreground">Liefergebiet erkannt</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{data.beschreibung}</div>

        {/* ETA + Zonen-Leiste */}
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('text-xs font-bold', style.text)}>ca. {data.eta_min} Min Lieferzeit</span>
          <div className="flex gap-0.5">
            {(['A', 'B', 'C', 'D'] as const).map((z) => (
              <div
                key={z}
                className={cn(
                  'h-1.5 w-5 rounded-sm transition-all',
                  z === data.zone ? ZONE_STYLE[z].dot : 'bg-muted',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(`lieferzone_dismiss:${locationId}`, String(Date.now())); } catch { /* ignore */ }
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground text-lg leading-none"
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  );
}
