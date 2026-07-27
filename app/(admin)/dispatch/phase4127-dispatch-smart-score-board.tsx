'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, Target, Award } from 'lucide-react';

interface ScoreKategorie { name: string; score: number; ziel: number; gewicht: number; trend: 'up' | 'down' | 'flat'; icon: string; }
interface ApiData { kategorien: ScoreKategorie[]; dispatch_gesamt_score: number; schicht_ziel: number; prognose_ende: number; empfehlung: string; }

const MOCK: ApiData = {
  dispatch_gesamt_score: 83,
  schicht_ziel: 85,
  prognose_ende: 87,
  empfehlung: 'Effizienz-Score steigern: Touren mit >3 Stopps priorisieren. Tim B. braucht Routing-Unterstützung.',
  kategorien: [
    { name: 'Zuweisung', score: 90, ziel: 85, gewicht: 25, trend: 'up', icon: '🎯' },
    { name: 'Pünktlichkeit', score: 88, ziel: 90, gewicht: 30, trend: 'flat', icon: '⏱' },
    { name: 'Tour-Eff.', score: 72, ziel: 80, gewicht: 25, trend: 'down', icon: '🗺' },
    { name: 'Reaktionsz.', score: 79, ziel: 75, gewicht: 20, trend: 'up', icon: '⚡' },
  ],
};

interface Props { locationId: string | null; }

export function DispatchPhase4127DispatchSmartScoreBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/dispatch-smart-score?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const zielErreicht = data.dispatch_gesamt_score >= data.schicht_ziel;
  const ringColor = zielErreicht ? '#10b981' : data.dispatch_gesamt_score >= data.schicht_ziel * 0.9 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - data.dispatch_gesamt_score / 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-900">Dispatch Smart-Score</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className={`text-xs font-bold ${zielErreicht ? 'text-emerald-600' : 'text-yellow-500'}`}>
            {zielErreicht ? '✓ Ziel erreicht' : `Ziel: ${data.schicht_ziel}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="26" fill="none" stroke="#f3f4f6" strokeWidth="6" />
            <circle cx="34" cy="34" r="26" fill="none" stroke={ringColor} strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset 0.6s' }} />
            <text x="34" y="37" textAnchor="middle" fontSize="14" fontWeight="bold" fill={ringColor}>{data.dispatch_gesamt_score}</text>
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Target className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500">Schicht-Ziel</span>
            <span className="font-bold text-gray-700 ml-auto">{data.schicht_ziel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <TrendingUp className="w-3 h-3 text-indigo-400" />
            <span className="text-gray-500">Prognose Ende</span>
            <span className={`font-bold ml-auto ${data.prognose_ende >= data.schicht_ziel ? 'text-emerald-600' : 'text-orange-500'}`}>{data.prognose_ende}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kategorien.map((k) => {
          const pct = Math.min(100, k.score);
          const color = k.score >= k.ziel ? 'bg-emerald-400' : k.score >= k.ziel * 0.85 ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = k.score >= k.ziel ? 'text-emerald-600' : k.score >= k.ziel * 0.85 ? 'text-yellow-500' : 'text-red-500';
          return (
            <div key={k.name} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] w-3">{k.icon}</span>
                <span className="text-[10px] text-gray-700 flex-1">{k.name}</span>
                <span className="text-[9px] text-gray-400">×{k.gewicht}%</span>
                <span className={`text-[10px] font-bold ${tColor} w-6 text-right`}>{k.score}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%`, transition: 'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {data.empfehlung && (
        <div className="flex gap-1.5 bg-yellow-50 rounded-lg p-2">
          <Award className="w-3 h-3 text-yellow-500 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-yellow-700">{data.empfehlung}</span>
        </div>
      )}

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        Gewichteter Dispatch-Score · 30-Sek-Polling
      </div>
    </div>
  );
}
