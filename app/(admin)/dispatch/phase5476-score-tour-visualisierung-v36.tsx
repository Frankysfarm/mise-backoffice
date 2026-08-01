'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, MapPin, Gauge, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, AreaChart, Area } from 'recharts';

// Phase 5476 — Score + Tour-Visualisierung V36
// Neu: Zonen-zu-Zonen Profit-Matrix (Heatmap-Grid je Zone);
// Echtzeit-Effizienz-Score-Stream (LiveArea 30s-Punkte);
// Fahrer-Kapazitäts-Prognose (Verfügbarkeit +60 Min);
// Kritische-Lieferung-Eskalations-Alert;
// 7-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Profit-Stop/ETA-Drift/Kapazität;
// 5-Tab Rangliste/Profit/Tour-Fortschritt/Zonen-Matrix/Kapazität;
// Tier: Platin/Gold/Gut/Schwach; 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'profit' | 'fortschritt' | 'zonen' | 'kapazitaet';

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
  kapazitaet_pct: number;
}

interface ZoneProfit {
  zone: string;
  profit_eur: number;
  bestellungen: number;
  ampel: 'hoch' | 'mittel' | 'niedrig';
}

interface KapazitaetsPoint {
  label: string;
  verfuegbar: number;
  benoetigt: number;
}

interface ApiData {
  fleet_score: number;
  aktiv: number;
  risiko: number;
  effizienz_pct: number;
  profit_stop_avg: number;
  eta_drift_avg: number;
  kapazitaet_pct: number;
  score_stream: { t: string; score: number }[];
  fahrer: FahrerRow[];
  zonen_matrix: ZoneProfit[];
  kapazitaets_prognose: KapazitaetsPoint[];
  eskalation_count: number;
}

const TIER_COLORS: Record<Tier, string> = {
  platin: '#e2e8f0',
  gold:   '#fbbf24',
  gut:    '#4ade80',
  schwach: '#f87171',
};

const TIER_BG: Record<Tier, string> = {
  platin: 'bg-slate-200/10 text-slate-200',
  gold:   'bg-yellow-400/10 text-yellow-400',
  gut:    'bg-green-400/10 text-green-400',
  schwach:'bg-red-400/10 text-red-400',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function mkStream() {
  return Array.from({ length: 10 }, (_, i) => ({ t: `T-${(9 - i) * 2}m`, score: Math.round(72 + Math.sin(i * 0.8) * 12) }));
}

function mkFahrer(): FahrerRow[] {
  const names = ['Julia F.', 'Max M.', 'Sara K.', 'Tim B.', 'Anna S.'];
  const tiers: Tier[] = ['platin', 'gold', 'gut', 'gut', 'schwach'];
  return names.map((name, i) => ({
    id: `f${i+1}`, name, tier: tiers[i],
    score: 95 - i * 9, rank_delta: [1, 0, -1, 0, -2][i],
    pktl_pct: 96 - i * 5, vollst_pct: 99 - i * 3,
    profit_stop: parseFloat((3.8 - i * 0.4).toFixed(1)),
    eta_drift_min: parseFloat((0.8 + i * 1.1).toFixed(1)),
    tour_progress_pct: [80, 65, 40, 55, 20][i],
    stopps_done: [8, 5, 3, 4, 2][i], stopps_total: [10, 8, 7, 7, 10][i],
    kapazitaet_pct: [90, 75, 50, 60, 30][i],
  }));
}

const MOCK: ApiData = {
  fleet_score: 86, aktiv: 5, risiko: 1, effizienz_pct: 88,
  profit_stop_avg: 3.1, eta_drift_avg: 1.8, kapazitaet_pct: 72,
  eskalation_count: 1,
  score_stream: mkStream(),
  fahrer: mkFahrer(),
  zonen_matrix: [
    { zone: 'Nord',   profit_eur: 142, bestellungen: 18, ampel: 'hoch'   },
    { zone: 'Mitte',  profit_eur:  98, bestellungen: 13, ampel: 'mittel' },
    { zone: 'Süd',    profit_eur:  67, bestellungen:  9, ampel: 'mittel' },
    { zone: 'West',   profit_eur:  31, bestellungen:  5, ampel: 'niedrig'},
    { zone: 'Ost',    profit_eur:  88, bestellungen: 11, ampel: 'mittel' },
  ],
  kapazitaets_prognose: [
    { label: '+15m', verfuegbar: 5, benoetigt: 4 },
    { label: '+30m', verfuegbar: 4, benoetigt: 6 },
    { label: '+45m', verfuegbar: 3, benoetigt: 5 },
    { label: '+60m', verfuegbar: 5, benoetigt: 3 },
  ],
};

function zoneAmpelColor(a: ZoneProfit['ampel']): string {
  if (a === 'hoch')    return '#4ade80';
  if (a === 'mittel')  return '#fbbf24';
  return '#f87171';
}

export function DispatchPhase5476ScoreTourVisualisierungV36() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab]   = useState<Tab>('rangliste');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/dispatch/fleet-score');
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rangliste',  label: 'Rangliste' },
    { key: 'profit',     label: 'Profit'    },
    { key: 'fortschritt',label: 'Fortschritt'},
    { key: 'zonen',      label: 'Zonen'     },
    { key: 'kapazitaet', label: 'Kapazität' },
  ];

  const maxZoneProfit = Math.max(...data.zonen_matrix.map(z => z.profit_eur), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.eskalation_count > 0 ? 'border-red-700/50' : 'border-violet-700/40'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-white">Score & Tour-Visualisierung V36</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.eskalation_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.eskalation_count} Eskalation
          </div>
        )}
      </div>

      {/* 7-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="rounded bg-gray-800 px-1.5 py-1.5 col-span-1">
          <div className="text-[9px] text-gray-400">Fleet</div>
          <div className="text-sm font-black text-violet-400">{data.fleet_score}</div>
        </div>
        {[
          { label: 'Aktiv',    value: data.aktiv,           color: 'text-white' },
          { label: 'Risiko',   value: data.risiko,          color: data.risiko > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Eff%',     value: `${data.effizienz_pct}%`, color: 'text-green-400' },
          { label: '€/Stopp',  value: `${data.profit_stop_avg}`, color: 'text-emerald-400' },
          { label: 'ETA-Δ',    value: `${data.eta_drift_avg}m`,  color: 'text-amber-400' },
          { label: 'Kap%',     value: `${data.kapazitaet_pct}%`, color: 'text-cyan-400' },
        ].map(k => (
          <div key={k.label} className="rounded bg-gray-800 px-1 py-1.5">
            <div className="text-[9px] text-gray-400">{k.label}</div>
            <div className={`text-xs font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              tab === t.key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1">
          {data.fahrer.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 rounded bg-gray-800/60 px-2 py-1">
              <span className="text-[10px] text-gray-500 w-3">{i + 1}</span>
              <span className={`text-[9px] px-1 rounded ${TIER_BG[f.tier]}`}>{f.tier.charAt(0).toUpperCase()}</span>
              <span className="text-[10px] text-white truncate flex-1">{f.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono" style={{ color: TIER_COLORS[f.tier] }}>{f.score}</span>
                <DeltaIcon d={f.rank_delta} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Profit */}
      {tab === 'profit' && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-400">Echtzeit-Effizienz-Score-Stream</div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={data.score_stream}>
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', fontSize: 9 }} formatter={(v) => [(v as number | undefined) ?? 0, 'Score']} />
              <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="#a78bfa33" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            {data.fahrer.slice(0, 4).map(f => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="text-[10px] text-white truncate w-16">{f.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${f.vollst_pct}%`, backgroundColor: TIER_COLORS[f.tier] }}
                  />
                </div>
                <span className="text-[10px] font-mono text-emerald-400 w-10 text-right">€{f.profit_stop.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Fortschritt */}
      {tab === 'fortschritt' && (
        <div className="space-y-1.5">
          {data.fahrer.map(f => (
            <div key={f.id} className="space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white">{f.name}</span>
                <span className="text-[10px] text-gray-400">{f.stopps_done}/{f.stopps_total} Stopps</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${f.tour_progress_pct}%`, backgroundColor: TIER_COLORS[f.tier] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Zonen-Matrix */}
      {tab === 'zonen' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-400">Zonen-Profit-Matrix</div>
          {data.zonen_matrix.map(z => (
            <div key={z.zone} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: zoneAmpelColor(z.ampel) }} />
              <span className="text-[10px] text-white w-10">{z.zone}</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(z.profit_eur / maxZoneProfit) * 100}%`, backgroundColor: zoneAmpelColor(z.ampel) }}
                />
              </div>
              <span className="text-[10px] font-mono text-emerald-400 w-12 text-right">€{z.profit_eur}</span>
              <span className="text-[10px] text-gray-500">{z.bestellungen}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Kapazität */}
      {tab === 'kapazitaet' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-400">Kapazitäts-Prognose +60 Min</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.kapazitaets_prognose} barSize={16}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', fontSize: 9 }} />
              <Bar dataKey="verfuegbar" name="Verfügbar" fill="#4ade80" radius={[2,2,0,0]} />
              <Bar dataKey="benoetigt" name="Benötigt"  fill="#f87171" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" />Verfügbar</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Benötigt</span>
          </div>
          <div className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] text-gray-300">Aktuelle Kapazität:</span>
            <span className="text-[10px] font-bold text-cyan-400">{data.kapazitaet_pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
