'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Euro, Clock, Truck, Star, Target, Zap, AlertTriangle, BarChart2, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  delta_pct: number;
  ziel_pct?: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundeEintrag {
  stunde: string;
  umsatz: number;
  lieferungen: number;
}

interface TopFahrer {
  name: string;
  score: number;
  lieferungen: number;
}

interface ApiData {
  kpis: KpiKachel[];
  gesamt_score: number;
  score_delta: number;
  alert_count: number;
  stundenverlauf: StundeEintrag[];
  top_fahrer: TopFahrer[];
  aktive_fahrer: number;
}

const MOCK: ApiData = {
  gesamt_score: 79,
  score_delta: 4,
  alert_count: 1,
  aktive_fahrer: 5,
  kpis: [
    { key: 'umsatz',        label: 'Umsatz heute',       wert: '1.248 €', delta_pct: 12,   ampel: 'gruen' },
    { key: 'lieferungen',   label: 'Lieferungen',         wert: '47',      delta_pct: 8,    ampel: 'gruen' },
    { key: 'avg_lieferzeit',label: 'Ø Lieferzeit',        wert: '26 min',  delta_pct: -5,   ampel: 'gelb'  },
    { key: 'puenktlichkeit',label: 'Pünktlichkeit',       wert: '81 %',    delta_pct: 3,    ziel_pct: 90, ampel: 'gelb' },
    { key: 'bewertung',     label: 'Ø Bewertung',         wert: '4.4 ★',   delta_pct: 0,    ampel: 'gruen' },
    { key: 'stornos',       label: 'Stornoquote',         wert: '2.1 %',   delta_pct: -0.3, ampel: 'gruen' },
    { key: 'trinkgeld',     label: 'Ø Trinkgeld',         wert: '1.80 €',  delta_pct: 7,    ampel: 'gruen' },
    { key: 'leerfahrten',   label: 'Leerfahrten',         wert: '4.8 %',   delta_pct: 2,    ampel: 'gelb'  },
  ],
  stundenverlauf: [
    { stunde: '10', umsatz: 88,  lieferungen: 3 },
    { stunde: '11', umsatz: 145, lieferungen: 5 },
    { stunde: '12', umsatz: 312, lieferungen: 11 },
    { stunde: '13', umsatz: 287, lieferungen: 10 },
    { stunde: '14', umsatz: 198, lieferungen: 7 },
    { stunde: '15', umsatz: 124, lieferungen: 5 },
    { stunde: '16', umsatz: 94,  lieferungen: 6 },
  ],
  top_fahrer: [
    { name: 'Lukas H.', score: 91, lieferungen: 14 },
    { name: 'Sara M.',  score: 83, lieferungen: 11 },
    { name: 'Tim B.',   score: 74, lieferungen: 9  },
  ],
};

const AMPEL_STYLE: Record<'gruen' | 'gelb' | 'rot', { bg: string; text: string; border: string }> = {
  gruen: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  gelb:  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  rot:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
};

interface Props { locationId: string | null; }

export function LieferdienstPhase4215StatistikenDashboardV3({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<'umsatz' | 'lieferungen'>('umsatz');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const scoreColor = data.gesamt_score >= 85 ? 'text-green-600' : data.gesamt_score >= 70 ? 'text-yellow-600' : 'text-red-500';
  const scoreBg = data.gesamt_score >= 85 ? 'bg-green-500' : data.gesamt_score >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  const ScoreDelta = data.score_delta > 0 ? TrendingUp : data.score_delta < 0 ? TrendingDown : Minus;
  const deltaColor = data.score_delta > 0 ? 'text-green-500' : data.score_delta < 0 ? 'text-red-500' : 'text-gray-400';

  const chartData = data.stundenverlauf.map(e => ({ ...e, wert: chartMode === 'umsatz' ? e.umsatz : e.lieferungen }));
  const maxWert = Math.max(...chartData.map(e => e.wert));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden space-y-0">
      {/* Header */}
      <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-200" />
          <span className="text-sm font-bold text-white">Statistiken Dashboard V3</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[8px] text-emerald-300">Score</p>
            <div className="flex items-center gap-1">
              <p className="text-sm font-black text-white">{data.gesamt_score}</p>
              <ScoreDelta className={`w-3 h-3 ${deltaColor}`} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-emerald-300">Fahrer aktiv</p>
            <p className="text-sm font-black text-white">{data.aktive_fahrer}</p>
          </div>
          {data.alert_count > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-400/40 rounded-full px-2 py-0.5 text-[10px] text-red-200 font-semibold">
              <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count}
            </span>
          )}
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
        {data.kpis.map((kpi) => {
          const as = AMPEL_STYLE[kpi.ampel];
          const DeltaIcon = kpi.delta_pct > 0 ? TrendingUp : kpi.delta_pct < 0 ? TrendingDown : Minus;
          const dColor = kpi.delta_pct > 0 ? 'text-green-500' : kpi.delta_pct < 0 ? 'text-red-500' : 'text-gray-400';
          return (
            <div key={kpi.key} className={`px-3 py-2.5 ${as.bg} border-l-2 ${as.border}`}>
              <p className="text-[8px] text-gray-400 font-medium">{kpi.label}</p>
              <p className={`text-base font-black ${as.text}`}>{kpi.wert}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <DeltaIcon className={`w-2.5 h-2.5 ${dColor}`} />
                <span className={`text-[9px] font-semibold ${dColor}`}>
                  {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                </span>
                {kpi.ziel_pct != null && (
                  <span className="text-[9px] text-gray-400">Ziel {kpi.ziel_pct}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf Chart */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-700">Stundenverlauf</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[9px] font-medium">
            {(['umsatz', 'lieferungen'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`px-2.5 py-1 transition ${chartMode === m ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                {m === 'umsatz' ? '€' : '#'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
                formatter={(v: unknown) => [chartMode === 'umsatz' ? `${v} €` : `${v}`, chartMode === 'umsatz' ? 'Umsatz' : 'Lieferungen'] as [string, string]}
              />
              <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.wert === maxWert ? '#059669' : '#a7f3d0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="px-4 pb-3 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-700 mb-2 pt-2">Top-Fahrer</p>
        <div className="space-y-1.5">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-700'}`}>
                {i + 1}
              </span>
              <span className="text-xs font-semibold text-gray-700 flex-1">{f.name}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${f.score}%` }} />
              </div>
              <span className="text-[9px] text-gray-500 w-8 text-right font-semibold">{f.score}</span>
              <span className="text-[9px] text-gray-400">{f.lieferungen}×</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 text-[9px] text-gray-400 flex justify-between border-t border-gray-100">
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />60s Auto-Refresh</span>
        <span>Statistiken Dashboard V3</span>
      </div>
    </div>
  );
}
