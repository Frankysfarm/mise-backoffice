'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gift, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_trinkgeld_eur: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_trinkgeld_eur: 3.20, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_trinkgeld_eur: 2.85, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_trinkgeld_eur: 2.10, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_trinkgeld_eur: 1.45, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_eur: 2.40,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function KitchenPhase4435TrinkgeldTicker({ locationId }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-bold text-gray-800">Trinkgeld-Ranking</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-semibold">
              <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count}
            </span>
          )}
        </div>
      </div>

      {bester && (
        <div className="bg-amber-50 rounded-xl px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700 truncate">🏆 {data.bester_name}</span>
          <span className="text-sm font-extrabold text-amber-600 ml-2">{bester.avg_trinkgeld_eur.toFixed(2)}€</span>
        </div>
      )}

      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const dot = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-amber-500';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-[11px] text-gray-600 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[11px] font-semibold text-gray-800">{f.avg_trinkgeld_eur.toFixed(2)}€</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg_eur.toFixed(2)}€</span>
        <span>#1 = höchstes Trinkgeld</span>
      </div>
    </div>
  );
}
