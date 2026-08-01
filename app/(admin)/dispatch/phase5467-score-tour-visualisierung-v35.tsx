'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Users, Route, AlertTriangle, Zap, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

// Phase 5467 — Score + Tour-Visualisierung V35
// Neu: ETA-Abweichungs-Heatmap-Balken je Fahrer;
// Profit/Stop-Index mit Tier-Farbkodierung;
// Aktive-Tour-Zeitfortschritts-Balken;
// Fleet-Gesundheits-Score mit Drilldown;
// 6-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Profit-Stop/ETA-Drift;
// 4-Tab Rangliste/Profit/Tour-Fortschritt/ETA-Drift;
// Tier: Platin/Gold/Gut/Schwach; 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'profit' | 'fortschritt' | 'eta';

interface FahrerRow {
  id: string;
  name: string;
  score: number;
  tier: Tier;
  rank_delta: number;
  pktl_pct: number;
  vollst_pct: number;
  profit_stop: number;
  eta_drift_min: number;
  tour_progress_pct: number;
  stopps_done: number;
  stopps_total: number;
}

interface ApiData {
  fleet_score: number;
  aktiv: number;
  risiko: number;
  effizienz_pct: number;
  profit_stop_avg: number;
  eta_drift_avg: number;
  trend_data: { h: string; score: number }[];
  fahrer: FahrerRow[];
}

function mkTrend(): { h: string; score: number }[] {
  return Array.from({ length: 8 }, (_, i) => ({ h: `${10 + i}:00`, score: Math.round(68 + Math.random() * 25) }));
}

const MOCK: ApiData = {
  fleet_score: 84,
  aktiv: 5,
  risiko: 1,
  effizienz_pct: 91,
  profit_stop_avg: 3.80,
  eta_drift_avg: 1.8,
  trend_data: mkTrend(),
  fahrer: [
    { id: 'f1', name: 'Marek',  score: 97, tier: 'platin', rank_delta: 0,  pktl_pct: 96, vollst_pct: 99, profit_stop: 4.40, eta_drift_min: 0.8, tour_progress_pct: 75, stopps_done: 6, stopps_total: 8 },
    { id: 'f2', name: 'Luisa',  score: 88, tier: 'gold',   rank_delta: 1,  pktl_pct: 91, vollst_pct: 97, profit_stop: 4.10, eta_drift_min: 1.2, tour_progress_pct: 55, stopps_done: 4, stopps_total: 7 },
    { id: 'f3', name: 'Sophie', score: 79, tier: 'gut',    rank_delta: -1, pktl_pct: 85, vollst_pct: 94, profit_stop: 3.60, eta_drift_min: 2.1, tour_progress_pct: 40, stopps_done: 3, stopps_total: 7 },
    { id: 'f4', name: 'Tariq',  score: 74, tier: 'gut',    rank_delta: 0,  pktl_pct: 79, vollst_pct: 92, profit_stop: 3.30, eta_drift_min: 3.4, tour_progress_pct: 30, stopps_done: 2, stopps_total: 6 },
    { id: 'f5', name: 'Jonas',  score: 48, tier: 'schwach',rank_delta: 0,  pktl_pct: 62, vollst_pct: 87, profit_stop: 2.80, eta_drift_min: 6.2, tour_progress_pct: 20, stopps_done: 1, stopps_total: 5 },
  ],
};

const TIER_BG: Record<Tier, string>   = { platin: 'bg-violet-50 border-violet-200', gold: 'bg-amber-50 border-amber-200', gut: 'bg-blue-50 border-blue-200', schwach: 'bg-red-50 border-red-200' };
const TIER_COLOR: Record<Tier, string> = { platin: 'text-violet-700', gold: 'text-amber-600', gut: 'text-blue-600', schwach: 'text-red-600' };
const TIER_LABEL: Record<Tier, string> = { platin: '🏆 Platin', gold: '🥇 Gold', gut: '✓ Gut', schwach: '⚠ Schwach' };
const TIER_BAR: Record<Tier, string>   = { platin: '#7c3aed', gold: '#d97706', gut: '#2563eb', schwach: '#dc2626' };

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

export function DispatchPhase5467ScoreTourVisualisierungV35() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab] = useState<Tab>('rangliste');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/admin/driver-score?view=tour_viz_v35');
        if (r.ok) { const j = await r.json(); if (!cancelled) setData(j); }
      } catch { /* keep mock */ }
    };
    poll();
    const iv = setInterval(poll, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const KPIS = [
    { label: 'Fleet-Score', value: data.fleet_score,               color: data.fleet_score >= 80 ? 'text-violet-600' : 'text-amber-500' },
    { label: 'Aktive Fahrer', value: data.aktiv,                   color: 'text-indigo-600' },
    { label: 'Risiko',       value: data.risiko,                   color: data.risiko > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Effizienz',    value: `${data.effizienz_pct}%`,      color: data.effizienz_pct >= 85 ? 'text-emerald-600' : 'text-amber-500' },
    { label: '€/Stopp',      value: `€${data.profit_stop_avg.toFixed(2)}`, color: 'text-teal-600' },
    { label: 'ETA-Drift',    value: `${data.eta_drift_avg.toFixed(1)}m`,   color: data.eta_drift_avg <= 2 ? 'text-emerald-600' : data.eta_drift_avg <= 4 ? 'text-amber-500' : 'text-red-600' },
  ];

  const sorted = [...data.fahrer].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-bold text-gray-800">Score + Tour-Visualisierung V35</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">ETA-DRIFT+PROFIT</span>
        </div>
        <span className="text-lg font-black text-violet-600">{data.fleet_score}<span className="text-xs font-normal text-gray-400"> Fleet</span></span>
      </div>

      {/* 6-KPI-Grid */}
      <div className="grid grid-cols-6 gap-1">
        {KPIS.map(k => (
          <div key={k.label} className="rounded bg-gray-50 px-1 py-1 text-center">
            <div className={`text-xs font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[8px] text-gray-400 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Fleet-Score Trend */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trend_data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <XAxis dataKey="h" tick={{ fontSize: 8 }} interval={1} />
            <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => `Score ${v}`} />
            <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100 overflow-x-auto">
        {(['rangliste', 'profit', 'fortschritt', 'eta'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-1 px-2 text-xs font-bold whitespace-nowrap border-b-2 transition ${tab === t ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t === 'rangliste' ? 'Rangliste' : t === 'profit' ? 'Profit/Stopp' : t === 'fortschritt' ? 'Tour-Fortschritt' : 'ETA-Drift'}
          </button>
        ))}
      </div>

      {/* Rangliste Tab */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {sorted.map((f, i) => (
            <div key={f.id} className={`rounded-lg border px-2 py-1.5 ${TIER_BG[f.tier]}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                <span className="text-xs font-bold text-gray-700 flex-1">{f.name}</span>
                <span className={`text-[9px] font-bold ${TIER_COLOR[f.tier]}`}>{TIER_LABEL[f.tier]}</span>
                <DeltaIcon d={f.rank_delta} />
                <span className="text-sm font-black tabular-nums text-violet-600">{f.score}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: TIER_BAR[f.tier] }} />
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500 mt-0.5">
                <span>Pünktl. {f.pktl_pct}%</span>
                <span>Vollst. {f.vollst_pct}%</span>
                <span>ETA-Drift ±{f.eta_drift_min.toFixed(1)}m</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profit/Stopp Tab */}
      {tab === 'profit' && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...sorted].sort((a, b) => b.profit_stop - a.profit_stop)} margin={{ top: 2, right: 2, left: -15, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => `€${Number(v).toFixed(2)}/Stopp`} />
              <Bar dataKey="profit_stop" radius={[3, 3, 0, 0]}>
                {[...sorted].sort((a, b) => b.profit_stop - a.profit_stop).map(f => (
                  <Cell key={f.id} fill={TIER_BAR[f.tier]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tour-Fortschritt Tab */}
      {tab === 'fortschritt' && (
        <div className="space-y-2">
          {sorted.filter(f => f.stopps_done > 0).map(f => (
            <div key={f.id} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Route className="h-3 w-3 text-violet-400" />
                  <span className="font-bold text-gray-700">{f.name}</span>
                </div>
                <span className="text-gray-500 tabular-nums">{f.stopps_done}/{f.stopps_total} Stopps</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${f.tour_progress_pct}%`, background: TIER_BAR[f.tier] }}
                />
              </div>
              <div className="text-[9px] text-gray-400 text-right">{f.tour_progress_pct}% abgeschlossen</div>
            </div>
          ))}
        </div>
      )}

      {/* ETA-Drift Tab */}
      {tab === 'eta' && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400">ETA-Drift = Abweichung Ist vs. Prognose (je niedriger, desto besser)</p>
          {sorted.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 font-bold w-14 truncate">{f.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.eta_drift_min <= 1.5 ? 'bg-emerald-400' : f.eta_drift_min <= 3 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, (f.eta_drift_min / 8) * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-black tabular-nums w-10 text-right ${f.eta_drift_min <= 1.5 ? 'text-emerald-600' : f.eta_drift_min <= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                ±{f.eta_drift_min.toFixed(1)}m
              </span>
              {f.eta_drift_min > 4 && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
