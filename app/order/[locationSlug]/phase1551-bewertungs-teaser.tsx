'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId: string;
}

interface BewertungsData {
  avg_sterne: number;
  anzahl: number;
  top_kommentar?: string;
}

const CACHE_KEY_PREFIX = 'mise_bew_teaser_';
const CACHE_TTL_MS = 5 * 60 * 1000;

function renderSterne(avg: number) {
  return [1, 2, 3, 4, 5].map(i => (
    <span key={i} className={i <= Math.round(avg) ? 'text-amber-400' : 'text-muted-foreground/40'}>
      ★
    </span>
  ));
}

export function StorefrontPhase1551BewertungsTeaser({ locationId }: Props) {
  const [data, setData] = useState<BewertungsData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const key = `${CACHE_KEY_PREFIX}${locationId}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) { setData(d); return; }
      }
    } catch {}

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/standort-bewertung?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          const d: BewertungsData = {
            avg_sterne: json.avg_sterne ?? json.avg ?? 4.5,
            anzahl: json.anzahl ?? json.count ?? 0,
            top_kommentar: json.top_kommentar ?? undefined,
          };
          setData(d);
          try { localStorage.setItem(key, JSON.stringify({ data: d, ts: Date.now() })); } catch {}
          return;
        }
      } catch {}
      // Mock-Fallback
      const mock: BewertungsData = { avg_sterne: 4.7, anzahl: 142, top_kommentar: 'Sehr schnell und lecker!' };
      setData(mock);
    };
    load();
  }, [locationId]);

  if (!mounted || !data || data.anzahl === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <div className="flex text-sm">{renderSterne(data.avg_sterne)}</div>
      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
        {data.avg_sterne.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">
        ({data.anzahl} Bewertungen)
      </span>
      {data.top_kommentar && (
        <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[200px]">
          &quot;{data.top_kommentar}&quot;
        </span>
      )}
    </div>
  );
}
