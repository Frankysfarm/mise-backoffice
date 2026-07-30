'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Star, Users, Package, Euro, Target, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

interface KpiKachel {
  label: string;
  wert: number | string;
  ziel: number | null;
  trend: number;
  einheit: string;
  invertiert: boolean;
  icon: string;
}

interface StundenDaten {
  stunde: number;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  ist_jetzt: boolean;
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  score_delta: number;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
}

interface SchichtVergleich {
  schicht: string;
  score: number;
  touren: number;
  umsatz: number;
}

interface ApiResponse {
  score: number;
  score_delta: number;
  score_ziel: number;
  alert: string | null;
  kpis: KpiKachel[];
  stunden: StundenDaten[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  schichten: SchichtVergleich[];
  chart_modus: 'bestellungen' | 'umsatz' | 'puenktlichkeit';
}

function euroFmt(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

const MOCK: ApiResponse = {
  score: 86,
  score_delta: 4,
  score_ziel: 88,
  alert: null,
  kpis: [
    { label: 'Bestellungen', wert: 108, ziel: 120, trend: 12, einheit: '', invertiert: false, icon: 'package' },
    { label: 'Umsatz', wert: 2920, ziel: 3200, trend: 9, einheit: '€', invertiert: false, icon: 'euro' },
    { label: 'Pünktlichkeit', wert: 88, ziel: 85, trend: 3, einheit: '%', invertiert: false, icon: 'clock' },
    { label: 'Ø Lieferzeit', wert: 24, ziel: 28, trend: -2, einheit: 'min', invertiert: true, icon: 'clock' },
    { label: 'Stornoquote', wert: 2.1, ziel: 3.0, trend: -0.6, einheit: '%', invertiert: true, icon: 'alert' },
    { label: 'Bewertung', wert: 4.8, ziel: 4.5, trend: 0.2, einheit: '★', invertiert: false, icon: 'star' },
    { label: 'Fahrer aktiv', wert: 7, ziel: null, trend: 1, einheit: '', invertiert: false, icon: 'users' },
    { label: 'SLA-Rate', wert: 89, ziel: 85, trend: 4, einheit: '%', invertiert: false, icon: 'target' },
  ],
  stunden: [
    { stunde: 11, bestellungen: 9, umsatz: 240, puenktlichkeit_pct: 92, ist_jetzt: false },
    { stunde: 12, bestellungen: 18, umsatz: 490, puenktlichkeit_pct: 88, ist_jetzt: false },
    { stunde: 13, bestellungen: 22, umsatz: 600, puenktlichkeit_pct: 84, ist_jetzt: false },
    { stunde: 14, bestellungen: 15, umsatz: 410, puenktlichkeit_pct: 87, ist_jetzt: false },
    { stunde: 17, bestellungen: 13, umsatz: 350, puenktlichkeit_pct: 90, ist_jetzt: false },
    { stunde: 18, bestellungen: 20, umsatz: 540, puenktlichkeit_pct: 86, ist_jetzt: true },
    { stunde: 19, bestellungen: 11, umsatz: 290, puenktlichkeit_pct: 88, ist_jetzt: false },
  ],
  top_fahrer: [
    { rang: 1, name: 'Jonas M.', score: 97, touren: 14, trinkgeld: 21.80, puenktlichkeit_pct: 96, score_delta: 4 },
    { rang: 2, name: 'Sara K.', score: 91, touren: 11, trinkgeld: 16.50, puenktlichkeit_pct: 88, score_delta: 2 },
    { rang: 3, name: 'Kai B.', score: 84, touren: 9, trinkgeld: 12.40, puenktlichkeit_pct: 82, score_delta: -1 },
  ],
  zonen: [
    { zone: 'Nord', sla_pct: 92, avg_min: 22, umsatz: 840 },
    { zone: 'Mitte', sla_pct: 88, avg_min: 25, umsatz: 1100 },
    { zone: 'West', sla_pct: 84, avg_min: 28, umsatz: 620 },
    { zone: 'Süd', sla_pct: 79, avg_min: 31, umsatz: 360 },
  ],
  schichten: [
    { schicht: 'Mittag', score: 84, touren: 28, umsatz: 760 },
    { schicht: 'Nachmittag', score: 88, touren: 22, umsatz: 590 },
    { schicht: 'Abend', score: 86, touren: 58, umsatz: 1570 },
  ],
  chart_modus: 'bestellungen',
};

function kpiAmpel(kpi: KpiKachel): string {
  if (kpi.ziel === null) return 'text-slate-300';
  const wertNum = typeof kpi.wert === 'number' ? kpi.wert : parseFloat(kpi.wert as string);
  const ok = kpi.invertiert ? wertNum <= kpi.ziel : wertNum >= kpi.ziel;
  return ok ? 'text-green-400' : 'text-yellow-400';
}

function trendIcon(trend: number, invertiert: boolean) {
  const gut = invertiert ? trend < 0 : trend > 0;
  if (trend === 0) return <span className="text-slate-500 text-xs">—</span>;
  return gut
    ? <TrendingUp className="w-3 h-3 text-green-400" />
    : <TrendingDown className="w-3 h-3 text-red-400" />;
}

function rangEmoji(rang: number) {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return `${rang}.`;
}

type ChartModus = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

export function LieferdienstPhase5000StatistikenDashboardV21({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [modus, setModus] = useState<ChartModus>('bestellungen');

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/lieferdienst/stats?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const chartDataKey = modus;
  const chartColor = modus === 'bestellungen' ? '#6366f1' : modus === 'umsatz' ? '#10b981' : '#f59e0b';

  const scoreZielPct = Math.min(100, Math.round((data.score / data.score_ziel) * 100));

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-slate-950/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Statistiken Dashboard V21</span>
          <span className="text-xs text-slate-500">Live · 60s</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold font-mono ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-xs flex items-center gap-0.5 ${data.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(data.score_delta)}
          </span>
        </div>
      </div>

      {/* Score Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Ziel: {data.score_ziel}</span>
          <span>{scoreZielPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreZielPct >= 100 ? 'bg-green-500' : scoreZielPct >= 85 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${scoreZielPct}%` }}
          />
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700/60 bg-red-950/30 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* 8 KPI-Grid */}
      <div className="grid grid-cols-4 gap-2">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg bg-slate-900/60 border border-slate-800/50 p-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-slate-500 truncate">{kpi.label}</span>
              {trendIcon(kpi.trend, kpi.invertiert)}
            </div>
            <div className={`text-base font-bold font-mono ${kpiAmpel(kpi)}`}>
              {kpi.einheit === '€' ? euroFmt(typeof kpi.wert === 'number' ? kpi.wert : parseFloat(kpi.wert as string)) : `${kpi.wert}${kpi.einheit !== '€' ? kpi.einheit : ''}`}
            </div>
            {kpi.ziel !== null && (
              <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${kpiAmpel(kpi).includes('green') ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{
                    width: `${Math.min(100, kpi.invertiert
                      ? Math.round((kpi.ziel / (typeof kpi.wert === 'number' ? kpi.wert : parseFloat(kpi.wert as string))) * 100)
                      : Math.round(((typeof kpi.wert === 'number' ? kpi.wert : parseFloat(kpi.wert as string)) / kpi.ziel) * 100)
                    )}%`
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stundenverlauf Chart */}
      <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as ChartModus[]).map(m => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`text-xs px-2 py-0.5 rounded ${modus === m ? 'bg-indigo-600/50 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {m === 'bestellungen' ? 'Bestellg.' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey={chartDataKey} radius={[3, 3, 0, 0]}>
                {data.stunden.map((entry, i) => (
                  <Cell key={i} fill={entry.ist_jetzt ? '#a855f7' : chartColor} opacity={entry.ist_jetzt ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-3">
        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span>Top Fahrer</span>
        </div>
        <div className="space-y-2">
          {data.top_fahrer.map(f => (
            <div key={f.rang} className="flex items-center gap-2">
              <span className="text-sm w-6 shrink-0">{rangEmoji(f.rang)}</span>
              <span className="text-sm text-slate-300 flex-1 truncate">{f.name}</span>
              <span className={`text-sm font-bold font-mono ${f.score >= 90 ? 'text-green-400' : f.score >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
              <span className={`text-xs ${f.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {f.score_delta >= 0 ? '+' : ''}{f.score_delta}
              </span>
              <span className="text-xs text-slate-500">{f.touren}T</span>
              <span className="text-xs text-amber-400">{f.trinkgeld.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen + Schichten */}
      <div className="grid grid-cols-2 gap-3">
        {/* Zonen SLA */}
        <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-2.5">
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zonen SLA</span>
          </div>
          <div className="space-y-1.5">
            {data.zonen.map(z => (
              <div key={z.zone}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-400">{z.zone}</span>
                  <span className={z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 75 ? 'text-yellow-400' : 'text-red-400'}>{z.sla_pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${z.sla_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schichtvergleich */}
        <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-2.5">
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Schichten</span>
          </div>
          <div className="space-y-2">
            {data.schichten.map(s => (
              <div key={s.schicht} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{s.schicht}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold font-mono ${s.score >= 85 ? 'text-green-400' : s.score >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>{s.score}</span>
                  <span className="text-xs text-slate-500">{s.touren}T</span>
                  <span className="text-xs text-emerald-400">{euroFmt(s.umsatz)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
