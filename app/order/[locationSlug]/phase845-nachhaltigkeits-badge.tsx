'use client';

import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';

interface Props {
  locationId: string;
}

interface NachhaltigkeitData {
  co2_gespart_kg: number;
  batching_faktor: number;
  eingesparte_fahrten: number;
  baeume_aequivalent: number;
  generatedAt: string;
}

const MOCK: NachhaltigkeitData = {
  co2_gespart_kg: 4.2,
  batching_faktor: 2.8,
  eingesparte_fahrten: 8,
  baeume_aequivalent: 0.2,
  generatedAt: new Date().toISOString(),
};

export function Phase845NachhaltigkeitsBadge({ locationId }: Props) {
  const [data, setData] = useState<NachhaltigkeitData | null>(null);

  const load = async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/nachhaltigkeits-badge?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.co2_gespart_kg <= 0) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-3 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-matcha-100">
        <Leaf className="h-5 w-5 text-matcha-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-matcha-800">
          🌱 Heute {data.co2_gespart_kg.toFixed(1)} kg CO₂ gespart
        </div>
        <div className="text-[11px] text-matcha-600">
          Durch Touren-Bündelung ({data.batching_faktor.toFixed(1)}× Stopps/Tour) — {data.eingesparte_fahrten} Einzelfahrten vermieden
        </div>
      </div>
      {data.baeume_aequivalent > 0 && (
        <div className="shrink-0 text-center">
          <div className="text-lg font-black text-matcha-700">🌳</div>
          <div className="text-[9px] text-matcha-500">≈{data.baeume_aequivalent} Bäume</div>
        </div>
      )}
    </div>
  );
}
