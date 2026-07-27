'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface TourAmpel { tour_id: string; fahrer_name: string; ampel: 'gruen' | 'gelb' | 'rot'; effizienz_score: number; stopps_pct: number; delay_min: number; km_abweichung_pct: number; }
interface ApiData { touren: TourAmpel[]; gruen_count: number; gelb_count: number; rot_count: number; kritische_tours: string[]; avg_effizienz: number; }

const MOCK: ApiData = {
  gruen_count: 2,
  gelb_count: 1,
  rot_count: 1,
  kritische_tours: ['Tim B.'],
  avg_effizienz: 79,
  touren: [
    { tour_id: 't1', fahrer_name: 'Max M.', ampel: 'gruen', effizienz_score: 92, stopps_pct: 80, delay_min: 1, km_abweichung_pct: -2 },
    { tour_id: 't2', fahrer_name: 'Julia F.', ampel: 'gruen', effizienz_score: 87, stopps_pct: 67, delay_min: 2, km_abweichung_pct: 3 },
    { tour_id: 't3', fahrer_name: 'Sara K.', ampel: 'gelb', effizienz_score: 71, stopps_pct: 50, delay_min: 7, km_abweichung_pct: 12 },
    { tour_id: 't4', fahrer_name: 'Tim B.', ampel: 'rot', effizienz_score: 48, stopps_pct: 25, delay_min: 18, km_abweichung_pct: 28 },
  ],
};

interface Props { locationId: string | null; }

export function DispatchPhase4122TourEffizienzAmpel({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-effizienz-ampel?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const ampelConfig = {
    gruen: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400', text: 'text-emerald-700', label: 'OK' },
    gelb: { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Achtung' },
    rot: { bg: 'bg-red-50', border: 'border-red-300', dot: 'bg-red-500', text: 'text-red-700', label: 'Kritisch' },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Effizienz-Ampel</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.rot_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.rot_count} kritisch
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'OK', count: data.gruen_count, color: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
          { label: 'Achtung', count: data.gelb_count, color: 'bg-yellow-50', text: 'text-yellow-500', dot: 'bg-yellow-400' },
          { label: 'Kritisch', count: data.rot_count, color: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' },
        ].map(item => (
          <div key={item.label} className={`${item.color} rounded-lg p-2 text-center`}>
            <div className={`w-3 h-3 rounded-full ${item.dot} mx-auto mb-1`} />
            <div className={`text-lg font-bold ${item.text}`}>{item.count}</div>
            <div className="text-[9px] text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.touren.map((tour) => {
          const cfg = ampelConfig[tour.ampel];
          return (
            <div key={tour.tour_id} className={`flex items-center gap-2 p-2 rounded-lg border ${cfg.bg} ${cfg.border}`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot} ${tour.ampel === 'rot' ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-gray-800 flex-1 font-medium">{tour.fahrer_name}</span>
              <div className="flex items-center gap-2 text-[9px] text-gray-500">
                <span>{tour.stopps_pct}% done</span>
                {tour.delay_min > 0 && <span className="flex items-center gap-0.5 text-red-500"><Clock className="w-2.5 h-2.5" />+{tour.delay_min}m</span>}
                {tour.km_abweichung_pct > 5 && <span className="text-orange-400">+{tour.km_abweichung_pct}% km</span>}
              </div>
              <span className={`text-xs font-bold ${cfg.text}`}>{tour.effizienz_score}</span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Ø Effizienz: {data.avg_effizienz}</span>
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
