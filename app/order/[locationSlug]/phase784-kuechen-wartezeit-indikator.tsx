'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KapazitaetsData {
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  inZubereitung: number;
  fertigWartend: number;
  prognoseWarteMin: number;
}

interface Props {
  locationId: string;
}

export function Phase784KuechenWartezeitIndikator({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetsData | null>(null);

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
        if (json.ok && active) setData(json);
      } catch {}
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;

  const { signal, prognoseWarteMin, offeneBestellungen } = data;

  const meta = {
    grün: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'Küche frei',
      sublabel: 'Bestellung wird schnell zubereitet',
    },
    gelb: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      label: 'Küche beschäftigt',
      sublabel: 'Etwas längere Zubereitung möglich',
    },
    rot: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      dot: 'bg-red-500',
      label: 'Küche ausgelastet',
      sublabel: 'Bitte etwas mehr Zeit einplanen',
    },
  }[signal];

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-3', meta.bg)}>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn('relative flex h-2 w-2')}>
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
          <span className={cn('relative inline-flex rounded-full h-2 w-2', meta.dot)} />
        </span>
        <Clock className={cn('h-3.5 w-3.5 shrink-0', meta.text)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold leading-tight', meta.text)}>{meta.label}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{meta.sublabel}</div>
      </div>

      <div className="shrink-0 text-right">
        <div className={cn('text-sm font-black tabular-nums', meta.text)}>
          ~{prognoseWarteMin} Min
        </div>
        <div className="text-[9px] text-muted-foreground">
          {offeneBestellungen} off. Best.
        </div>
      </div>
    </div>
  );
}
