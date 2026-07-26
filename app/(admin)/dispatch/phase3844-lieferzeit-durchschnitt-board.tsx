'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

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

function ampelColor(ampel: FahrerRow['ampel']) {
  if (ampel === 'gruen') return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', border: 'border-emerald-200' };
  if (ampel === 'gelb')  return { text: 'text-yellow-600',  bg: 'bg-yellow-50',  bar: 'bg-yellow-400',  border: 'border-yellow-200'  };
  return                        { text: 'text-red-500',     bg: 'bg-red-50',     bar: 'bg-red-400',     border: 'border-red-200'     };
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3844LieferzeitDurchschnittBoard({ locationId }: { locationId: string | null }) {
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

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_min), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 text-sm">Ø Lieferzeit-Ranking</span>
          {loading && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" />
            <span>{data.alert_count} Lange Lieferzeiten!</span>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="text-[10px] text-emerald-600 font-medium">Bester</div>
          <div className="text-xs font-bold text-emerald-700 truncate">{data.bester_name}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-xs font-bold text-gray-700">{data.team_avg_min} min</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-[10px] text-red-500 font-medium">Längste</div>
          <div className="text-xs font-bold text-red-600 truncate">{data.laengste_name}</div>
        </div>
      </div>

      {/* Ranking Liste */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => {
          const c = ampelColor(f.ampel);
          const barPct = Math.round((f.avg_min / maxMin) * 100);
          return (
            <div key={f.fahrer_id} className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                  <span className={`text-xs font-semibold ${c.text}`}>{f.fahrer_name}</span>
                  {f.alert_lang && <AlertTriangle className="w-3 h-3 text-red-500" />}
                </div>
                <div className="flex items-center gap-1.5">
                  {f.rank_delta !== 0 && (
                    f.rank_delta < 0
                      ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-sm font-bold ${c.text}`}>{f.avg_min} min</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ziel */}
      <div className="text-[10px] text-gray-400 text-right">Ziel: ≤{data.ziel_min} min</div>
    </div>
  );
}
