'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  driver_name: string;
  avg_bestellwert: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'm1', driver_name: 'Max M.',  avg_bestellwert: 42.5, rang: 1, ampel: 'gruen', alert: false },
    { driver_id: 'm2', driver_name: 'Lisa K.', avg_bestellwert: 35.2, rang: 2, ampel: 'gruen', alert: false },
    { driver_id: 'm3', driver_name: 'Tom B.',  avg_bestellwert: 28.9, rang: 3, ampel: 'gelb',  alert: false },
    { driver_id: 'm4', driver_name: 'Paul R.', avg_bestellwert: 14.8, rang: 4, ampel: 'rot',   alert: true  },
  ],
  team_avg: 28.7,
};

interface Props { locationId: string | null; }

export function KitchenPhase4340BestellwertTicker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bestellwert-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];
  const alertCount = data.fahrer.filter(f => f.alert).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-bold text-orange-700">
            Bester: {bester?.driver_name} — {bester?.avg_bestellwert.toFixed(2)} €
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && alertCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" /> {alertCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const dotColor = f.ampel === 'gruen' ? 'bg-green-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.driver_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-[11px] text-gray-500 w-4 text-right">#{f.rang}</span>
              <span className="text-[11px] text-gray-700 flex-1 truncate">{f.driver_name}</span>
              <span className="text-[11px] font-bold text-gray-900">{f.avg_bestellwert.toFixed(2)} €</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg.toFixed(2)} €</span>
        <span>#1 = höchster Ø-Bestellwert</span>
      </div>
    </div>
  );
}
