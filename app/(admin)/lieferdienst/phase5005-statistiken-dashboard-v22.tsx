'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Package, Star, AlertTriangle, Leaf } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';

interface KpiTile {
  label: string;
  value: number;
  unit: string;
  ziel: number;
  delta_pct: number;
  trend: 'up' | 'down' | 'flat';
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SchichtVergleich {
  name: string;
  score: number;
  touren: number;
  umsatz: number;
  rentabilitaet_pct: number;
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  co2_kg: number;
}

interface ApiResponse {
  kpis: KpiTile[];
  gesamt_score: number;
  gesamt_score_ziel: number;
  alerts: string[];
  stunden_verlauf: { stunde: string; bestellungen: number; umsatz: number; puenktl: number }[];
  schichten: SchichtVergleich[];
  top_fahrer: TopFahrer[];
  team_co2_kg: number;
  team_co2_ziel_kg: number;
  wochenvergleich: { tag: string; heute: number; vorwoche: number }[];
}

const MOCK: ApiResponse = {
  gesamt_score: 85,
  gesamt_score_ziel: 90,
  alerts: [],
  team_co2_kg: 18.4,
  team_co2_ziel_kg: 30,
  kpis: [
    { label: 'Bestellungen', value: 148, unit: '', ziel: 160, delta_pct: 6.2, trend: 'up', ampel: 'gelb' },
    { label: 'Umsatz', value: 3840, unit: '€', ziel: 4000, delta_pct: 8.1, trend: 'up', ampel: 'gelb' },
    { label: 'Pünktlichkeit', value: 91, unit: '%', ziel: 90, delta_pct: 2.4, trend: 'up', ampel: 'gruen' },
    { label: 'Lieferzeit', value: 24, unit: 'min', ziel: 30, delta_pct: -5.1, trend: 'down', ampel: 'gruen' },
    { label: 'Storno', value: 2.1, unit: '%', ziel: 3, delta_pct: -0.8, trend: 'down', ampel: 'gruen' },
    { label: 'Bewertung', value: 4.7, unit: '★', ziel: 4.5, delta_pct: 1.3, trend: 'up', ampel: 'gruen' },
    { label: 'Akt. Fahrer', value: 8, unit: '', ziel: 10, delta_pct: -2, trend: 'flat', ampel: 'gelb' },
    { label: 'Ø Trinkgeld', value: 3.2, unit: '€', ziel: 2.5, delta_pct: 12.5, trend: 'up', ampel: 'gruen' },
  ],
  stunden_verlauf: [
    { stunde: '10', bestellungen: 8, umsatz: 210, puenktl: 88 },
    { stunde: '11', bestellungen: 14, umsatz: 390, puenktl: 91 },
    { stunde: '12', bestellungen: 22, umsatz: 580, puenktl: 93 },
    { stunde: '13', bestellungen: 25, umsatz: 640, puenktl: 90 },
    { stunde: '14', bestellungen: 18, umsatz: 470, puenktl: 88 },
    { stunde: '17', bestellungen: 20, umsatz: 520, puenktl: 92 },
    { stunde: '18', bestellungen: 28, umsatz: 720, puenktl: 94 },
    { stunde: '19', bestellungen: 13, umsatz: 310, puenktl: 89 },
  ],
  schichten: [
    { name: 'Mittag', score: 88, touren: 42, umsatz: 1240, rentabilitaet_pct: 72 },
    { name: 'Nachmittag', score: 82, touren: 35, umsatz: 990, rentabilitaet_pct: 68 },
    { name: 'Abend', score: 91, touren: 71, umsatz: 1610, rentabilitaet_pct: 79 },
  ],
  top_fahrer: [
    { rang: 1, name: 'Jonas M.', score: 94, touren: 18, trinkgeld: 62, co2_kg: 2.8 },
    { rang: 2, name: 'Sara K.', score: 89, touren: 15, trinkgeld: 48, co2_kg: 3.1 },
    { rang: 3, name: 'Mehmet A.', score: 83, touren: 14, trinkgeld: 41, co2_kg: 3.6 },
  ],
  wochenvergleich: [
    { tag: 'Mo', heute: 120, vorwoche: 110 },
    { tag: 'Di', heute: 135, vorwoche: 128 },
    { tag: 'Mi', heute: 142, vorwoche: 139 },
    { tag: 'Do', heute: 148, vorwoche: 144 },
    { tag: 'Fr', heute: 0, vorwoche: 182 },
    { tag: 'Sa', heute: 0, vorwoche: 210 },
    { tag: 'So', heute: 0, vorwoche: 195 },
  ],
};

type Mode = 'bestellungen' | 'umsatz' | 'puenktl';

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function ampelBorder(a: string) {
  if (a === 'gruen') return 'border-green-700/40';
  if (a === 'gelb') return 'border-yellow-700/40';
  return 'border-red-700/40';
}

function scoreColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

const RANG_BADGE = ['🥇', '🥈', '🥉'];

export function LieferdienstPhase5005StatistikenDashboardV22() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [mode, setMode] = useState<Mode>('bestellungen');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/analytics', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {
        // Mock bleibt
      }
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, []);

  const scorePct = (data.gesamt_score / data.gesamt_score_ziel) * 100;
  const co2Pct = Math.min(100, (data.team_co2_kg / data.team_co2_ziel_kg) * 100);
  const now = new Date().getHours();

  return (
    <div className="rounded-xl border border-emerald-700/40 bg-gradient-to-b from-emerald-950/50 to-slate-900/80 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300">Statistiken V22</span>
        </div>
        <div className={`text-xl font-bold ${scoreColor(data.gesamt_score)}`}>{data.gesamt_score}</div>
      </div>

      {/* Score Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Gesamt-Score</span>
          <span>Ziel: {data.gesamt_score_ziel}</span>
        </div>
        <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              scorePct >= 100 ? 'bg-green-500' : scorePct >= 80 ? 'bg-emerald-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(100, scorePct)}%` }}
          />
        </div>
      </div>

      {/* CO₂ Banner */}
      <div className="rounded-lg border border-lime-700/40 bg-lime-950/30 px-2.5 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs text-lime-300 font-medium">CO₂ Heute</span>
          </div>
          <span className="text-xs font-bold text-lime-300">{data.team_co2_kg.toFixed(1)} / {data.team_co2_ziel_kg} kg</span>
        </div>
        <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mt-1.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${co2Pct < 60 ? 'bg-lime-500' : co2Pct < 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${co2Pct}%` }}
          />
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{a}</span>
        </div>
      ))}

      {/* KPI 8er-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {data.kpis.map((k) => (
          <div key={k.label} className={`rounded-lg border ${ampelBorder(k.ampel)} bg-slate-800/40 px-1.5 py-1.5 text-center`}>
            <div className={`text-sm font-bold tabular-nums ${ampelColor(k.ampel)}`}>
              {k.unit === '€' ? `${(k.value >= 1000 ? `${(k.value / 1000).toFixed(1)}k` : k.value)}€` : `${k.value}${k.unit}`}
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">{k.label}</div>
            <div className={`text-[9px] mt-0.5 ${k.trend === 'up' ? 'text-green-400' : k.trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
              {k.delta_pct > 0 ? '+' : ''}{k.delta_pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf Chart */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktl'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                  mode === m ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'bestellungen' ? 'Best.' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={56}>
          <BarChart data={data.stunden_verlauf} barSize={12}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }} />
            <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
              {data.stunden_verlauf.map((entry, i) => (
                <Cell key={i} fill={entry.stunde === String(now) ? '#8b5cf6' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Wochenvergleich */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
        <div className="text-[10px] text-slate-400 mb-1.5">Wochenvergleich Bestellungen</div>
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={data.wochenvergleich}>
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }} />
            <Line type="monotone" dataKey="vorwoche" stroke="#64748b" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="heute" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: '#10b981' }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-green-500" /><span className="text-[9px] text-slate-500">Heute</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-slate-500" /><span className="text-[9px] text-slate-500">Vorwoche</span></div>
        </div>
      </div>

      {/* Schichtvergleich */}
      <div className="grid grid-cols-3 gap-1.5">
        {data.schichten.map((s) => (
          <div key={s.name} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 text-center">
            <div className="text-[10px] text-slate-400 mb-1">{s.name}</div>
            <div className={`text-base font-bold ${scoreColor(s.score)}`}>{s.score}</div>
            <div className="text-[9px] text-slate-500">{s.touren} Touren</div>
            <div className="text-[9px] text-emerald-400">{s.rentabilitaet_pct}% Renta.</div>
          </div>
        ))}
      </div>

      {/* Top Fahrer */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500">Top Fahrer</div>
        {data.top_fahrer.map((f) => (
          <div key={f.rang} className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-800/30 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{RANG_BADGE[f.rang - 1]}</span>
              <span className="text-xs text-slate-200">{f.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className={`text-xs font-bold ${scoreColor(f.score)}`}>{f.score}</div>
                <div className="text-[9px] text-slate-500">Score</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-300">{f.touren}</div>
                <div className="text-[9px] text-slate-500">Touren</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-amber-400">{f.trinkgeld}€</div>
                <div className="text-[9px] text-slate-500">Tipp</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-lime-400">{f.co2_kg}kg</div>
                <div className="text-[9px] text-slate-500">CO₂</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-slate-600 text-right">60s-Polling · Mock-Fallback</div>
    </div>
  );
}
