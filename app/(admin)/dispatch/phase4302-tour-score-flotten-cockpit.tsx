'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, Target } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_score: number;
  puenktlichkeit_pct: number;
  lieferzeit_min: number;
  bewertung_avg: number;
  touren: number;
  delta: number;
  alert: boolean;
}

interface FlottenData {
  fahrer: FahrerScore[];
  flotten_avg: number;
  top_score: number;
  top_name: string;
  alert_count: number;
}

const MOCK: FlottenData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max K.',   gesamt_score: 92, puenktlichkeit_pct: 96, lieferzeit_min: 24, bewertung_avg: 4.9, touren: 6, delta:  2, alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara M.',  gesamt_score: 85, puenktlichkeit_pct: 89, lieferzeit_min: 27, bewertung_avg: 4.7, touren: 5, delta:  0, alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim R.',   gesamt_score: 74, puenktlichkeit_pct: 78, lieferzeit_min: 31, bewertung_avg: 4.4, touren: 4, delta: -3, alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Jonas B.', gesamt_score: 61, puenktlichkeit_pct: 65, lieferzeit_min: 38, bewertung_avg: 4.1, touren: 3, delta: -5, alert: true  },
  ],
  flotten_avg: 78,
  top_score: 92,
  top_name: 'Max K.',
  alert_count: 1,
};

interface Props { locationId: string | null; }

export function DispatchPhase4302TourScoreFlottenCockpit({ locationId }: Props) {
  const [data, setData] = useState<FlottenData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tour-score?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Score Cockpit</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" />{data.alert_count} Score &lt;70
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-[10px] text-amber-600 font-medium">Top-Score</p>
          <p className="text-sm font-bold text-amber-700">{data.top_score}</p>
          <p className="text-[10px] text-amber-500 truncate">{data.top_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Flotten-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.flotten_avg}</p>
          <p className="text-[10px] text-gray-400">Ziel ≥80</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-2">
          <p className="text-[10px] text-indigo-600 font-medium">Fahrer</p>
          <p className="text-sm font-bold text-indigo-700">{data.fahrer.length}</p>
          <p className="text-[10px] text-indigo-400">aktiv</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const scoreColor = f.gesamt_score >= 80 ? 'text-green-600' : f.gesamt_score >= 70 ? 'text-yellow-500' : 'text-red-500';
          const barColor   = f.gesamt_score >= 80 ? 'bg-green-400'  : f.gesamt_score >= 70 ? 'bg-yellow-400'  : 'bg-red-400';
          const Delta = f.delta > 0 ? TrendingUp : f.delta < 0 ? TrendingDown : Minus;
          const dColor = f.delta > 0 ? 'text-emerald-500' : f.delta < 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Delta className={`w-3 h-3 flex-shrink-0 ${dColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className="text-[10px] text-gray-400">{f.touren}T · {f.puenktlichkeit_pct}% · ★{f.bewertung_avg}</span>
                <span className={`text-xs font-bold ml-1 ${scoreColor}`}>{f.gesamt_score}</span>
              </div>
              <div className="ml-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${f.gesamt_score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-0.5"><Target className="w-3 h-3" /> Score: Pünktlichkeit · Lieferzeit · Bewertung</span>
        <span>20s</span>
      </div>
    </div>
  );
}
