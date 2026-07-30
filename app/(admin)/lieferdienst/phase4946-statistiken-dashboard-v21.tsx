'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Clock, Star, Users, Activity, Zap, Package, Euro, Leaf, Target, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

interface StundenDaten {
  stunde: number;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  ist_jetzt: boolean;
}

interface WochenDaten {
  tag: string;
  bestellungen: number;
  umsatz: number;
}

interface SchichtVergleich {
  name: string;
  score: number;
  touren: number;
  umsatz: number;
  puenktlichkeit_pct: number;
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  score_delta: number;
  co2_kg: number;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  marge_pct: number;
  trend: number;
}

interface KpiKachel {
  label: string;
  wert: number | string;
  ziel: number | null;
  trend: number;
  einheit: string;
  invertiert: boolean;
  icon: string;
}

interface ApiResponse {
  score: number;
  score_delta: number;
  alert: string | null;
  kpis: KpiKachel[];
  stunden: StundenDaten[];
  woche: WochenDaten[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  schicht_vergleich: SchichtVergleich[];
  co2_gesamt_kg: number;
  co2_ziel_kg: number;
}

const MOCK: ApiResponse = {
  score: 84,
  score_delta: 5,
  alert: null,
  co2_gesamt_kg: 8.4,
  co2_ziel_kg: 12.0,
  kpis: [
    { label: 'Bestellungen', wert: 87,    ziel: 100, trend:  12, einheit: '',   invertiert: false, icon: '📦' },
    { label: 'Umsatz',       wert: 2480,  ziel: 2800,trend:   8, einheit: '€',  invertiert: false, icon: '💶' },
    { label: 'Pünktlichkeit',wert: 83,    ziel: 90,  trend:  -2, einheit: '%',  invertiert: false, icon: '⏱' },
    { label: 'Lieferzeit',   wert: 24,    ziel: 22,  trend:  -1, einheit: 'Min',invertiert: true,  icon: '🚴' },
    { label: 'Bewertung',    wert: 4.6,   ziel: 4.8, trend:   0, einheit: '★',  invertiert: false, icon: '⭐' },
    { label: 'Storno',       wert: 2.1,   ziel: 3,   trend:  -0.3,einheit: '%', invertiert: true,  icon: '❌' },
    { label: 'Fahrer online',wert: 6,     ziel: 8,   trend:   0, einheit: '',   invertiert: false, icon: '👤' },
    { label: 'SLA',          wert: 91,    ziel: 95,  trend:   3, einheit: '%',  invertiert: false, icon: '🎯' },
  ],
  stunden: Array.from({ length: 12 }, (_, i) => ({
    stunde: 10 + i,
    bestellungen: [4, 6, 9, 12, 15, 18, 16, 14, 11, 8, 5, 3][i],
    umsatz: [110, 170, 260, 340, 430, 510, 460, 400, 320, 230, 145, 80][i],
    puenktlichkeit_pct: [88, 86, 83, 80, 78, 75, 79, 82, 85, 87, 89, 90][i],
    ist_jetzt: i === 8,
  })),
  woche: [
    { tag: 'Mo', bestellungen: 62, umsatz: 1740 },
    { tag: 'Di', bestellungen: 58, umsatz: 1620 },
    { tag: 'Mi', bestellungen: 71, umsatz: 1980 },
    { tag: 'Do', bestellungen: 68, umsatz: 1890 },
    { tag: 'Fr', bestellungen: 94, umsatz: 2620 },
    { tag: 'Sa', bestellungen: 112, umsatz: 3140 },
    { tag: 'So', bestellungen: 87, umsatz: 2480 },
  ],
  schicht_vergleich: [
    { name: 'Mittag',    score: 79, touren: 28, umsatz: 780,  puenktlichkeit_pct: 81 },
    { name: 'Nachmittag',score: 84, touren: 34, umsatz: 940,  puenktlichkeit_pct: 84 },
    { name: 'Abend',     score: 88, touren: 42, umsatz: 1180, puenktlichkeit_pct: 87 },
  ],
  top_fahrer: [
    { rang: 1, name: 'Jonas M.', score: 94, touren: 12, trinkgeld: 18.50, puenktlichkeit_pct: 92, score_delta: 3, co2_kg: 1.2 },
    { rang: 2, name: 'Sara K.',  score: 88, touren: 10, trinkgeld: 14.20, puenktlichkeit_pct: 88, score_delta: 1, co2_kg: 1.4 },
    { rang: 3, name: 'Max R.',   score: 82, touren: 9,  trinkgeld: 11.00, puenktlichkeit_pct: 84, score_delta: -1, co2_kg: 1.6 },
  ],
  zonen: [
    { zone: 'Innenstadt',  sla_pct: 92, avg_min: 21, umsatz: 980,  marge_pct: 38, trend: 4 },
    { zone: 'Nordviertel', sla_pct: 88, avg_min: 24, umsatz: 640,  marge_pct: 32, trend: -2 },
    { zone: 'Westpark',    sla_pct: 85, avg_min: 27, umsatz: 520,  marge_pct: 29, trend: 1 },
    { zone: 'Südstadt',    sla_pct: 79, avg_min: 31, umsatz: 340,  marge_pct: 25, trend: -5 },
  ],
};

type ChartModus = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

interface Props {
  locationId?: string | null;
}

export function LieferdienstPhase4946StatistikenDashboardV21({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [chartModus, setChartModus] = useState<ChartModus>('bestellungen');
  const [wocheVis, setWocheVis] = useState(false);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/overview?location_id=${locationId}&version=v21`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const scorePct = Math.min(100, data.score);
  const scoreColor = data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const scoreBarColor = data.score >= 85 ? 'bg-green-500' : data.score >= 70 ? 'bg-yellow-500' : 'bg-red-500';

  const co2Pct = Math.min(100, (data.co2_gesamt_kg / data.co2_ziel_kg) * 100);
  const critKpis = data.kpis.filter(k => {
    if (!k.ziel) return false;
    const val = typeof k.wert === 'number' ? k.wert : parseFloat(String(k.wert));
    return k.invertiert ? val > k.ziel : val < k.ziel * 0.9;
  });

  const chartData = data.stunden.map(s => ({
    name: `${s.stunde}h`,
    wert: chartModus === 'bestellungen' ? s.bestellungen : chartModus === 'umsatz' ? s.umsatz : s.puenktlichkeit_pct,
    ist_jetzt: s.ist_jetzt,
  }));

  const RANG_BADGE = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Statistiken V21</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
          <span className={`text-lg font-bold ${scoreColor}`}>{data.score}</span>
          {data.score_delta !== 0 && (
            <span className={`text-xs ${data.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.score_delta > 0 ? '+' : ''}{data.score_delta}
            </span>
          )}
        </div>
      </div>

      {/* Score Bar */}
      <div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all ${scoreBarColor}`} style={{ width: `${scorePct}%` }} />
        </div>
      </div>

      {/* Alert Strip */}
      {critKpis.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-900/40 border border-red-600/50">
          <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-300">
            {critKpis.map(k => k.label).join(', ')} unter Ziel
          </div>
        </div>
      )}
      {data.alert && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-900/40 border border-amber-600/50">
          <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-300">{data.alert}</span>
        </div>
      )}

      {/* CO2 Banner */}
      <div className="flex items-center gap-3 bg-lime-900/20 border border-lime-700/30 rounded-lg px-3 py-2">
        <Leaf size={14} className="text-lime-400" />
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-lime-300 font-medium">CO₂ heute: {data.co2_gesamt_kg} kg</span>
            <span className="text-lime-600">Ziel: {data.co2_ziel_kg} kg</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1">
            <div
              className={`h-1 rounded-full ${co2Pct <= 70 ? 'bg-lime-500' : co2Pct <= 90 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${co2Pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-2">
        {data.kpis.map(k => {
          const val = typeof k.wert === 'number' ? k.wert : parseFloat(String(k.wert));
          const ok = k.ziel ? (k.invertiert ? val <= k.ziel : val >= k.ziel * 0.9) : true;
          const almost = k.ziel ? (k.invertiert ? val <= k.ziel * 1.1 : val >= k.ziel * 0.8) : true;
          const statusColor = ok ? 'text-green-400' : almost ? 'text-yellow-400' : 'text-red-400';
          const statusBg = ok ? 'bg-green-900/20' : almost ? 'bg-yellow-900/20' : 'bg-red-900/20';
          return (
            <div key={k.label} className={`rounded-lg p-2 ${statusBg}`}>
              <div className="text-base mb-0.5">{k.icon}</div>
              <div className={`text-xs font-bold ${statusColor}`}>
                {k.einheit === '€' ? `€${typeof k.wert === 'number' ? k.wert.toFixed(0) : k.wert}` : `${k.wert}${k.einheit}`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{k.label}</div>
              {k.trend !== 0 && (
                <div className={`text-[10px] flex items-center gap-0.5 ${k.trend > 0 !== k.invertiert ? 'text-green-400' : 'text-red-400'}`}>
                  {k.trend > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {k.trend > 0 ? '+' : ''}{k.trend}{k.einheit === '%' ? 'pp' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div>
        <div className="flex gap-1 mb-2 flex-wrap">
          {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
            <button
              key={m}
              onClick={() => setChartModus(m)}
              className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                chartModus === m ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'bestellungen' ? '📦 Bestellungen' : m === 'umsatz' ? '💶 Umsatz' : '⏱ Pünktlichkeit'}
            </button>
          ))}
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={(d as any).ist_jetzt ? '#8b5cf6' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Schicht-Vergleich */}
      <div>
        <div className="text-xs font-medium text-slate-400 mb-2">Schicht-Vergleich</div>
        <div className="grid grid-cols-3 gap-2">
          {data.schicht_vergleich.map(s => (
            <div key={s.name} className="bg-slate-800/50 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-500 mb-1">{s.name}</div>
              <div className={`text-sm font-bold ${s.score >= 85 ? 'text-green-400' : s.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{s.score}</div>
              <div className="text-[10px] text-slate-500">{s.touren} Touren</div>
              <div className="text-[10px] text-slate-400">€{s.umsatz}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Fahrer */}
      <div>
        <div className="text-xs font-medium text-slate-400 mb-2">Top-Fahrer</div>
        <div className="space-y-1.5">
          {data.top_fahrer.map(f => (
            <div key={f.rang} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
              <span className="text-base">{RANG_BADGE[f.rang - 1] ?? f.rang}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate">{f.name}</span>
                  {f.score_delta !== 0 && (
                    <span className={`text-[10px] ${f.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">{f.touren} Touren · {f.puenktlichkeit_pct}% pünktl.</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-indigo-300">{f.score}</div>
                <div className="text-[10px] text-green-400">+€{f.trinkgeld.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen SLA */}
      <div>
        <div className="text-xs font-medium text-slate-400 mb-2">Zonen-Performance</div>
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-24 shrink-0">{z.zone}</span>
              <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium w-8 text-right ${z.sla_pct >= 90 ? 'text-green-400' : z.sla_pct >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-[10px] text-slate-500 w-12 text-right">{z.avg_min} Min</span>
              <span className="text-[10px] text-slate-400 w-12 text-right">€{z.umsatz}</span>
              {z.trend !== 0 && (
                <span className={`text-[10px] w-6 ${z.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {z.trend > 0 ? '▲' : '▼'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
