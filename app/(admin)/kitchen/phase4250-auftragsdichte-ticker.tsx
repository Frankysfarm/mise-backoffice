'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; dichte: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_bottom: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg: number; dichtester_name: string; alert_count: number; ziel: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, dichte: 4.2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, dichte: 3.8, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, dichte: 3.1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, dichte: 2.4, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 3.4,
  dichtester_name: 'Julia F.',
  alert_count: 1,
  ziel: 4.0,
};

interface Props { locationId: string | null; }

export function KitchenPhase4250AuftragsdichteTicker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-auftragsdichte-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-gray-900">Auftragsdichte</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count}
          </span>
        )}
      </div>

      {bester && (
        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1.5">
          <span className="text-[10px] font-semibold text-blue-500">#1</span>
          <span className="text-xs font-bold text-blue-700 flex-1 truncate">{bester.fahrer_name}</span>
          <span className="text-xs font-black text-blue-600">{bester.dichte}/h</span>
        </div>
      )}

      <div className="space-y-1">
        {data.fahrer.slice(1).map((f) => {
          const dot = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-[10px] text-gray-500 w-4">#{f.rang}</span>
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] font-semibold text-gray-600">{f.dichte}/h</span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg}/h</span>
        <span>Ziel ≥{data.ziel}/h</span>
      </div>
    </div>
  );
}
