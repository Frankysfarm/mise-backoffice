'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudRain, CloudLightning, Wind, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1385 — Wetter-Lieferzeit-Hinweis (Storefront)
 *
 * Bei schlechtem Wetter (Regen/Sturm): Banner mit +5–10 Min Lieferzeit-Hinweis.
 * Nutzt /api/delivery/public/wetter-status?location_id=...
 * Fallback: localStorage-Flag wenn kein API-Zugriff.
 * Dismissbar. Nach Phase1380 in storefront.tsx.
 */

type WetterTyp = 'regen' | 'sturm' | 'wind' | 'klar';

interface WetterData {
  typ: WetterTyp;
  beschreibung: string;
  extra_minuten: number;
  aktiv: boolean;
}

interface Props {
  locationId: string;
}

const WETTER_CONFIG: Record<WetterTyp, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  sturm: {
    icon: <CloudLightning className="h-4 w-4" />,
    label: 'Sturm',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
  },
  regen: {
    icon: <CloudRain className="h-4 w-4" />,
    label: 'Regen',
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/20',
    border: 'border-sky-200 dark:border-sky-800',
  },
  wind: {
    icon: <Wind className="h-4 w-4" />,
    label: 'Starker Wind',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-200 dark:border-slate-700',
  },
  klar: {
    icon: <Cloud className="h-4 w-4" />,
    label: 'Klar',
    color: 'text-slate-500',
    bg: 'bg-white',
    border: 'border-slate-100',
  },
};

export function StorefrontPhase1385WetterLieferzeitHinweis({ locationId }: Props) {
  const [wetter, setWetter] = useState<WetterData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/wetter-status?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      setWetter(await res.json());
    } catch {
      // Fallback: einfache Heuristik — Banner nur bei bekannten Schlechtwetter-Stunden (Abend-Rush) nicht anzeigen
      // Kein Wetter → kein Banner (silent fail ist OK für Storefront)
      setWetter(null);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!wetter || !wetter.aktiv || wetter.typ === 'klar' || dismissed) return null;

  const cfg = WETTER_CONFIG[wetter.typ];

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', cfg.bg, cfg.border)}>
      <span className={cfg.color}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', cfg.color)}>
          {cfg.label} — Lieferzeit +{wetter.extra_minuten} Min.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {wetter.beschreibung
            ? wetter.beschreibung
            : `Wegen ${cfg.label.toLowerCase()} kann es zu leichten Verzögerungen kommen. Wir geben unser Bestes!`}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Schließen"
        className={cn('flex-shrink-0 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10', cfg.color)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
