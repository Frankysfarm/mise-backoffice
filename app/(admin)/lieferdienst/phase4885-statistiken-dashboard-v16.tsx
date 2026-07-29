'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Clock, Euro, Users, CheckCircle2, Zap, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface KpiTile {
  key: string;
  label: string;
  value: string;
  delta_pct: number;
  status: 'good' | 'warn' | 'bad';
  ziel: string | null;
}

interface HourSlot {
  label: string;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
}

interface SchichtData {
  name: string;
  score: number;
  touren: number;
  umsatz: number;
}

interface FahrerTop {
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
}

interface ApiResponse {
  kpis: KpiTile[];
  hourly: HourSlot[];
  schichten: SchichtData[];
  top_fahrer: FahrerTop[];
  alert: string | null;
  gesamt_score: number;
  gesamt_score_ziel: number;
}

const MOCK: ApiResponse = {
  gesamt_score: 81,
  gesamt_score_ziel: 88,
  alert: null,
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', value: '47', delta_pct: 12, status: 'good', ziel: '50' },
    { key: 'umsatz', label: 'Umsatz', value: '€ 1.284', delta_pct: 8, status: 'good', ziel: '€ 1.400' },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', value: '76%', delta_pct: -3, status: 'warn', ziel: '85%' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', value: '29 min', delta_pct: 2, status: 'warn', ziel: '25 min' },
    { key: 'bewertung', label: 'Ø Bewertung', value: '4.4 ★', delta_pct: 0, status: 'good', ziel: '4.5 ★' },
    { key: 'aktive_fahrer', label: 'Fahrer aktiv', value: '5', delta_pct: 0, status: 'good', ziel: null },
    { key: 'touren', label: 'Touren', value: '22', delta_pct: 15, status: 'good', ziel: '25' },
    { key: 'trinkgeld', label: 'Trinkgeld', value: '€ 38', delta_pct: 5, status: 'good', ziel: null },
  ],
  hourly: [
    { label: '11', bestellungen: 3, umsatz: 78, puenktlichkeit_pct: 92 },
    { label: '12', bestellungen: 8, umsatz: 212, puenktlichkeit_pct: 85 },
    { label: '13', bestellungen: 11, umsatz: 298, puenktlichkeit_pct: 78 },
    { label: '14', bestellungen: 6, umsatz: 160, puenktlichkeit_pct: 82 },
    { label: '15', bestellungen: 4, umsatz: 109, puenktlichkeit_pct: 88 },
    { label: '16', bestellungen: 7, umsatz: 185, puenktlichkeit_pct: 75 },
    { label: '17', bestellungen: 8, umsatz: 242, puenktlichkeit_pct: 70 },
  ],
  schichten: [
    { name: 'Mittag', score: 84, touren: 8, umsatz: 548 },
    { name: 'Nachmittag', score: 78, touren: 6, umsatz: 269 },
    { name: 'Abend', score: 82, touren: 8, umsatz: 467 },
  ],
  top_fahrer: [
    { name: 'Marco S.', score: 92, touren: 7, trinkgeld: 14.20, puenktlichkeit_pct: 86 },
    { name: 'Lena K.', score: 85, touren: 6, trinkgeld: 11.50, puenktlichkeit_pct: 80 },
    { name: 'Tom B.', score: 72, touren: 4, trinkgeld: 7.80, puenktlichkeit_pct: 68 },
  ],
};

function StatusIcon({ s }: { s: KpiTile['status'] }) {
  if (s === 'good') return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (s === 'warn') return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
  return <AlertTriangle className="w-3 h-3 text-red-400" />;
}

function deltaText(d: number, reverse = false) {
  const good = reverse ? d < 0 : d > 0;
  const color = d === 0 ? 'text-slate-500' : good ? 'text-green-400' : 'text-red-400';
  const prefix = d > 0 ? '+' : '';
  return <span className={`text-[9px] ${color}`}>{prefix}{d}%</span>;
}

export function LieferdienstPhase4885StatistikenDashboardV16({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz' | 'puenktlichkeit'>('bestellungen');

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/lieferdienst/statistiken-heute?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json();
          if (json?.kpis) setData(json as ApiResponse);
        }
      } catch { /* Mock-Fallback */ }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const scoreProgress = Math.min(100, (data.gesamt_score / data.gesamt_score_ziel) * 100);
  const scoreColor = data.gesamt_score >= 85 ? 'text-green-400' : data.gesamt_score >= 70 ? 'text-yellow-400' : 'text-red-400';

  const chartKey = mode === 'bestellungen' ? 'bestellungen' : mode === 'umsatz' ? 'umsatz' : 'puenktlichkeit_pct';
  const chartColor = mode === 'puenktlichkeit' ? '#22c55e' : '#6366f1';

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Statistiken-Dashboard V16</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${scoreColor}`}>{data.gesamt_score}</span>
          <span className="text-[10px] text-slate-500">/ {data.gesamt_score_ziel}</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded bg-red-900/30 border border-red-700/40 px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Score Progress */}
      <div className="w-full h-1.5 rounded bg-slate-700/50">
        <div
          className={`h-1.5 rounded transition-all ${data.gesamt_score >= 85 ? 'bg-green-500' : data.gesamt_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${scoreProgress}%` }}
        />
      </div>

      {/* KPI Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-1">
        {data.kpis.map(k => (
          <div key={k.key} className="rounded bg-slate-900/40 border border-slate-700/30 p-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-slate-500">{k.label}</span>
              <StatusIcon s={k.status} />
            </div>
            <div className="flex items-end gap-1">
              <span className="text-sm font-bold text-slate-200">{k.value}</span>
              {deltaText(k.delta_pct, k.key === 'lieferzeit')}
            </div>
            {k.ziel && <div className="text-[9px] text-slate-600 mt-0.5">Ziel: {k.ziel}</div>}
          </div>
        ))}
      </div>

      {/* Stundenverlauf */}
      <div className="rounded-lg bg-slate-900/40 border border-slate-700/30 p-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`text-[9px] px-1.5 py-0.5 rounded ${mode === m ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
                {m === 'bestellungen' ? 'Bestell.' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={data.hourly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10, padding: '4px 8px' }}
              cursor={{ fill: 'rgba(99,102,241,0.1)' }}
            />
            <Bar dataKey={chartKey} fill={chartColor} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Schichtvergleich */}
      <div className="grid grid-cols-3 gap-1">
        {data.schichten.map(s => (
          <div key={s.name} className="rounded bg-slate-900/40 border border-slate-700/30 p-1.5 text-center">
            <div className="text-[9px] text-slate-500 mb-1">{s.name}</div>
            <div className={`text-sm font-bold ${s.score >= 85 ? 'text-green-400' : s.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{s.score}</div>
            <div className="text-[9px] text-slate-600">{s.touren} Touren</div>
            <div className="text-[9px] text-slate-500">€{s.umsatz}</div>
          </div>
        ))}
      </div>

      {/* Top Fahrer */}
      <div className="rounded-lg bg-slate-900/40 border border-slate-700/30 p-2">
        <div className="text-[10px] text-slate-400 mb-1.5">Top Fahrer</div>
        <div className="space-y-1.5">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-600 w-3">{i + 1}.</span>
              <span className="text-[10px] text-slate-300 flex-1">{f.name}</span>
              <span className={`text-[10px] font-semibold ${f.score >= 85 ? 'text-green-400' : f.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
              <span className="text-[9px] text-slate-500">{f.touren} T.</span>
              <span className="text-[9px] text-yellow-400">€{f.trinkgeld.toFixed(2)}</span>
              <span className={`text-[9px] ${f.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{f.puenktlichkeit_pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
