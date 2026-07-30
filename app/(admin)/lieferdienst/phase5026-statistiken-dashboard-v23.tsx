'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Users, Euro, Clock, Target, Zap, AlertTriangle, CheckCircle2, Star } from 'lucide-react';

interface StundenData {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  ziel: number;
}

interface FahrerKpi {
  name: string;
  score: number;
  stopps: number;
  puenktl_pct: number;
  umsatz: number;
}

interface ZonenStat {
  zone: string;
  bestellungen: number;
  avg_eta: number;
  kapazitaet_pct: number;
}

interface ApiData {
  kpis: {
    umsatz_heute: number;
    umsatz_delta_pct: number;
    bestellungen_heute: number;
    aktive_fahrer: number;
    avg_lieferzeit_min: number;
    puenktlichkeit_pct: number;
    storno_quote_pct: number;
    kundenbewertung: number;
  };
  stunden: StundenData[];
  fahrer_top: FahrerKpi[];
  zonen: ZonenStat[];
  alert: string | null;
}

const STUNDEN_MOCK: StundenData[] = [
  { stunde: '11h', bestellungen: 4, umsatz: 89, ziel: 80 },
  { stunde: '12h', bestellungen: 11, umsatz: 234, ziel: 200 },
  { stunde: '13h', bestellungen: 14, umsatz: 298, ziel: 280 },
  { stunde: '14h', bestellungen: 8, umsatz: 171, ziel: 180 },
  { stunde: '15h', bestellungen: 5, umsatz: 108, ziel: 120 },
  { stunde: '16h', bestellungen: 7, umsatz: 152, ziel: 140 },
  { stunde: '17h', bestellungen: 12, umsatz: 261, ziel: 240 },
  { stunde: '18h', bestellungen: 18, umsatz: 387, ziel: 320 },
  { stunde: '19h', bestellungen: 21, umsatz: 445, ziel: 380 },
  { stunde: '20h', bestellungen: 16, umsatz: 341, ziel: 300 },
];

const MOCK: ApiData = {
  kpis: {
    umsatz_heute: 2486, umsatz_delta_pct: 12.4,
    bestellungen_heute: 116, aktive_fahrer: 5,
    avg_lieferzeit_min: 28, puenktlichkeit_pct: 89,
    storno_quote_pct: 2.6, kundenbewertung: 4.7,
  },
  stunden: STUNDEN_MOCK,
  fahrer_top: [
    { name: 'Jonas M.', score: 94, stopps: 14, puenktl_pct: 97, umsatz: 168 },
    { name: 'Anna B.', score: 88, stopps: 11, puenktl_pct: 92, umsatz: 142 },
    { name: 'Sara K.', score: 87, stopps: 10, puenktl_pct: 89, umsatz: 128 },
  ],
  zonen: [
    { zone: 'Mitte', bestellungen: 42, avg_eta: 24, kapazitaet_pct: 78 },
    { zone: 'Nord', bestellungen: 28, avg_eta: 31, kapazitaet_pct: 62 },
    { zone: 'Süd', bestellungen: 31, avg_eta: 27, kapazitaet_pct: 85 },
    { zone: 'West', bestellungen: 15, avg_eta: 35, kapazitaet_pct: 45 },
  ],
  alert: null,
};

function scoreColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function kapPct(v: number) {
  if (v >= 80) return 'bg-red-500';
  if (v >= 60) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function LieferdienstPhase5026StatistikenDashboardV23() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab] = useState<'umsatz' | 'fahrer' | 'zonen'>('umsatz');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/statistiken-dashboard', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* Mock bleibt */ }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const kpis = data.kpis;

  return (
    <div className="rounded-xl border border-teal-700/40 bg-gradient-to-b from-slate-900/90 to-teal-950/40 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-teal-300">Statistiken V23</span>
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${kpis.umsatz_delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {kpis.umsatz_delta_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {kpis.umsatz_delta_pct >= 0 ? '+' : ''}{kpis.umsatz_delta_pct}%
          </span>
        </div>
        <span className="text-sm font-bold text-amber-400">{kpis.umsatz_heute}€</span>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI 8er Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Bestellungen', v: kpis.bestellungen_heute, unit: '', color: 'text-slate-200' },
          { label: 'Fahrer', v: kpis.aktive_fahrer, unit: '', color: 'text-blue-400' },
          { label: 'Ø Lieferzeit', v: kpis.avg_lieferzeit_min, unit: 'min', color: kpis.avg_lieferzeit_min <= 30 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Pünktl.', v: kpis.puenktlichkeit_pct, unit: '%', color: kpis.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Storno', v: kpis.storno_quote_pct, unit: '%', color: kpis.storno_quote_pct <= 3 ? 'text-green-400' : 'text-red-400' },
          { label: 'Bewertung', v: kpis.kundenbewertung, unit: '⭐', color: 'text-amber-400' },
          { label: 'Umsatz', v: kpis.umsatz_heute, unit: '€', color: 'text-amber-300' },
          { label: 'Trend', v: `${kpis.umsatz_delta_pct >= 0 ? '+' : ''}${kpis.umsatz_delta_pct}`, unit: '%', color: kpis.umsatz_delta_pct >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-1.5 py-1.5 text-center">
            <div className={`text-xs font-bold tabular-nums ${k.color}`}>{k.v}{k.unit}</div>
            <div className="text-[9px] text-slate-600">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {([
          { key: 'umsatz', label: 'Umsatz/h' },
          { key: 'fahrer', label: 'Fahrer Top' },
          { key: 'zonen', label: 'Zonen' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-teal-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Umsatz Chart */}
      {tab === 'umsatz' && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500">Umsatz vs. Ziel (€)</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stunden} barCategoryGap="20%">
                <XAxis dataKey="stunde" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number | undefined) => `${v ?? 0}€`}
                />
                <Bar dataKey="ziel" fill="#1e3a2a" radius={2} />
                <Bar dataKey="umsatz" radius={2}>
                  {data.stunden.map((entry, i) => (
                    <Cell key={i} fill={entry.umsatz >= entry.ziel ? '#10b981' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.stunden}>
                <XAxis dataKey="stunde" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number | undefined) => [v ?? 0, 'Bestellungen'] as [number, string]}
                />
                <Line type="monotone" dataKey="bestellungen" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fahrer Top */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5">
          {data.fahrer_top.map((f, i) => (
            <div key={f.name} className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>#{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-100">{f.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${scoreColor(f.score)}`}>{f.score}</span>
                  <span className="text-[10px] text-slate-500">Score</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${f.score >= 85 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{f.stopps} Stopps</span>
                <span>{f.puenktl_pct}% pünktl.</span>
                <span className="text-amber-400">{f.umsatz}€</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {data.zonen.map((z) => (
            <div key={z.zone} className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">{z.zone}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{z.bestellungen} Best.</span>
                  <span className={`text-[10px] font-semibold ${z.avg_eta <= 28 ? 'text-green-400' : 'text-yellow-400'}`}>
                    Ø {z.avg_eta}min
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                  <span>Kapazität</span>
                  <span>{z.kapazitaet_pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${kapPct(z.kapazitaet_pct)}`}
                    style={{ width: `${z.kapazitaet_pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-slate-600 text-right">30s-Polling · V23 · Mock-Fallback</div>
    </div>
  );
}
