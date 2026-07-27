'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface SubScore { label: string; wert: number; einheit: string; ampel: 'gruen' | 'gelb' | 'rot'; }
interface ApiData {
  gesamt_score: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  sub_scores: SubScore[];
  coaching_tipp: string;
  fahrer_count: number;
}

const MOCK: ApiData = {
  gesamt_score: 81,
  rang: 2,
  rank_delta: 1,
  ampel: 'gruen',
  sub_scores: [
    { label: 'Pünktlichkeit', wert: 88,  einheit: '%',  ampel: 'gruen' },
    { label: 'Ø Lieferzeit',  wert: 27,  einheit: 'min', ampel: 'gelb'  },
    { label: 'Bewertung',     wert: 4.7, einheit: '★',  ampel: 'gruen' },
    { label: 'Effizienz',     wert: 73,  einheit: '%',  ampel: 'gelb'  },
  ],
  coaching_tipp: 'Deine Pünktlichkeit ist stark! Optimiere deine Lieferzeit, um in den grünen Bereich zu kommen.',
  fahrer_count: 5,
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4301MeinSchichtGesamtscore({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-score?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60_000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-sm">Nicht verfügbar (offline)</span>
      </div>
    );
  }

  const scoreColor = data.ampel === 'gruen' ? 'text-green-500' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = data.rank_delta > 0 ? TrendingUp : data.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = data.rank_delta > 0 ? 'text-emerald-500' : data.rank_delta < 0 ? 'text-red-400' : 'text-gray-300';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-gray-900">Mein Schicht-Gesamtscore</span>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold ${scoreColor}`}>{data.gesamt_score}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-xl font-medium text-gray-400">/ 100</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{data.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${data.ampel === 'gruen' ? 'bg-green-400' : data.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${data.gesamt_score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {data.sub_scores.map((s) => {
          const c = s.ampel === 'gruen' ? 'text-green-600 bg-green-50' : s.ampel === 'gelb' ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
          return (
            <div key={s.label} className={`rounded-lg p-2 ${c.split(' ')[1]}`}>
              <p className="text-[9px] text-gray-500 font-medium">{s.label}</p>
              <p className={`text-sm font-bold ${c.split(' ')[0]}`}>{s.wert}{s.einheit}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{data.coaching_tipp}</p>

      <div className="flex justify-between text-xs text-gray-400">
        <span>Rang #{data.rang} von {data.fahrer_count} Fahrern</span>
        <span>Ziel: ≥80</span>
      </div>
    </div>
  );
}
