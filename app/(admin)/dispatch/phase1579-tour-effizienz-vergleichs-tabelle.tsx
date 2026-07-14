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

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  top:    { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Top' },
  normal: { cls: 'bg-blue-100 text-blue-700 border-blue-200',         label: 'OK' },
  schwach:{ cls: 'bg-rose-100 text-rose-700 border-rose-200',         label: 'Schwach' },
};

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',   touren_anzahl: 28, stopps_pro_tour: 4.2, km_pro_stopp: 1.8, puenktlichkeitsrate: 94, rang: 1, status: 'top' },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt',  touren_anzahl: 25, stopps_pro_tour: 3.9, km_pro_stopp: 2.1, puenktlichkeitsrate: 91, rang: 2, status: 'top' },
    { fahrer_id: 'f3', fahrer_name: 'Lars Weber',    touren_anzahl: 22, stopps_pro_tour: 3.5, km_pro_stopp: 2.4, puenktlichkeitsrate: 87, rang: 3, status: 'top' },
    { fahrer_id: 'f4', fahrer_name: 'Jana Klein',    touren_anzahl: 19, stopps_pro_tour: 3.2, km_pro_stopp: 2.7, puenktlichkeitsrate: 83, rang: 4, status: 'normal' },
    { fahrer_id: 'f5', fahrer_name: 'Tom Fischer',   touren_anzahl: 15, stopps_pro_tour: 2.8, km_pro_stopp: 3.2, puenktlichkeitsrate: 74, rang: 5, status: 'schwach' },
  ],
  zeitraum_tage: 7,
};

export function DispatchPhase1579TourEffizienzVergleichsTabelle({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/touren-effizienz-rangliste?location_id=${locationId}`,
        );
        if (res.ok) setData(await res.json());
      } catch { /* use mock */ }
      setLoading(false);
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!open) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-500">
            Tour-Effizienz-Vergleich
          </div>
          <div className="text-sm font-bold text-violet-900">
            Fahrer-Tabelle · {data.zeitraum_tage} Tage
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-violet-400 animate-pulse">Lädt…</span>}
          <button
            onClick={() => setOpen(false)}
            className="text-lg leading-none text-violet-400 hover:text-violet-600"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-violet-500 font-semibold uppercase tracking-wide border-b border-violet-200">
              <th className="py-1 pr-2 text-left">#</th>
              <th className="py-1 pr-2 text-left">Fahrer</th>
              <th className="py-1 pr-2 text-right">Stopps/Tour</th>
              <th className="py-1 pr-2 text-right">Ø Lieferzeit</th>
              <th className="py-1 pr-2 text-right">Pünktl.</th>
              <th className="py-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-violet-100">
            {data.fahrer.map((f) => {
              const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.normal;
              return (
                <tr key={f.fahrer_id} className="hover:bg-violet-100/50 transition-colors">
                  <td className="py-1.5 pr-2 font-mono text-violet-400">{f.rang}.</td>
                  <td className="py-1.5 pr-2 font-medium text-violet-900 truncate max-w-[100px]">
                    {f.fahrer_name}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-violet-800">
                    {f.stopps_pro_tour.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-violet-800">
                    {(f.km_pro_stopp * 4).toFixed(0)} Min
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-bold text-violet-800">
                    {f.puenktlichkeitsrate}%
                  </td>
                  <td className="py-1.5 text-right">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {data.fahrer.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-violet-400">
                  Keine Daten verfügbar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
