'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, Zap, AlertTriangle, TrendingUp, TrendingDown, Clock, Target, Route, Euro, CheckCircle2, Crosshair, BarChart2 } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

// Phase 5396 — Score + Tour-Visualisierung V32
// Neu: Radar-Chart Fahrerprofil (Score/Pünktlichkeit/Vollständigkeit/Reaktion/Zufriedenheit);
// Live-Touren-Heatmap-Balken Zeitzonen; KPI-Rang-Badges; Fleet-Fitness-Index;
// 5-KPI-Grid Fleet-Score/Aktiv/Risiko/Vollständigkeit/Fitness;
// 3-Tab-Nav Rangliste/Radar/Heatmap; 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'radar' | 'heatmap';

interface DriverProfile {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: Tier;
  aktiv: boolean;
  touren_heute: number;
  puenktlichkeit_pct: number;
  vollstaendigkeit_pct: number;
  reaktionszeit_min: number;
  kundenzufriedenheit: number;
  leerfahrten_pct: number;
}

interface HeatmapSlot {
  stunde: string;
  touren: number;
  durchschnitt: number;
}

interface ApiResponse {
  fleet_score: number;
  fleet_score_delta: number;
  fitness_index: number;
  aktiv_fahrer: number;
  risiko_count: number;
  team_vollstaendigkeit_pct: number;
  fahrer: DriverProfile[];
  heatmap: HeatmapSlot[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 86,
  fleet_score_delta: 4,
  fitness_index: 82,
  aktiv_fahrer: 6,
  risiko_count: 1,
  team_vollstaendigkeit_pct: 91.5,
  timestamp: new Date().toISOString(),
  heatmap: [
    { stunde: '10', touren: 4, durchschnitt: 3.5 },
    { stunde: '11', touren: 6, durchschnitt: 5.0 },
    { stunde: '12', touren: 11, durchschnitt: 9.0 },
    { stunde: '13', touren: 9, durchschnitt: 8.5 },
    { stunde: '14', touren: 5, durchschnitt: 5.5 },
    { stunde: '15', touren: 7, durchschnitt: 6.0 },
    { stunde: '16', touren: 8, durchschnitt: 7.0 },
    { stunde: '17', touren: 12, durchschnitt: 10.0 },
    { stunde: '18', touren: 14, durchschnitt: 11.5 },
    { stunde: '19', touren: 13, durchschnitt: 10.5 },
    { stunde: '20', touren: 9, durchschnitt: 8.0 },
    { stunde: '21', touren: 6, durchschnitt: 5.0 },
  ],
  fahrer: [
    { id: 'f1', name: 'Lukas M.',  score: 96, score_delta: +3, tier: 'platin', aktiv: true,  touren_heute: 5, puenktlichkeit_pct: 97, vollstaendigkeit_pct: 98, reaktionszeit_min: 2.1, kundenzufriedenheit: 4.9, leerfahrten_pct: 5.2 },
    { id: 'f2', name: 'Sara B.',   score: 88, score_delta: +1, tier: 'gold',   aktiv: true,  touren_heute: 4, puenktlichkeit_pct: 90, vollstaendigkeit_pct: 95, reaktionszeit_min: 3.4, kundenzufriedenheit: 4.7, leerfahrten_pct: 8.1 },
    { id: 'f3', name: 'Omar K.',   score: 77, score_delta: -2, tier: 'gut',    aktiv: true,  touren_heute: 3, puenktlichkeit_pct: 82, vollstaendigkeit_pct: 90, reaktionszeit_min: 5.2, kundenzufriedenheit: 4.4, leerfahrten_pct: 12.3 },
    { id: 'f4', name: 'Nina W.',   score: 62, score_delta: -3, tier: 'schwach',aktiv: true,  touren_heute: 2, puenktlichkeit_pct: 71, vollstaendigkeit_pct: 83, reaktionszeit_min: 8.7, kundenzufriedenheit: 4.0, leerfahrten_pct: 22.5 },
    { id: 'f5', name: 'David S.',  score: 91, score_delta: +2, tier: 'gold',   aktiv: true,  touren_heute: 4, puenktlichkeit_pct: 93, vollstaendigkeit_pct: 96, reaktionszeit_min: 2.8, kundenzufriedenheit: 4.8, leerfahrten_pct: 6.8 },
    { id: 'f6', name: 'Jana F.',   score: 80, score_delta:  0, tier: 'gut',    aktiv: false, touren_heute: 2, puenktlichkeit_pct: 85, vollstaendigkeit_pct: 92, reaktionszeit_min: 4.1, kundenzufriedenheit: 4.5, leerfahrten_pct: 10.2 },
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

export function DispatchPhase5396ScoreTourVisualisierungV32() {
  const [data, setData]   = useState<ApiResponse>(MOCK);
  const [tab, setTab]     = useState<Tab>('rangliste');
  const [selected, setSelected] = useState<string | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/dispatch/fleet?include_profile=1&v=32', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 20_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const selectedDriver = data.fahrer.find(f => f.id === selected);
  const radarData = selectedDriver ? [
    { metric: 'Score',          value: selectedDriver.score },
    { metric: 'Pünktlichkeit',  value: selectedDriver.puenktlichkeit_pct },
    { metric: 'Vollständigkeit',value: selectedDriver.vollstaendigkeit_pct },
    { metric: 'Reaktion',       value: Math.max(0, 100 - selectedDriver.reaktionszeit_min * 8) },
    { metric: 'Zufriedenheit',  value: selectedDriver.kundenzufriedenheit * 20 },
  ] : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Score + Tour V32</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* 5-KPI Grid */}
      <div className="grid grid-cols-5 gap-1">
        {[
          { label: 'Score',    value: data.fleet_score,               color: 'text-violet-300' },
          { label: 'Aktiv',    value: data.aktiv_fahrer,              color: 'text-blue-300' },
          { label: 'Risiko',   value: data.risiko_count,               color: 'text-red-400' },
          { label: 'Vollst.',  value: `${data.team_vollstaendigkeit_pct}%`, color: 'text-emerald-400' },
          { label: 'Fitness',  value: data.fitness_index,             color: data.fitness_index >= 80 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="rounded-md bg-zinc-900 p-1.5 text-center">
            <div className="text-[9px] text-zinc-500 mb-0.5">{k.label}</div>
            <div className={`text-xs font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['rangliste', 'radar', 'heatmap'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${tab === t ? 'bg-violet-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'rangliste' ? 'Rangliste' : t === 'radar' ? 'Profil' : 'Heatmap'}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {[...data.fahrer].sort((a, b) => b.score - a.score).map((f, i) => (
            <button
              key={f.id}
              onClick={() => { setSelected(f.id === selected ? null : f.id); setTab(f.id === selected ? 'rangliste' : 'radar'); }}
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
                  <span className="text-sm font-bold text-zinc-200">{f.score}</span>
                  {f.score_delta !== 0 && (
                    <span className={`text-[10px] ${f.score_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                <span><Clock className="w-2.5 h-2.5 inline" /> {f.puenktlichkeit_pct}%</span>
                <span><CheckCircle2 className="w-2.5 h-2.5 inline" /> {f.vollstaendigkeit_pct}%</span>
                <span><Target className="w-2.5 h-2.5 inline" /> {f.kundenzufriedenheit}★</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tab: Radar-Profil */}
      {tab === 'radar' && (
        <div>
          {selectedDriver ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">{selectedDriver.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${TIER_BADGE[selectedDriver.tier]}`}>
                  {selectedDriver.tier.charAt(0).toUpperCase() + selectedDriver.tier.slice(1)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#71717a', fontSize: 9 }} />
                  <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded-md bg-zinc-900 p-1.5">
                  <span className="text-zinc-500">Pünktlichkeit</span>
                  <span className="float-right font-bold text-zinc-200">{selectedDriver.puenktlichkeit_pct}%</span>
                </div>
                <div className="rounded-md bg-zinc-900 p-1.5">
                  <span className="text-zinc-500">Vollständigkeit</span>
                  <span className="float-right font-bold text-zinc-200">{selectedDriver.vollstaendigkeit_pct}%</span>
                </div>
                <div className="rounded-md bg-zinc-900 p-1.5">
                  <span className="text-zinc-500">Reaktionszeit</span>
                  <span className="float-right font-bold text-zinc-200">{selectedDriver.reaktionszeit_min}min</span>
                </div>
                <div className="rounded-md bg-zinc-900 p-1.5">
                  <span className="text-zinc-500">Leerfahrten</span>
                  <span className="float-right font-bold text-zinc-200">{selectedDriver.leerfahrten_pct}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 text-xs py-8">
              <Crosshair className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Fahrer in Rangliste auswählen für Radar-Profil
            </div>
          )}
        </div>
      )}

      {/* Tab: Heatmap */}
      {tab === 'heatmap' && (
        <div>
          <div className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1">
            <BarChart2 className="w-3 h-3" /> Touren-Verteilung heute (blau=Ist, grau=Ø)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.heatmap} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 10 }}
                formatter={(v, n) => [v as number, n === 'touren' ? 'Touren' : 'Durchschnitt']}
              />
              <Bar dataKey="durchschnitt" fill="#3f3f46" radius={[2, 2, 0, 0]} />
              <Bar dataKey="touren" radius={[3, 3, 0, 0]}>
                {data.heatmap.map((h, i) => (
                  <Cell key={i} fill={h.touren > h.durchschnitt * 1.2 ? '#f87171' : h.touren > h.durchschnitt ? '#fbbf24' : '#818cf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 text-[9px] text-zinc-500 mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-400 rounded-sm inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm inline-block" /> Überdurchschnittlich</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm inline-block" /> Rush</span>
          </div>
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <Route className="w-3 h-3 inline mr-1" />
        20s-Poll · V32 · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}
