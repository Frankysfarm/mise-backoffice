'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Clock } from 'lucide-react';

interface WetterInfo {
  etaFactor: number;
  weatherDesc: string | null;
  isDangerous: boolean;
  extraMin: number; // estimated extra minutes for a typical 30-min delivery
}

export function WetterLieferverzugHinweis({ locationId }: { locationId?: string | null }) {
  const [info, setInfo] = useState<WetterInfo | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/weather-intelligence?action=dashboard&location_id=${locationId}`);
        if (!res.ok || !mounted) return;
        const json = await res.json();
        const cur = json.current;
        if (!cur || !mounted) return;
        const extraMin = Math.round((cur.etaFactor - 1) * 30);
        setInfo({
          etaFactor: cur.etaFactor,
          weatherDesc: cur.weatherDesc,
          isDangerous: cur.isDangerous,
          extraMin,
        });
      } catch { /* ignore */ }
    }

    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  // Only show when weather meaningfully extends delivery times
  if (!info || info.etaFactor < 1.08) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <CloudRain className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-amber-800">
          {info.isDangerous ? 'Schlechtwetterwarnung' : 'Wetterbedingte Verzögerung'}
        </div>
        <div className="mt-0.5 text-amber-700">
          {info.weatherDesc ? `${info.weatherDesc} — ` : ''}
          Lieferzeiten können heute
          {info.extraMin > 0 ? ` ca. ${info.extraMin} Min` : ''} länger dauern.
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
          <Clock className="h-3 w-3" />
          Wir geben unser Bestes und halten dich auf dem Laufenden.
        </div>
      </div>
    </div>
  );
}
