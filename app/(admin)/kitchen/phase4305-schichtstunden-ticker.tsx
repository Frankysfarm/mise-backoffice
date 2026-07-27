'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_stunden: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_stunden: number;
  fleissigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_stunden: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_stunden: 7.5, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_stunden: 6.8, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_stunden: 5.5, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_stunden: 3.9, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg_stunden: 5.93,
  fleissigster_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
  ziel_stunden: 6,
};

interface Props { locationId: string | null; }

export function KitchenPhase4305SchichtstundenTicker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schichtstunden-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-bold text-indigo-600">
            Fleißigster: {data.fleissigster_name} — {bester?.avg_stunden.toFixed(1)}h/Schicht
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" /> {data.alert_count}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const dotColor = f.ampel === 'gruen' ? 'bg-indigo-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-[11px] text-gray-500 w-4 text-right">#{f.rang}</span>
              <span className="text-[11px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[11px] font-bold text-gray-900">{f.avg_stunden.toFixed(1)}h</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg_stunden.toFixed(1)}h · Ziel: {data.ziel_stunden}h</span>
        <span>#1 = meiste Schichtstunden</span>
      </div>
    </div>
  );
}
