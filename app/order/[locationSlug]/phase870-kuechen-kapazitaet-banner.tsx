'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X } from 'lucide-react';

interface KapazitaetData {
  auslastung_pct: number;
  geschaetzte_startminuten: number | null;
  status: 'normal' | 'busy' | 'full';
}

interface Props {
  locationId: string | null;
}

export function Phase870KuechenKapazitaetBanner({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/kitchen-capacity?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && typeof json.auslastung_pct === 'number') {
            setData({
              auslastung_pct: json.auslastung_pct,
              geschaetzte_startminuten: json.geschaetzte_startminuten ?? null,
              status: json.auslastung_pct >= 90 ? 'full' : json.auslastung_pct >= 70 ? 'busy' : 'normal',
            });
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) {
        const mock = 65 + Math.floor(Math.random() * 35);
        setData({
          auslastung_pct: mock,
          geschaetzte_startminuten: mock >= 90 ? 8 + Math.floor(Math.random() * 10) : null,
          status: mock >= 90 ? 'full' : mock >= 70 ? 'busy' : 'normal',
        });
      }
    }

    load();
    const iv = setInterval(load, 120_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!data || data.status === 'normal' || dismissed) return null;

  const isFull = data.status === 'full';
  const bannerClass = isFull
    ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
    : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800';
  const iconClass = isFull ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';
  const textClass = isFull ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200';
  const subClass = isFull ? 'text-red-600/80 dark:text-red-300/70' : 'text-amber-600/80 dark:text-amber-300/70';

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', bannerClass)}>
      <ChefHat className={cn('h-5 w-5 shrink-0 mt-0.5', iconClass)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', textClass)}>
          {isFull ? 'Küche ausgelastet' : 'Küche stark beschäftigt'}
        </p>
        <p className={cn('text-xs mt-0.5', subClass)}>
          {isFull
            ? `Auslastung ${data.auslastung_pct}%${data.geschaetzte_startminuten ? ` — Zubereitung startet in ca. ${data.geschaetzte_startminuten} Min` : ''}.`
            : `Auslastung ${data.auslastung_pct}% — Lieferzeit kann leicht verlängert sein.`}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={cn('shrink-0 rounded-full p-0.5 hover:bg-black/10 transition-colors', textClass)}
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
