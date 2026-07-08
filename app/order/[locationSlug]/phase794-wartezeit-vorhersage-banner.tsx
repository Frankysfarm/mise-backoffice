'use client';

import { useEffect, useState } from 'react';
import { Clock, ChefHat, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KapazitaetData {
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  inZubereitung: number;
  fertigWartend: number;
  prognoseWarteMin: number;
}

interface Props {
  locationId: string;
}

export function Phase794WartezeitVorhersageBanner({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {}
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;

  const { signal, prognoseWarteMin, offeneBestellungen, inZubereitung } = data;

  type SignalKey = 'grün' | 'gelb' | 'rot';

  const config: Record<SignalKey, {
    bg: string;
    border: string;
    dot: string;
    textPrimary: string;
    textSecondary: string;
    headline: string;
    subline: string;
    icon: React.ReactNode;
  }> = {
    grün: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      textPrimary: 'text-emerald-800 dark:text-emerald-300',
      textSecondary: 'text-emerald-600 dark:text-emerald-400',
      headline: 'Küche frei — schnelle Zubereitung',
      subline: 'Deine Bestellung wird sofort gestartet.',
      icon: <Zap className="h-4 w-4 text-emerald-500" />,
    },
    gelb: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      textPrimary: 'text-amber-800 dark:text-amber-300',
      textSecondary: 'text-amber-600 dark:text-amber-400',
      headline: 'Küche beschäftigt',
      subline: 'Etwas mehr Wartezeit möglich. Wir geben Gas!',
      icon: <ChefHat className="h-4 w-4 text-amber-500" />,
    },
    rot: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      dot: 'bg-red-500',
      textPrimary: 'text-red-800 dark:text-red-300',
      textSecondary: 'text-red-600 dark:text-red-400',
      headline: 'Küche stark ausgelastet',
      subline: 'Bitte etwas Geduld — wir kümmern uns.',
      icon: <Clock className="h-4 w-4 text-red-500" />,
    },
  };

  const c = config[signal];

  return (
    <div className={cn('rounded-xl border px-3.5 py-3 flex items-center gap-3', c.bg, c.border)}>
      {/* Animated dot + icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', c.dot)} />
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', c.dot)} />
        </span>
        {c.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold leading-tight', c.textPrimary)}>{c.headline}</div>
        <div className={cn('text-[10px] leading-tight mt-0.5', c.textSecondary)}>{c.subline}</div>
        {offeneBestellungen > 0 && (
          <div className={cn('text-[9px] mt-1 opacity-75', c.textSecondary)}>
            {inZubereitung} in Zubereitung · {offeneBestellungen} insgesamt offen
          </div>
        )}
      </div>

      {/* ETA */}
      <div className="shrink-0 text-right">
        <div className={cn('text-lg font-black tabular-nums leading-none', c.textPrimary)}>
          ~{prognoseWarteMin}
        </div>
        <div className={cn('text-[9px] uppercase tracking-wide', c.textSecondary)}>Min Küche</div>
      </div>
    </div>
  );
}
