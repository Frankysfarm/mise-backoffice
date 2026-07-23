'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Euro, Clock, Truck, Star, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Kpi {
  key: string;
  label: string;
  value: string;
  delta_pct: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  ziel: string | null;
}

interface ApiResponse {
  kpis: Kpi[];
  gesamt_score: number;
  insight: string | null;
  alert_kpis: string[];
  updated_at: string | null;
}

const MOCK: ApiResponse = {
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', value: '124', delta_pct: 8.2, ampel: 'gruen', ziel: '120' },
    { key: 'umsatz', label: 'Umsatz', value: '€ 2.847', delta_pct: 5.1, ampel: 'gruen', ziel: '€ 2.500' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', value: '28 Min', delta_pct: -3.4, ampel: 'gruen', ziel: '30 Min' },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', value: '88%', delta_pct: 1.2, ampel: 'gruen', ziel: '85%' },
    { key: 'storno', label: 'Storno-Rate', value: '2.4%', delta_pct: -0.5, ampel: 'gruen', ziel: '<5%' },
    { key: 'bewertung', label: 'Ø Bewertung', value: '4.7 ★', delta_pct: 0.2, ampel: 'gruen', ziel: '4.5' },
    { key: 'touren', label: 'Touren', value: '38', delta_pct: 6.8, ampel: 'gruen', ziel: '35' },
    { key: 'fahrer_aktiv', label: 'Fahrer aktiv', value: '4', delta_pct: null, ampel: 'gelb', ziel: '5' },
  ],
  gesamt_score: 88,
  insight: 'Starke Performance heute — Lieferzeit 7% besser als Ziel. Fahrer-Auslastung prüfen.',
  alert_kpis: [],
  updated_at: null,
};

const AMPEL: Record<string, { bg: string; text: string; dot: string }> = {
  gruen: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  gelb: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  rot: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

function ScoreRing({ score }: { score: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 85 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 40 40)" />
      <text x="40" y="36" textAnchor="middle" style={{ fontSize: 18, fontWeight: 900, fill: color }}>{score}</text>
      <text x="40" y="51" textAnchor="middle" style={{ fontSize: 9, fill: '#6b7280' }}>Score</text>
    </svg>
  );
}

export function LieferdienstPhase2710StatistikDashboardFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.kpis?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const alertKpis = data.kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-matcha-600 to-matcha-700 text-white">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wide">Statistik-Dashboard</span>
        </div>
        {alertKpis.length > 0 && (
          <span className="flex items-center gap-1 bg-red-500/80 rounded px-2 py-0.5 text-xs font-bold">
            <AlertTriangle className="w-3 h-3" /> {alertKpis.length} KPI kritisch
          </span>
        )}
      </div>

      {/* Score + Insight */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-gray-50">
        <ScoreRing score={data.gesamt_score} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Schicht-Bewertung</div>
          {data.insight && (
            <p className="text-xs text-gray-700 leading-relaxed">{data.insight}</p>
          )}
        </div>
      </div>

      {/* Alert Strip */}
      {alertKpis.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b flex flex-wrap gap-2">
          {alertKpis.map(k => (
            <span key={k.key} className="flex items-center gap-1 text-xs text-red-700 font-semibold bg-red-100 rounded px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> {k.label}: {k.value}
            </span>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 p-px">
        {data.kpis.map(k => {
          const A = AMPEL[k.ampel];
          const hasDelta = k.delta_pct !== null;
          const deltaPositive = (k.delta_pct ?? 0) > 0;
          const isNegativeGood = ['lieferzeit', 'storno'].includes(k.key);
          const improved = hasDelta && (isNegativeGood ? !deltaPositive : deltaPositive);
          return (
            <div key={k.key} className={cn('bg-white p-3', k.ampel === 'rot' ? 'bg-red-50' : '')}>
              <div className="flex items-center gap-1 mb-1">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', A.dot)} />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{k.label}</span>
              </div>
              <div className="flex items-end justify-between gap-1">
                <span className={cn('text-lg font-black tabular-nums', A.text)}>{k.value}</span>
                {hasDelta && (
                  <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', improved ? 'text-green-600' : 'text-red-500')}>
                    {improved
                      ? <TrendingUp className="w-3 h-3" />
                      : (k.delta_pct === 0 ? <Minus className="w-3 h-3 text-gray-400" /> : <TrendingDown className="w-3 h-3" />)}
                    {k.delta_pct !== null && k.delta_pct !== 0 && `${Math.abs(k.delta_pct).toFixed(1)}%`}
                  </span>
                )}
              </div>
              {k.ziel && (
                <div className="text-[9px] text-gray-400 mt-0.5">Ziel: {k.ziel}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <BarChart2 className="w-3 h-3" /> Update alle 60 Sek.
      </div>
    </div>
  );
}
