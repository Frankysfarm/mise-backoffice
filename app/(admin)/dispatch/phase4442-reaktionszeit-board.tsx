'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_reaktionszeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_reaktionszeit_min: 3.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_reaktionszeit_min: 4.1, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_reaktionszeit_min: 6.3, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_reaktionszeit_min: 9.8, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 5.85,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4442ReaktionszeitBoard({ locationId }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_reaktionszeit_min), 0.1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold text-gray-800 text-sm">Reaktionszeit-Ranking</span>
          {data.alert_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              <AlertTriangle className="h-3 w-3" /> {data.alert_count} Hohe Reaktionszeit!
            </span>
          )}
        </div>
        {loading && <span className="text-xs text-gray-400">lädt…</span>}
      </div>

      {/* KPI-Grid */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-yellow-50 p-2">
          <div className="text-xs text-gray-500">Schnellste</div>
          <div className="font-bold text-yellow-600">{data.fahrer[0]?.avg_reaktionszeit_min.toFixed(1)} min</div>
          <div className="truncate text-xs text-gray-500">{data.schnellster_name}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-xs text-gray-500">Team-Ø</div>
          <div className="font-bold text-gray-700">{data.team_avg_min.toFixed(1)} min</div>
        </div>
        <div className="rounded-lg bg-red-50 p-2">
          <div className="text-xs text-gray-500">Langsamste</div>
          <div className="font-bold text-red-500">{data.fahrer[data.fahrer.length - 1]?.avg_reaktionszeit_min.toFixed(1)} min</div>
          <div className="truncate text-xs text-gray-500">{data.langsamster_name}</div>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          // INVERTED: rank_delta>0 = verbessert (kürzere Zeit) = TrendingUp emerald
          const Delta    = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const dColor   = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const barPct   = (f.avg_reaktionszeit_min / maxMin) * 100;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs font-bold text-gray-500">{f.rang}.</span>
              <span className="w-24 truncate text-xs text-gray-700">{f.fahrer_name}</span>
              <div className="flex-1 rounded-full bg-gray-100 h-2">
                <div className={`${barColor} h-2 rounded-full`} style={{ width: `${barPct}%` }} />
              </div>
              <span className="w-14 text-right text-xs font-semibold text-gray-700">{f.avg_reaktionszeit_min.toFixed(1)} min</span>
              <Delta className={`h-3 w-3 ${dColor}`} />
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-right text-xs text-gray-400">{data.gesamt} Fahrer · letzte 30 Tage</div>
    </div>
  );
}
