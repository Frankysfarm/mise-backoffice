'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Trophy, Clock, Euro, Star, Truck, Users, Target, BarChart3, Zap, CheckCircle2, Route, MapPin, Coins } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

// Phase 5410 — Statistiken-Dashboard V46
// Neu: Trinkgeld-KPI-Widget Fleet-Ø + Top-Fahrer; Trinkgeld-Wochen-Trend-LineChart;
// Fahrer-Tabelle erweitert um trinkgeld_avg; Fitness-Index mit Trinkgeld-Faktor;
// 11-KPI-Grid 5-spaltig inkl. Trinkgeld-Score; 7-Tab-Nav inkl. Trinkgeld-Tab;
// 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'vollstaendigkeit' | 'leerfahrten' | 'trinkgeld' | 'bilanz';
type Ampel = 'gruen' | 'gelb' | 'rot';
type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface KpiItem {
  label: string;
  value: string;
  delta_pct: number;
  ampel: Ampel;
  icon: string;
}

interface StundeItem {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit: number;
  vollstaendigkeit: number;
}

interface FahrerItem {
  name: string;
  rang: number;
  score: number;
  tier: Tier;
  lieferungen: number;
  avg_min: number;
  trinkgeld_avg: number;
  puenktlichkeit_pct: number;
  vollstaendigkeit_pct: number;
  leerfahrten_pct: number;
  score_delta: number;
}

interface TrinkgeldPoint {
  tag: string;
  avg: number;
  ziel: number;
}

interface ApiResponse {
  kpis: KpiItem[];
  stunden: StundeItem[];
  fahrer: FahrerItem[];
  vollstaendigkeit_trend: { stunde: string; pct: number; ziel: number }[];
  leerfahrten_trend: { tag: string; pct: number; ziel: number }[];
  trinkgeld_trend: TrinkgeldPoint[];
  fleet_trinkgeld_avg: number;
  trinkgeld_score: number;
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_trinkgeld_avg: 1.85,
  trinkgeld_score: 78,
  timestamp: new Date().toISOString(),
  kpis: [
    { label: 'Bestellungen',   value: '142',    delta_pct: 8.2,  ampel: 'gruen', icon: 'package' },
    { label: 'Umsatz',         value: '€2.847', delta_pct: 6.1,  ampel: 'gruen', icon: 'euro' },
    { label: 'Ø Lieferzeit',   value: '28 min', delta_pct: -3.5, ampel: 'gruen', icon: 'clock' },
    { label: 'Pünktlichkeit',  value: '88%',    delta_pct: 1.2,  ampel: 'gruen', icon: 'check' },
    { label: 'Storno-Rate',    value: '2.1%',   delta_pct: -0.4, ampel: 'gelb',  icon: 'x' },
    { label: 'Vollständigkeit',value: '92%',    delta_pct: 2.1,  ampel: 'gruen', icon: 'check' },
    { label: 'Leerfahrten',    value: '12%',    delta_pct: -1.5, ampel: 'gelb',  icon: 'route' },
    { label: 'Fitness-Index',  value: '84',     delta_pct: 3.0,  ampel: 'gruen', icon: 'zap' },
    { label: 'Aktive Fahrer',  value: '6',      delta_pct: 0,    ampel: 'gruen', icon: 'users' },
    { label: 'Trinkgeld-Score',value: '78',     delta_pct: 5.3,  ampel: 'gruen', icon: 'coins' },
    { label: 'Ø Trinkgeld',    value: '€1.85',  delta_pct: 4.2,  ampel: 'gruen', icon: 'coins' },
  ],
  stunden: [
    { stunde: '10', bestellungen: 8,  umsatz: 160, puenktlichkeit: 92, vollstaendigkeit: 94 },
    { stunde: '11', bestellungen: 12, umsatz: 240, puenktlichkeit: 90, vollstaendigkeit: 93 },
    { stunde: '12', bestellungen: 22, umsatz: 440, puenktlichkeit: 85, vollstaendigkeit: 90 },
    { stunde: '13', bestellungen: 18, umsatz: 360, puenktlichkeit: 87, vollstaendigkeit: 91 },
    { stunde: '14', bestellungen: 10, umsatz: 200, puenktlichkeit: 91, vollstaendigkeit: 95 },
    { stunde: '15', bestellungen: 14, umsatz: 280, puenktlichkeit: 89, vollstaendigkeit: 93 },
    { stunde: '16', bestellungen: 16, umsatz: 320, puenktlichkeit: 88, vollstaendigkeit: 92 },
    { stunde: '17', bestellungen: 24, umsatz: 480, puenktlichkeit: 84, vollstaendigkeit: 89 },
    { stunde: '18', bestellungen: 28, umsatz: 560, puenktlichkeit: 82, vollstaendigkeit: 88 },
    { stunde: '19', bestellungen: 26, umsatz: 520, puenktlichkeit: 83, vollstaendigkeit: 89 },
    { stunde: '20', bestellungen: 18, umsatz: 360, puenktlichkeit: 86, vollstaendigkeit: 91 },
    { stunde: '21', bestellungen: 12, umsatz: 240, puenktlichkeit: 90, vollstaendigkeit: 93 },
  ],
  fahrer: [
    { name: 'Lukas M.',  rang: 1, score: 96, tier: 'platin', lieferungen: 18, avg_min: 24, trinkgeld_avg: 2.80, puenktlichkeit_pct: 97, vollstaendigkeit_pct: 98, leerfahrten_pct: 5.2,  score_delta: 3 },
    { name: 'David S.',  rang: 2, score: 91, tier: 'gold',   lieferungen: 15, avg_min: 26, trinkgeld_avg: 2.40, puenktlichkeit_pct: 93, vollstaendigkeit_pct: 96, leerfahrten_pct: 6.8,  score_delta: 2 },
    { name: 'Sara B.',   rang: 3, score: 88, tier: 'gold',   lieferungen: 14, avg_min: 27, trinkgeld_avg: 2.10, puenktlichkeit_pct: 90, vollstaendigkeit_pct: 95, leerfahrten_pct: 8.1,  score_delta: 1 },
    { name: 'Jana F.',   rang: 4, score: 80, tier: 'gut',    lieferungen: 10, avg_min: 30, trinkgeld_avg: 1.80, puenktlichkeit_pct: 85, vollstaendigkeit_pct: 92, leerfahrten_pct: 10.2, score_delta: 0 },
    { name: 'Omar K.',   rang: 5, score: 77, tier: 'gut',    lieferungen: 12, avg_min: 31, trinkgeld_avg: 1.50, puenktlichkeit_pct: 82, vollstaendigkeit_pct: 90, leerfahrten_pct: 12.3, score_delta: -2 },
    { name: 'Nina W.',   rang: 6, score: 62, tier: 'schwach',lieferungen: 8,  avg_min: 38, trinkgeld_avg: 0.40, puenktlichkeit_pct: 71, vollstaendigkeit_pct: 83, leerfahrten_pct: 22.5, score_delta: -3 },
  ],
  vollstaendigkeit_trend: [
    { stunde: '10', pct: 94, ziel: 95 },
    { stunde: '12', pct: 90, ziel: 95 },
    { stunde: '14', pct: 95, ziel: 95 },
    { stunde: '16', pct: 92, ziel: 95 },
    { stunde: '18', pct: 88, ziel: 95 },
    { stunde: '20', pct: 91, ziel: 95 },
  ],
  leerfahrten_trend: [
    { tag: 'Mo', pct: 14, ziel: 15 },
    { tag: 'Di', pct: 12, ziel: 15 },
    { tag: 'Mi', pct: 11, ziel: 15 },
    { tag: 'Do', pct: 13, ziel: 15 },
    { tag: 'Fr', pct: 10, ziel: 15 },
    { tag: 'Sa', pct: 9,  ziel: 15 },
    { tag: 'So', pct: 12, ziel: 15 },
  ],
  trinkgeld_trend: [
    { tag: 'Mo', avg: 1.60, ziel: 2.00 },
    { tag: 'Di', avg: 1.75, ziel: 2.00 },
    { tag: 'Mi', avg: 1.85, ziel: 2.00 },
    { tag: 'Do', avg: 1.70, ziel: 2.00 },
    { tag: 'Fr', avg: 2.10, ziel: 2.00 },
    { tag: 'Sa', avg: 2.30, ziel: 2.00 },
    { tag: 'So', avg: 1.90, ziel: 2.00 },
  ],
};

const AMPEL_DOT: Record<Ampel, string> = {
  gruen: 'bg-emerald-400',
  gelb:  'bg-amber-400',
  rot:   'bg-red-400',
};

const TIER_LABEL: Record<Tier, string> = {
  platin: 'Platin',
  gold:   'Gold',
  gut:    'Gut',
  schwach:'Schwach',
};

const TIER_COLOR: Record<Tier, string> = {
  platin: 'text-violet-400',
  gold:   'text-amber-400',
  gut:    'text-emerald-400',
  schwach:'text-red-400',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'ueberblick',     label: 'Überblick' },
  { key: 'stunden',        label: 'Stunden' },
  { key: 'fahrer',         label: 'Fahrer' },
  { key: 'vollstaendigkeit',label: 'Vollst.' },
  { key: 'leerfahrten',   label: 'Leerfahrt' },
  { key: 'trinkgeld',     label: 'Trinkgeld' },
  { key: 'bilanz',        label: 'Bilanz' },
];

export function LieferdienstPhase5410StatistikenDashboardV46() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/delivery/lieferdienst/statistiken');
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 45_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-white">Statistiken-Dashboard V46</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-orange-300">
          <Coins className="h-3 w-3" />
          Ø €{data.fleet_trinkgeld_avg.toFixed(2)} · Score {data.trinkgeld_score}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-2 py-1 rounded transition-colors ${tab === t.key ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Überblick */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
          {data.kpis.map(k => (
            <div key={k.label} className="bg-gray-800 rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 truncate">{k.label}</span>
                <div className={`h-1.5 w-1.5 rounded-full ${AMPEL_DOT[k.ampel]}`} />
              </div>
              <div className="text-sm font-bold text-white">{k.value}</div>
              <div className={`text-[10px] flex items-center gap-0.5 ${k.delta_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {k.delta_pct >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {k.delta_pct >= 0 ? '+' : ''}{k.delta_pct.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stunden */}
      {tab === 'stunden' && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.stunden} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, n: string) => [n === 'bestellungen' ? `${v} Bestellungen` : `€${v}`, n]}
            />
            <Bar dataKey="bestellungen" fill="#14b8a6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="umsatz"       fill="#0d9488" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Fahrer */}
      {tab === 'fahrer' && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="pb-1 pr-2">#</th>
                <th className="pb-1 pr-2">Name</th>
                <th className="pb-1 pr-2 text-right">Score</th>
                <th className="pb-1 pr-2 text-right">Tour</th>
                <th className="pb-1 pr-2 text-right">Pünkt.</th>
                <th className="pb-1 pr-2 text-right">Vollst.</th>
                <th className="pb-1 text-right text-orange-400">Tip Ø</th>
              </tr>
            </thead>
            <tbody>
              {data.fahrer.map(f => (
                <tr key={f.name} className="border-b border-gray-800/50">
                  <td className="py-1 pr-2 text-gray-500">{f.rang}</td>
                  <td className="py-1 pr-2 text-gray-200">{f.name}</td>
                  <td className={`py-1 pr-2 text-right font-bold ${TIER_COLOR[f.tier]}`}>{f.score}</td>
                  <td className="py-1 pr-2 text-right text-gray-400">{f.lieferungen}</td>
                  <td className="py-1 pr-2 text-right text-gray-300">{f.puenktlichkeit_pct}%</td>
                  <td className="py-1 pr-2 text-right text-gray-300">{f.vollstaendigkeit_pct}%</td>
                  <td className="py-1 text-right text-orange-300">€{f.trinkgeld_avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vollständigkeit */}
      {tab === 'vollstaendigkeit' && (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data.vollstaendigkeit_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis domain={[80, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
            <Line dataKey="pct"  stroke="#34d399" strokeWidth={2} dot={false} />
            <Line dataKey="ziel" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Leerfahrten */}
      {tab === 'leerfahrten' && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data.leerfahrten_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="tag" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
              {data.leerfahrten_trend.map((entry, i) => (
                <Cell key={i} fill={entry.pct > entry.ziel ? '#f87171' : '#34d399'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Trinkgeld */}
      {tab === 'trinkgeld' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-orange-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">€{data.fleet_trinkgeld_avg.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Fleet-Ø Trinkgeld</div>
            </div>
            <div className="bg-amber-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{data.trinkgeld_score}</div>
              <div className="text-xs text-gray-400">Trinkgeld-Score</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data.trinkgeld_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="tag" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis domain={[0, 3]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`€${v.toFixed(2)}`, '']} />
              <Line dataKey="avg"  stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} />
              <Line dataKey="ziel" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bilanz */}
      {tab === 'bilanz' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Umsatz gesamt',   value: '€2.847', color: 'text-teal-400' },
              { label: 'Ø pro Tour',      value: '€20.05', color: 'text-blue-400' },
              { label: 'Trinkgeld-Pool',  value: '€263', color: 'text-orange-400' },
              { label: 'Fitness-Index',   value: `${data.trinkgeld_score}`, color: 'text-violet-400' },
            ].map(item => (
              <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400">{item.label}</div>
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-600 text-right">45-Sek-Polling · V46</div>
    </div>
  );
}
