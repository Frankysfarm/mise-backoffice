'use client';

import { useState, useEffect, useCallback } from 'react';
import { DoorOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_wartezeit_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    avg_wartezeit_min:  3.1, trend_delta: -1.1, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    avg_wartezeit_min:  4.2, trend_delta: -0.9, ampel: 'gruen', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   avg_wartezeit_min:  6.5, trend_delta:  0.5, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f5', fahrer_name: 'Anna B.',   avg_wartezeit_min: 11.3, trend_delta:  0.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  avg_wartezeit_min: 12.8, trend_delta:  3.3, ampel: 'rot',   alert: true  },
  ],
  team_avg_wartezeit_min: 7.6,
  alert_count: 2,
};

function RankBadge({ rang }: { rang: number }) {
  if (rang === 1) return <span>🥇</span>;
  if (rang === 2) return <span>🥈</span>;
  if (rang === 3) return <span>🥉</span>;
  return <span className="text-gray-400 font-mono text-xs">#{rang}</span>;
}

export function DispatchPhase3904WartezeitTuerBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
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

  const { team_avg_wartezeit_min, alert_count } = data;
  // ascending: lowest wait = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <DoorOpen className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Wartezeit-Ranking</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Alert */}
      {alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <DoorOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Lange Wartezeiten!</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
          <div className="text-xs font-bold text-gray-800 truncate">{best?.fahrer_name ?? '—'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-xs font-bold text-gray-800">{team_avg_wartezeit_min} min</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Längster</div>
          <div className="text-xs font-bold text-gray-800 truncate">{worst?.fahrer_name ?? '—'}</div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="space-y-1">
        {sorted.map((f, i) => {
          const tColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          // ascending: neg trend_delta = wait decreased = improved = gruen
          const DeltaIcon = f.trend_delta < 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.trend_delta > 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm">
              <RankBadge rang={i + 1} />
              <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${tColor}`}>{f.avg_wartezeit_min} min</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Ziel ≤5 min</span>
        <span>Team-Ø {team_avg_wartezeit_min} min</span>
      </div>
    </div>
  );
}
