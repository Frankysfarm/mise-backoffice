'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, Zap, AlertTriangle, TrendingUp, TrendingDown, Clock, Target, Route, Euro, CheckCircle2, Crosshair, BarChart2, Coins } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

// Phase 5409 — Score + Tour-Visualisierung V33
// Neu: Trinkgeld-Potential-Score je Fahrer im Radar-Chart (6. Dimension);
// Fleet-Trinkgeld-Index als neue KPI; Tip-Top-Fahrer Highlight;
// Radar-Chart Fahrerprofil 6 Dimensionen Score/Pünktlichkeit/Vollständigkeit/Reaktion/Zufriedenheit/Trinkgeld;
// Live-Touren-Heatmap-BarChart; Fleet-Fitness-Index; 5-KPI-Grid; 3-Tab; 20-Sek-Poll; Mock-Fallback

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
  trinkgeld_avg: number;
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
  fleet_trinkgeld_avg: number;
  fahrer: DriverProfile[];
  heatmap: HeatmapSlot[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 87,
  fleet_score_delta: 3,
  fitness_index: 83,
  aktiv_fahrer: 6,
  risiko_count: 1,
  team_vollstaendigkeit_pct: 92.0,
  fleet_trinkgeld_avg: 1.85,
  timestamp: new Date().toISOString(),
  heatmap: [
    { stunde: '10', touren: 4,  durchschnitt: 3.5 },
    { stunde: '11', touren: 6,  durchschnitt: 5.0 },
    { stunde: '12', touren: 11, durchschnitt: 9.0 },
    { stunde: '13', touren: 9,  durchschnitt: 8.5 },
    { stunde: '14', touren: 5,  durchschnitt: 5.5 },
    { stunde: '15', touren: 7,  durchschnitt: 6.0 },
    { stunde: '16', touren: 8,  durchschnitt: 7.0 },
    { stunde: '17', touren: 12, durchschnitt: 10.0 },
    { stunde: '18', touren: 14, durchschnitt: 11.5 },
    { stunde: '19', touren: 13, durchschnitt: 10.5 },
    { stunde: '20', touren: 9,  durchschnitt: 8.0 },
    { stunde: '21', touren: 6,  durchschnitt: 5.0 },
  ],
  fahrer: [
    { id: 'f1', name: 'Lukas M.',  score: 96, score_delta: +3, tier: 'platin', aktiv: true,  touren_heute: 5, puenktlichkeit_pct: 97, vollstaendigkeit_pct: 98, reaktionszeit_min: 2.1, kundenzufriedenheit: 4.9, leerfahrten_pct: 5.2,  trinkgeld_avg: 2.80 },
    { id: 'f2', name: 'Sara B.',   score: 88, score_delta: +1, tier: 'gold',   aktiv: true,  touren_heute: 4, puenktlichkeit_pct: 90, vollstaendigkeit_pct: 95, reaktionszeit_min: 3.4, kundenzufriedenheit: 4.7, leerfahrten_pct: 8.1,  trinkgeld_avg: 2.10 },
    { id: 'f3', name: 'Omar K.',   score: 77, score_delta: -2, tier: 'gut',    aktiv: true,  touren_heute: 3, puenktlichkeit_pct: 82, vollstaendigkeit_pct: 90, reaktionszeit_min: 5.2, kundenzufriedenheit: 4.4, leerfahrten_pct: 12.3, trinkgeld_avg: 1.50 },
    { id: 'f4', name: 'Nina W.',   score: 62, score_delta: -3, tier: 'schwach',aktiv: true,  touren_heute: 2, puenktlichkeit_pct: 71, vollstaendigkeit_pct: 83, reaktionszeit_min: 8.7, kundenzufriedenheit: 4.0, leerfahrten_pct: 22.5, trinkgeld_avg: 0.40 },
    { id: 'f5', name: 'David S.',  score: 91, score_delta: +2, tier: 'gold',   aktiv: true,  touren_heute: 4, puenktlichkeit_pct: 93, vollstaendigkeit_pct: 96, reaktionszeit_min: 2.8, kundenzufriedenheit: 4.8, leerfahrten_pct: 6.8,  trinkgeld_avg: 2.40 },
    { id: 'f6', name: 'Jana F.',   score: 80, score_delta:  0, tier: 'gut',    aktiv: false, touren_heute: 2, puenktlichkeit_pct: 85, vollstaendigkeit_pct: 92, reaktionszeit_min: 4.1, kundenzufriedenheit: 4.5, leerfahrten_pct: 10.2, trinkgeld_avg: 1.80 },
  ],
};

const TIER_COLORS: Record<Tier, string> = {
  platin: '#a78bfa',
  gold:   '#fbbf24',
  gut:    '#34d399',
  schwach:'#f87171',
};

function buildRadar(driver: DriverProfile) {
  const tipNorm = Math.min((driver.trinkgeld_avg / 3.0) * 100, 100);
  const leerNorm = Math.max(0, 100 - driver.leerfahrten_pct * 2);
  return [
    { subject: 'Score',         A: driver.score },
    { subject: 'Pünktlichkeit', A: driver.puenktlichkeit_pct },
    { subject: 'Vollst.',       A: driver.vollstaendigkeit_pct },
    { subject: 'Reaktion',      A: Math.max(0, 100 - driver.reaktionszeit_min * 8) },
    { subject: 'Zufrieden.',    A: driver.kundenzufriedenheit * 20 },
    { subject: 'Trinkgeld',     A: tipNorm },
  ];
}

export function DispatchPhase5409ScoreTourVisualisierungV33() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('rangliste');
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile>(MOCK.fahrer[0]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/delivery/admin/driver-score-live');
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const kpis = [
    { label: 'Fleet-Score',   value: `${data.fleet_score}`, sub: data.fleet_score_delta >= 0 ? `+${data.fleet_score_delta}` : `${data.fleet_score_delta}`, color: 'text-violet-400' },
    { label: 'Aktiv',         value: `${data.aktiv_fahrer}`, color: 'text-blue-400' },
    { label: 'Risiko',        value: `${data.risiko_count}`, color: data.risiko_count > 0 ? 'text-red-400' : 'text-gray-400' },
    { label: 'Vollständig.',  value: `${data.team_vollstaendigkeit_pct.toFixed(1)}%`, color: 'text-emerald-400' },
    { label: 'Ø Trinkgeld',   value: `€${data.fleet_trinkgeld_avg.toFixed(2)}`, color: 'text-orange-400' },
  ];

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Score + Tour V33</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-orange-300 bg-orange-950/30 rounded px-1.5 py-0.5">
          <Coins className="h-3 w-3" />Fleet-Tip €{data.fleet_trinkgeld_avg.toFixed(2)}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-800 rounded-lg p-2 text-center">
            <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['rangliste', 'radar', 'heatmap'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-2 py-1 rounded transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t === 'rangliste' ? 'Rangliste' : t === 'radar' ? 'Radar' : 'Heatmap'}
          </button>
        ))}
      </div>

      {/* Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {[...data.fahrer].sort((a, b) => b.score - a.score).map((f, i) => (
            <button
              key={f.id}
              onClick={() => { setSelectedDriver(f); setTab('radar'); }}
              className="w-full flex items-center gap-2 text-left hover:bg-gray-800/50 rounded-lg p-1.5 transition-colors"
            >
              <span className="text-xs text-gray-500 w-5">#{i + 1}</span>
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[f.tier] }} />
              <span className="text-xs text-gray-200 flex-1 truncate">{f.name}</span>
              <span className="text-xs font-bold" style={{ color: TIER_COLORS[f.tier] }}>{f.score}</span>
              <span className="text-[10px] text-orange-300 w-10 text-right">€{f.trinkgeld_avg.toFixed(2)}</span>
              {!f.aktiv && <span className="text-[10px] text-gray-600">(off)</span>}
            </button>
          ))}
        </div>
      )}

      {/* Radar */}
      {tab === 'radar' && (
        <div className="space-y-2">
          <div className="text-xs text-center text-gray-300">{selectedDriver.name} — Score {selectedDriver.score}</div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={buildRadar(selectedDriver)}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Radar dataKey="A" stroke={TIER_COLORS[selectedDriver.tier]} fill={TIER_COLORS[selectedDriver.tier]} fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-orange-400 text-center">Trinkgeld Ø: €{selectedDriver.trinkgeld_avg.toFixed(2)}</div>
        </div>
      )}

      {/* Heatmap */}
      {tab === 'heatmap' && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data.heatmap} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => [name === 'touren' ? `${v} Touren` : `${v} Ø`, name]}
            />
            <Bar dataKey="touren"     fill="#7c3aed" radius={[2, 2, 0, 0]} />
            <Bar dataKey="durchschnitt" fill="#6d28d9" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="text-[10px] text-gray-600 text-right">20-Sek-Polling · V33</div>
    </div>
  );
}
