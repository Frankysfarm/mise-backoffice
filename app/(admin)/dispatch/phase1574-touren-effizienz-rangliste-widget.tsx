'use client';

import React, { useEffect, useState } from 'react';

interface TourenEintrag {
  fahrer_id: string;
  fahrer_name: string;
  touren_anzahl: number;
  stopps_pro_tour: number;
  km_pro_stopp: number;
  puenktlichkeitsrate: number;
  rang: number;
  status: 'top' | 'normal' | 'schwach';
}

interface ApiResponse {
  fahrer: TourenEintrag[];
  zeitraum_tage: number;
}

interface Props {
  locationId: string | null;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  top: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Top' },
  normal: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Normal' },
  schwach: { badge: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Schwach' },
};

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller', touren_anzahl: 28, stopps_pro_tour: 4.2, km_pro_stopp: 1.8, puenktlichkeitsrate: 94, rang: 1, status: 'top' },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt', touren_anzahl: 25, stopps_pro_tour: 3.9, km_pro_stopp: 2.1, puenktlichkeitsrate: 91, rang: 2, status: 'top' },
    { fahrer_id: 'f3', fahrer_name: 'Lars Weber', touren_anzahl: 22, stopps_pro_tour: 3.5, km_pro_stopp: 2.4, puenktlichkeitsrate: 87, rang: 3, status: 'top' },
    { fahrer_id: 'f4', fahrer_name: 'Jana Klein', touren_anzahl: 19, stopps_pro_tour: 3.2, km_pro_stopp: 2.7, puenktlichkeitsrate: 83, rang: 4, status: 'normal' },
    { fahrer_id: 'f5', fahrer_name: 'Tom Fischer', touren_anzahl: 15, stopps_pro_tour: 2.8, km_pro_stopp: 3.2, puenktlichkeitsrate: 74, rang: 5, status: 'schwach' },
  ],
  zeitraum_tage: 7,
};

export function DispatchPhase1574TourenEffizienzRanglisteWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/touren-effizienz-rangliste?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch { /* use mock */ }
      setLoading(false);
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Touren-Effizienz</div>
          <div className="text-sm font-bold text-gray-800">Fahrer-Rangliste · {data.zeitraum_tage} Tage</div>
        </div>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Lädt…</span>}
      </div>
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const style = STATUS_STYLE[f.status] ?? STATUS_STYLE.normal;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-right text-xs text-gray-400 font-mono">{f.rang}.</span>
              <span className="flex-1 font-medium text-gray-800 truncate">{f.fahrer_name}</span>
              <span className="text-xs text-gray-500">{f.stopps_pro_tour} Stopps/Tour</span>
              <span className="text-xs text-gray-500">{f.puenktlichkeitsrate}%</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${style.badge}`}>{style.label}</span>
            </div>
          );
        })}
        {data.fahrer.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-2">Keine Touren-Daten</div>
        )}
      </div>
    </div>
  );
}
