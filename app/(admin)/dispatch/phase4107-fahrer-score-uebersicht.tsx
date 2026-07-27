'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerScore { fahrer_id: string; fahrer_name: string; gesamt_score: number; puenktlichkeit: number; kundenbewertung: number; effizienz: number; rang: number; rang_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; }
interface ApiData { fahrer: FahrerScore[]; team_avg_score: number; top_performer: string; verbesserung_needed: string; gesamt: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', gesamt_score: 94, puenktlichkeit: 96, kundenbewertung: 4.9, effizienz: 91, rang: 1, rang_delta: 0, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', gesamt_score: 88, puenktlichkeit: 90, kundenbewertung: 4.7, effizienz: 85, rang: 2, rang_delta: 1, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.', gesamt_score: 75, puenktlichkeit: 78, kundenbewertung: 4.3, effizienz: 70, rang: 3, rang_delta: -1, ampel: 'gelb' },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.', gesamt_score: 58, puenktlichkeit: 62, kundenbewertung: 3.8, effizienz: 55, rang: 4, rang_delta: 0, ampel: 'rot' },
  ],
  team_avg_score: 79,
  top_performer: 'Max M.',
  verbesserung_needed: 'Tim B.',
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4107FahrerScoreUebersicht({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-score-uebersicht?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const maxScore = 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-900">Fahrer-Score Übersicht</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-xs text-gray-500">Team-Ø <span className="font-bold text-gray-700">{data.team_avg_score}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-yellow-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5"><Star className="w-3 h-3 text-yellow-500" /><span className="text-[9px] text-gray-500">Top Performer</span></div>
          <div className="text-xs font-bold text-yellow-600">{data.top_performer}</div>
          <div className="text-[9px] text-gray-400">{data.fahrer[0]?.gesamt_score}/100</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500 mb-0.5">Coaching nötig</div>
          <div className="text-xs font-bold text-red-500">{data.verbesserung_needed}</div>
          <div className="text-[9px] text-gray-400">{data.fahrer[data.fahrer.length - 1]?.gesamt_score}/100</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const dotColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const scoreColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const DeltaIcon = f.rang_delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : f.rang_delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />;

          return (
            <div key={f.fahrer_id} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-4 text-right">#{f.rang}</span>
                {DeltaIcon}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span>P:{f.puenktlichkeit}%</span>
                  <span>★{f.kundenbewertung}</span>
                  <span>E:{f.effizienz}%</span>
                </div>
                <span className={`text-xs font-bold ${scoreColor} w-8 text-right`}>{f.gesamt_score}</span>
              </div>
              <div className="ml-7 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.gesamt_score / maxScore) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Gesamt-Score = Pünktlichkeit + Bewertung + Effizienz</span>
        <span>1 Min Polling</span>
      </div>
    </div>
  );
}
