'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  bester_name: string;
  laengste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_min: 26,
  bester_name: 'Julia F.',
  laengste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_min: 25,
};

function RankBadge({ rang }: { rang: number }) {
  if (rang === 1) return <span>🥇</span>;
  if (rang === 2) return <span>🥈</span>;
  if (rang === 3) return <span>🥉</span>;
  return <span className="text-gray-400 font-mono text-xs">#{rang}</span>;
}

export function DispatchPhase3899LieferzeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-durchschnitt?location_id=${locationId}`);
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

  const { fahrer, team_avg_min, bester_name, laengste_name, alert_count, ziel_min } = data;
  const sorted = [...fahrer].sort((a, b) => a.rang - b.rang);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Ø Lieferzeit-Ranking</h3>
        {loading && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Alert */}
      {alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Lange Lieferzeiten!</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-blue-500 mb-0.5">Schnellster</div>
          <div className="text-xs font-bold text-blue-800 truncate">{bester_name}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-xs font-bold text-gray-800">{team_avg_min} min</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Längster</div>
          <div className="text-xs font-bold text-gray-800 truncate">{laengste_name}</div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="space-y-1">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-blue-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          // ascending: neg rank_delta = improved rank = gruen
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm">
              <RankBadge rang={f.rang} />
              <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${tColor}`}>{f.avg_min} min</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Ziel ≤{ziel_min} min</span>
        <span>Team-Ø {team_avg_min} min</span>
      </div>
    </div>
  );
}
