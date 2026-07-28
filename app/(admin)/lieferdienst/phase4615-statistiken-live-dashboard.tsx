'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Clock, Star, Package, Euro, Users, Target, AlertTriangle, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  wert: string | number;
  einheit: string;
  delta_pct: number | null;
  ziel: number | null;
  wert_num: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface FahrerRang {
  name: string;
  score: number;
  touren: number;
  trinkgeld_eur: number;
}

interface ApiData {
  kpis: KpiKachel[];
  stunden_verlauf: StundenPunkt[];
  top_fahrer: FahrerRang[];
  gesamt_score: number;
  alert_count: number;
  chart_mode: 'bestellungen' | 'umsatz';
}

const MOCK: ApiData = {
  gesamt_score: 82,
  alert_count: 1,
  chart_mode: 'bestellungen',
  kpis: [
    { key: 'bestellungen',  label: 'Bestellungen',     wert: 87,    einheit: '',    delta_pct: +12, ziel: 100, wert_num: 87,  ampel: 'gelb'  },
    { key: 'umsatz',        label: 'Umsatz',            wert: '1.820', einheit: '€', delta_pct: +8,  ziel: 2000,wert_num: 1820,ampel: 'gelb'  },
    { key: 'lieferzeit',    label: 'Ø Lieferzeit',      wert: 26,    einheit: 'min', delta_pct: -5,  ziel: 30,  wert_num: 26,  ampel: 'gruen' },
    { key: 'puenktlichkeit',label: 'Pünktlichkeit',     wert: 88,    einheit: '%',   delta_pct: +3,  ziel: 90,  wert_num: 88,  ampel: 'gelb'  },
    { key: 'bewertung',     label: 'Ø Bewertung',       wert: '4.6', einheit: '★',  delta_pct: null, ziel: 4.5, wert_num: 4.6, ampel: 'gruen' },
    { key: 'storno',        label: 'Stornoquote',       wert: '3.2', einheit: '%',   delta_pct: +0.5,ziel: 5,   wert_num: 3.2, ampel: 'gruen' },
    { key: 'aktive_fahrer', label: 'Aktive Fahrer',     wert: 6,     einheit: '',    delta_pct: null, ziel: 8,   wert_num: 6,   ampel: 'gelb'  },
    { key: 'trinkgeld',     label: 'Ø Trinkgeld/Tour',  wert: '1.80',einheit: '€',   delta_pct: +15, ziel: 2,   wert_num: 1.8, ampel: 'gelb'  },
  ],
  stunden_verlauf: [
    { stunde: '10', bestellungen: 4,  umsatz: 82  },
    { stunde: '11', bestellungen: 8,  umsatz: 165 },
    { stunde: '12', bestellungen: 15, umsatz: 318 },
    { stunde: '13', bestellungen: 18, umsatz: 380 },
    { stunde: '14', bestellungen: 12, umsatz: 255 },
    { stunde: '15', bestellungen: 9,  umsatz: 190 },
    { stunde: '16', bestellungen: 7,  umsatz: 148 },
    { stunde: '17', bestellungen: 14, umsatz: 282 },
  ],
  top_fahrer: [
    { name: 'Thomas K.', score: 95, touren: 8, trinkgeld_eur: 14.50 },
    { name: 'Sarah M.',  score: 88, touren: 7, trinkgeld_eur: 11.00 },
    { name: 'Ali B.',    score: 75, touren: 6, trinkgeld_eur:  7.80 },
  ],
};

const AMPEL_DOT: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-400',
  gelb:  'text-yellow-700 dark:text-yellow-400',
  rot:   'text-red-700 dark:text-red-400',
};
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  gelb:  'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
  rot:   'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
};

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (pct > 0) return <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"><TrendingUp className="h-3 w-3" />+{pct}%</span>;
  if (pct < 0) return <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium"><TrendingDown className="h-3 w-3" />{pct}%</span>;
  return <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium"><Minus className="h-3 w-3" />0%</span>;
}

interface Props { locationId: string | null }

export function LieferdienstPhase4615StatistikenLiveDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/stats/live?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j.kpis?.length) setData(j);
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scoreColor = data.gesamt_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : data.gesamt_score >= 65 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  const scoreBar   = data.gesamt_score >= 80 ? 'bg-emerald-500' : data.gesamt_score >= 65 ? 'bg-yellow-400' : 'bg-red-500';

  const chartData = data.stunden_verlauf.map(d => ({
    name: `${d.stunde}h`,
    wert: chartMode === 'bestellungen' ? d.bestellungen : d.umsatz,
  }));

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Statistiken Live-Dashboard</span>
          {loading && <span className="text-xs text-gray-400">…</span>}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" /> {data.alert_count} Alert
          </span>
        )}
      </div>

      {/* Gesamt-Score */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">GESAMT-SCORE</span>
          <span className={`text-2xl font-bold ${scoreColor}`}>{data.gesamt_score}<span className="text-sm font-normal text-gray-400 ml-1">/100</span></span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${scoreBar} rounded-full transition-all duration-500`} style={{ width: `${data.gesamt_score}%` }} />
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map((k) => (
          <div key={k.key} className={`rounded-lg border p-2.5 ${AMPEL_BG[k.ampel]}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate pr-1">{k.label}</span>
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${AMPEL_DOT[k.ampel]}`} />
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className={`text-lg font-bold ${AMPEL_TEXT[k.ampel]}`}>{k.wert}{k.einheit}</span>
              <DeltaBadge pct={k.delta_pct} />
            </div>
            {k.ziel !== null && (
              <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${AMPEL_DOT[k.ampel]}`}
                  style={{ width: `${Math.min(100, (k.wert_num / k.ziel) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stundenverlauf */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Stundenverlauf</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setChartMode('bestellungen')}
              className={`text-xs px-2 py-1 transition-colors ${chartMode === 'bestellungen' ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >Bestellungen</button>
            <button
              onClick={() => setChartMode('umsatz')}
              className={`text-xs px-2 py-1 transition-colors ${chartMode === 'umsatz' ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >Umsatz</button>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                formatter={(v: number) => chartMode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [`${v}`, 'Bestellungen']}
              />
              <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#6366f1' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top-Fahrer */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Top-Fahrer heute</span>
        {data.top_fahrer.map((f, i) => (
          <div key={f.name} className="flex items-center gap-2">
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-orange-300 text-white'}`}>{i + 1}</span>
            <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 truncate">{f.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{f.touren}x</span>
              <span className="text-xs text-gray-400">{f.trinkgeld_eur.toFixed(2)}€</span>
              <div className="w-14 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${f.score >= 80 ? 'bg-emerald-500' : f.score >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${f.score}%` }} />
              </div>
              <span className={`text-xs font-bold ${f.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{f.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
