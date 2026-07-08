'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface KapazitaetData {
  ok: boolean;
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  prognoseWarteMin: number;
}

interface Props {
  locationId: string;
}

type AmpelZustand = 'grün' | 'gelb' | 'rot';

const AMPEL_CONFIG: Record<AmpelZustand, {
  label: string;
  sublabel: string;
  dot: string;
  border: string;
  bg: string;
  text: string;
}> = {
  grün: {
    label: 'Küche frei',
    sublabel: 'Kurze Wartezeit',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  gelb: {
    label: 'Mäßig ausgelastet',
    sublabel: 'Etwas längere Wartezeit',
    dot: 'bg-amber-400',
    border: 'border-amber-200 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-500',
  },
  rot: {
    label: 'Küche stark ausgelastet',
    sublabel: 'Längere Wartezeit möglich',
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-700',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
  },
};

export function Phase668BestellStatusAmpel({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`
        );
        const json = await res.json() as KapazitaetData;
        if (active && json.ok) setData(json);
      } catch {
        // noop
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;

  const cfg = AMPEL_CONFIG[data.signal] ?? AMPEL_CONFIG.grün;

  return (
    <div className={cn('rounded-lg border px-3 py-2 flex items-center gap-2.5', cfg.bg, cfg.border)}>
      {/* Ampel-Dot */}
      <div className="shrink-0 flex items-center justify-center">
        <span className="relative flex h-3 w-3">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-50', cfg.dot)} />
          <span className={cn('relative inline-flex rounded-full h-3 w-3', cfg.dot)} />
        </span>
      </div>

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</div>
        <div className="text-[10px] text-muted-foreground">
          {cfg.sublabel}
          {data.prognoseWarteMin > 0 && ` · ~${data.prognoseWarteMin} Min`}
        </div>
      </div>

      {/* Live-Chip */}
      <div className="shrink-0 flex items-center gap-1 text-[9px] text-muted-foreground/60">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        Live
      </div>
    </div>
  );
}
