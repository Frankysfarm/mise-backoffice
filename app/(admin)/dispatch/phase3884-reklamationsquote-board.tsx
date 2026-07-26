'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reklamations_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  hoechste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, reklamations_pct:  1, rank_delta: -1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, reklamations_pct:  3, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, reklamations_pct:  7, rank_delta:  1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, reklamations_pct: 14, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 6,
  bester_name: 'Julia F.',
  hoechste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 3,
};

function RankBadge({ rang }: { rang: number }) {
  if (rang === 1) return <span className="text-xs font-bold text-yellow-500">🥇</span>;
  if (rang === 2) return <span className="text-xs font-bold text-gray-400">🥈</span>;
  if (rang === 3) return <span className="text-xs font-bold text-amber-600">🥉</span>;
  return <span className="text-xs text-gray-400 font-mono">#{rang}</span>;
}

export function DispatchPhase3884ReklamationsquoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reklamations-quote?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Ascending: lowest reklamations_pct = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.reklamations_pct - b.reklamations_pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-900">Reklamationsquote</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{data.ziel_pct}%</span>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertOctagon className="w-3 h-3 shrink-0" />
          <span>Hohe Reklamationsquote! {data.alert_count} Fahrer über Ziel</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Beste</div>
          <div className="text-lg font-black text-emerald-700">{best?.reklamations_pct}%</div>
          <div className="text-[10px] text-gray-600 truncate">{best?.fahrer_name}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-lg font-black text-gray-700">{data.team_avg_pct}%</div>
          <div className="text-[10px] text-gray-400">Durchschnitt</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchste</div>
          <div className="text-lg font-black text-red-600">{worst?.reklamations_pct}%</div>
          <div className="text-[10px] text-gray-600 truncate">{worst?.fahrer_name}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const maxVal = Math.max(...sorted.map(x => x.reklamations_pct), 1);
          // Delta: neg=verbessert=gruen (ascending metric)
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <RankBadge rang={f.rang} />
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.reklamations_pct}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${(f.reklamations_pct / maxVal) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_avg_pct}%</span>
        <span>Ziel ≤{data.ziel_pct}%</span>
      </div>
    </div>
  );
}
