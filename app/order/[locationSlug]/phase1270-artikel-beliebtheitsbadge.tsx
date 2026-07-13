'use client';

// Phase 1270 — Artikel-Beliebtheitsbadge (Storefront)
// "Heute bereits X× bestellt" Badge auf Top-3-Artikeln der letzten 2h
// Props: locationId · 10-Min-Polling

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface BeliebtheitArtikel {
  name: string;
  bestellungen_2h: number;
}

interface BeliebtheitData {
  top_artikel: BeliebtheitArtikel[];
  generiert_am: string;
}

interface Props {
  locationId: string;
  artikelName: string;
}

// Cache globally so all badge instances share the same fetch
let _cache: { data: BeliebtheitData | null; ts: number; locationId: string } | null = null;

async function fetchBeliebtheit(locationId: string): Promise<BeliebtheitData | null> {
  const now = Date.now();
  if (_cache && _cache.locationId === locationId && now - _cache.ts < 10 * 60 * 1000) {
    return _cache.data;
  }
  try {
    const res = await fetch(`/api/delivery/public/artikel-beliebtheit?location_id=${locationId}`);
    if (!res.ok) return null;
    const data: BeliebtheitData = await res.json();
    _cache = { data, ts: now, locationId };
    return data;
  } catch {
    return null;
  }
}

export function Phase1270ArtikelBeliebtheitsBadge({ locationId, artikelName }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchBeliebtheit(locationId);
      if (cancelled) return;
      const match = data?.top_artikel.find(
        a => a.name.toLowerCase().trim() === artikelName.toLowerCase().trim()
      );
      setCount(match?.bestellungen_2h ?? null);
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId, artikelName]);

  if (!count) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
      <Flame className="h-2.5 w-2.5" />
      {count}× in 2h bestellt
    </span>
  );
}
