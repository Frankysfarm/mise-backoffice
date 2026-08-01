'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, Zap, AlertTriangle, TrendingUp, TrendingDown, MapPin, Clock, Target, Route, Euro, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Phase 5376 — Score + Tour-Visualisierung V31
// Neu: ETA-Drift-Alert (Abweichung Ist vs. Geplant); Profit-per-Stopp-Heatmap;
// Live-Score-Ring mit Delta-Anzeige; Fleet-Effizienz-BarChart;
// 5-KPI-Grid Fleet-Score/Aktiv/Drift/Profit/Score-Δ;
// Tier-farbkodiert Platin/Gold/Gut/Schwach; aufklappbare Stopp-Timeline;
// 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'fleet' | 'profit';

interface Stop {
  nr: number;
  adresse: string;
  eta_plan_min: number;
  eta_ist_min: number | null;
  status: 'abgeschlossen' | 'aktiv' | 'ausstehend';
  profit_eur: number;
}

interface Driver {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: Tier;
  aktiv: boolean;
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  stops: Stop[];
  umsatz_eur: number;
  profit_per_stopp: number;
  eta_drift_min: number;
}

interface ApiResponse {
  fleet_score: number;
  fleet_score_delta: number;
  aktiv_fahrer: number;
  risiko_count: number;
  avg_drift_min: number;
  avg_profit_eur: number;
  fahrer: Driver[];
  timestamp: string;
}

const MOCK_STOPS: Stop[] = [
  { nr: 1, adresse: 'Adalbertsteinweg 12', eta_plan_min: 18, eta_ist_min: 20,   status: 'abgeschlossen', profit_eur: 4.20 },
  { nr: 2, adresse: 'Jülicher Str. 88',    eta_plan_min: 28, eta_ist_min: 31,   status: 'aktiv',         profit_eur: 3.80 },
  { nr: 3, adresse: 'Pontstr. 44',         eta_plan_min: 38, eta_ist_min: null, status: 'ausstehend',    profit_eur: 5.10 },
];

const MOCK: ApiResponse = {
  fleet_score: 84,
  fleet_score_delta: 3,
  aktiv_fahrer: 6,
  risiko_count: 1,
  avg_drift_min: 2.4,
  avg_profit_eur: 4.1,
  timestamp: new Date().toISOString(),
  fahrer: [
    { id: 'f1', name: 'Lukas M.',  score: 94, score_delta: +5, tier: 'platin',  aktiv: true,  touren_heute: 4, avg_lieferzeit_min: 24, puenktlichkeit_pct: 96, stops: MOCK_STOPS, umsatz_eur: 142, profit_per_stopp: 5.1, eta_drift_min: 0.8 },
    { id: 'f2', name: 'Sara B.',   score: 88, score_delta: +2, tier: 'gold',    aktiv: true,  touren_heute: 3, avg_lieferzeit_min: 27, puenktlichkeit_pct: 91, stops: MOCK_STOPS, umsatz_eur: 118, profit_per_stopp: 4.6, eta_drift_min: 2.1 },
    { id: 'f3', name: 'Omar K.',   score: 76, score_delta: -1, tier: 'gut',     aktiv: true,  touren_heute: 3, avg_lieferzeit_min: 31, puenktlichkeit_pct: 85, stops: MOCK_STOPS, umsatz_eur: 97,  profit_per_stopp: 3.9, eta_drift_min: 4.3 },
    { id: 'f4', name: 'Nina W.',   score: 61, score_delta: -4, tier: 'schwach', aktiv: true,  touren_heute: 2, avg_lieferzeit_min: 38, puenktlichkeit_pct: 72, stops: MOCK_STOPS, umsatz_eur: 74,  profit_per_stopp: 3.1, eta_drift_min: 8.6 },
    { id: 'f5', name: 'David S.',  score: 91, score_delta: +3, tier: 'gold',    aktiv: true,  touren_heute: 4, avg_lieferzeit_min: 25, puenktlichkeit_pct: 93, stops: MOCK_STOPS, umsatz_eur: 131, profit_per_stopp: 4.8, eta_drift_min: 1.5 },
    { id: 'f6', name: 'Jana F.',   score: 79, score_delta: 0,  tier: 'gut',     aktiv: false, touren_heute: 2, avg_lieferzeit_min: 29, puenktlichkeit_pct: 88, stops: [],         umsatz_eur: 82,  profit_per_stopp: 4.2, eta_drift_min: 3.0 },
  ],
};

const TIER_COLORS: Record<Tier, string> = {
  platin: 'text-cyan-300 border-cyan-600 bg-cyan-950/40',
  gold:   'text-yellow-300 border-yellow-600 bg-yellow-950/30',
  gut:    'text-emerald-300 border-emerald-700 bg-emerald-950/30',
  schwach:'text-zinc-400 border-zinc-600 bg-zinc-900/40',
};

const TIER_BADGE: Record<Tier, string> = {
  platin: 'bg-cyan-800 text-cyan-100',
  gold:   'bg-yellow-800 text-yellow-100',
  gut:    'bg-emerald-800 text-emerald-100',
  schwach:'bg-zinc-700 text-zinc-300',
};

function driftColor(min: number): string {
  if (min <= 1) return 'text-emerald-400';
  if (min <= 4) return 'text-amber-400';
  return 'text-red-400';
}

function stopStatusColor(s: Stop['status']): string {
  if (s === 'abgeschlossen') return 'bg-emerald-500';
  if (s === 'aktiv')         return 'bg-blue-400 animate-pulse';
  return 'bg-zinc-600';
}

export function DispatchPhase5376ScoreTourVisualisierungV31() {
  const [data, setData]   = useState<ApiResponse>(MOCK);
  const [tab, setTab]     = useState<Tab>('rangliste');
  const [expanded, setExpanded] = useState<string | null>(null);
  const ivRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/dispatch/fleet?include_stops=1', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 20_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const highDrift = data.fahrer.filter(f => f.eta_drift_min > 5 && f.aktiv);
  const chartData = data.fahrer.map(f => ({ name: f.name.split(' ')[0], score: f.score, drift: f.eta_drift_min }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Score + Tour V31</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${data.fleet_score >= 85 ? 'text-emerald-400' : data.fleet_score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.fleet_score}
          </span>
          {data.fleet_score_delta !== 0 && (
            <span className={`text-xs ${data.fleet_score_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.fleet_score_delta > 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
              {Math.abs(data.fleet_score_delta)}
            </span>
          )}
        </div>
      </div>

      {/* ETA-Drift Alert */}
      {highDrift.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-950/30 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[11px] text-red-300">
            ETA-Drift &gt;5min: {highDrift.map(f => f.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      )}

      {/* 5-KPI Grid */}
      <div className="grid grid-cols-5 gap-1">
        {[
          { label: 'Score',   value: data.fleet_score,        color: 'text-violet-300' },
          { label: 'Aktiv',   value: data.aktiv_fahrer,       color: 'text-blue-300' },
          { label: 'Risiko',  value: data.risiko_count,        color: 'text-red-400' },
          { label: 'Ø Drift', value: `${data.avg_drift_min.toFixed(1)}m`, color: driftColor(data.avg_drift_min) },
          { label: 'Ø €/Stp', value: `${data.avg_profit_eur.toFixed(2)}`, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="rounded-md bg-zinc-900 p-1.5 text-center">
            <div className="text-[9px] text-zinc-500 mb-0.5">{k.label}</div>
            <div className={`text-xs font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['rangliste', 'fleet', 'profit'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${tab === t ? 'bg-violet-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'rangliste' ? 'Rangliste' : t === 'fleet' ? 'Fleet' : 'Profit'}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {[...data.fahrer].sort((a, b) => b.score - a.score).map((f, i) => (
            <div key={f.id}>
              <button
                onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                className={`w-full rounded-lg border p-2 text-left transition-colors ${TIER_COLORS[f.tier]}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">#{i + 1}</span>
                    <span className="text-xs font-semibold text-zinc-200">{f.name}</span>
                    {!f.aktiv && <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1 rounded">Offline</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TIER_BADGE[f.tier]}`}>
                      {f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}
                    </span>
                    <span className={`text-sm font-bold ${f.tier === 'platin' ? 'text-cyan-300' : f.tier === 'gold' ? 'text-yellow-300' : f.tier === 'gut' ? 'text-emerald-300' : 'text-zinc-400'}`}>
                      {f.score}
                    </span>
                    {f.score_delta !== 0 && (
                      <span className={`text-[10px] ${f.score_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                  <span><Clock className="w-2.5 h-2.5 inline" /> {f.avg_lieferzeit_min}min</span>
                  <span><Target className="w-2.5 h-2.5 inline" /> {f.puenktlichkeit_pct}%</span>
                  <span className={driftColor(f.eta_drift_min)}>Drift: {f.eta_drift_min.toFixed(1)}min</span>
                </div>
              </button>
              {/* Expanded Stopp-Timeline */}
              {expanded === f.id && f.stops.length > 0 && (
                <div className="ml-3 mt-1 space-y-1 border-l-2 border-violet-800 pl-3">
                  {f.stops.map(s => (
                    <div key={s.nr} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stopStatusColor(s.status)}`} />
                      <span className="text-[10px] text-zinc-400 flex-1 truncate">{s.adresse}</span>
                      <span className={`text-[10px] ${s.eta_ist_min && s.eta_ist_min > s.eta_plan_min + 3 ? 'text-red-400' : 'text-zinc-500'}`}>
                        {s.eta_ist_min ?? s.eta_plan_min}min
                      </span>
                      <span className="text-[10px] text-emerald-400">{s.profit_eur.toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Fleet Chart */}
      {tab === 'fleet' && (
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Fleet-Score je Fahrer</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }}
                labelStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => [v, 'Score']}
              />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.score >= 90 ? '#22d3ee' : d.score >= 80 ? '#fbbf24' : d.score >= 70 ? '#34d399' : '#71717a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-zinc-500 mt-2 mb-1">ETA-Drift je Fahrer (min)</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }}
                formatter={(v: number) => [v.toFixed(1) + 'min', 'Drift']}
              />
              <Bar dataKey="drift" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.drift <= 1 ? '#34d399' : d.drift <= 4 ? '#fbbf24' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: Profit */}
      {tab === 'profit' && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {[...data.fahrer].sort((a, b) => b.profit_per_stopp - a.profit_per_stopp).map((f, i) => (
            <div key={f.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500">#{i + 1}</span>
                  <span className="text-xs text-zinc-200">{f.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500"><Euro className="w-2.5 h-2.5 inline" />{f.umsatz_eur}</span>
                  <span className="text-xs font-bold text-emerald-400">{f.profit_per_stopp.toFixed(2)}€/Stp</span>
                </div>
              </div>
              <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, (f.profit_per_stopp / 6) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <Route className="w-3 h-3 inline mr-1" />
        20s-Poll · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}
