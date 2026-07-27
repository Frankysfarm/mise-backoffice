'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DimensionScore { dimension: string; aktuell: number; vorwoche: number; ziel: number; delta: number; }
interface ApiData { dimensionen: DimensionScore[]; gesamt_score: number; vorwoche_score: number; top_dimension: string; schwach_dimension: string; }

const MOCK: ApiData = {
  gesamt_score: 81,
  vorwoche_score: 76,
  top_dimension: 'Pünktlichkeit',
  schwach_dimension: 'Effizienz',
  dimensionen: [
    { dimension: 'Pünktlichkeit', aktuell: 91, vorwoche: 85, ziel: 90, delta: 6 },
    { dimension: 'Kundenbew.', aktuell: 85, vorwoche: 83, ziel: 85, delta: 2 },
    { dimension: 'Effizienz', aktuell: 68, vorwoche: 65, ziel: 80, delta: 3 },
    { dimension: 'Reaktionszeit', aktuell: 79, vorwoche: 70, ziel: 75, delta: 9 },
    { dimension: 'Zuverlässig.', aktuell: 84, vorwoche: 78, ziel: 85, delta: 6 },
  ],
};

interface Props { locationId: string | null; }

export function DispatchPhase4117ScoreVergleichsMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/dispatch-score-matrix?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const totalDelta = data.gesamt_score - data.vorwoche_score;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Score-Vergleichs-Matrix</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-3">
        <div>
          <div className="text-[10px] text-gray-500">Gesamt-Score</div>
          <div className="text-2xl font-bold text-indigo-700">{data.gesamt_score}</div>
          <div className="text-[9px] text-gray-400">Vorwoche: {data.vorwoche_score}</div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold ${totalDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {totalDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {totalDelta >= 0 ? '+' : ''}{totalDelta}
        </div>
      </div>

      <div className="space-y-2">
        {data.dimensionen.map((d) => {
          const erreicht = d.aktuell >= d.ziel;
          const barColor = erreicht ? 'bg-emerald-400' : d.aktuell >= d.ziel * 0.85 ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = d.delta > 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-500" /> : d.delta < 0 ? <TrendingDown className="w-2.5 h-2.5 text-red-400" /> : <Minus className="w-2.5 h-2.5 text-gray-300" />;
          return (
            <div key={d.dimension} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-700 w-20 truncate">{d.dimension}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${d.aktuell}%`, transition: 'width 0.4s' }} />
                </div>
                <span className="text-[10px] font-bold text-gray-700 w-7 text-right">{d.aktuell}</span>
                <div className="flex items-center gap-0.5 w-8">
                  {DeltaIcon}
                  <span className="text-[9px] text-gray-400">{d.delta > 0 ? '+' : ''}{d.delta}</span>
                </div>
                <span className="text-[9px] text-gray-300 w-10">/{d.ziel}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>🏆 {data.top_dimension} · ⚠ {data.schwach_dimension}</span>
        <span>vs. Vorwoche</span>
      </div>
    </div>
  );
}
