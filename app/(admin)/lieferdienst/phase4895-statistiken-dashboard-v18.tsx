'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Bike, Package, AlertTriangle, Target, Sunrise } from 'lucide-react';

interface KpiCard {
  label: string;
  wert: string;
  wert_raw: number;
  ziel: number;
  einheit: string;
  trend_pct: number;
  trend_richtung: 'up' | 'down';
  gut_wenn_hoch: boolean;
}

interface StundenDaten {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface FahrerRow {
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
}

interface ApiResponse {
  kpis: KpiCard[];
  stunden_daten: StundenDaten[];
  top_fahrer: FahrerRow[];
  schicht_tag: string;
  alert: string | null;
  live_fahrer: number;
  aktive_touren: number;
}

const MOCK: ApiResponse = {
  schicht_tag: 'Heute',
  alert: null,
  live_fahrer: 5,
  aktive_touren: 4,
  kpis: [
    { label: 'Bestellungen',  wert: '97',    wert_raw: 97,   ziel: 100, einheit: '',    trend_pct: +10, trend_richtung: 'up',   gut_wenn_hoch: true  },
    { label: 'Umsatz',        wert: '2.580', wert_raw: 2580, ziel: 2500, einheit: '€',  trend_pct: +15, trend_richtung: 'up',   gut_wenn_hoch: true  },
    { label: 'Pünktlichkeit', wert: '87',    wert_raw: 87,   ziel: 90,  einheit: '%',   trend_pct: +4,  trend_richtung: 'up',   gut_wenn_hoch: true  },
    { label: 'Ø Lieferzeit',  wert: '24',    wert_raw: 24,   ziel: 25,  einheit: 'min', trend_pct: -4,  trend_richtung: 'down', gut_wenn_hoch: false },
    { label: 'Stornoquote',   wert: '2,8',   wert_raw: 2.8,  ziel: 5,   einheit: '%',   trend_pct: -8,  trend_richtung: 'down', gut_wenn_hoch: false },
    { label: 'Ø Bewertung',   wert: '4,7',   wert_raw: 4.7,  ziel: 4.5, einheit: '★',   trend_pct: +3,  trend_richtung: 'up',   gut_wenn_hoch: true  },
  ],
  stunden_daten: [
    { stunde: '10', bestellungen: 6,  umsatz: 145 },
    { stunde: '11', bestellungen: 14, umsatz: 338 },
    { stunde: '12', bestellungen: 21, umsatz: 512 },
    { stunde: '13', bestellungen: 19, umsatz: 463 },
    { stunde: '14', bestellungen: 11, umsatz: 269 },
    { stunde: '15', bestellungen: 7,  umsatz: 171 },
    { stunde: '16', bestellungen: 8,  umsatz: 196 },
    { stunde: '17', bestellungen: 11, umsatz: 286 },
  ],
  top_fahrer: [
    { name: 'Sara K.',  score: 94, touren: 12, trinkgeld: 18 },
    { name: 'Max M.',   score: 88, touren: 10, trinkgeld: 14 },
    { name: 'Tim B.',   score: 82, touren: 9,  trinkgeld: 11 },
  ],
};

function kpiStatus(card: KpiCard): 'gut' | 'ok' | 'warn' {
  if (card.gut_wenn_hoch) {
    if (card.wert_raw >= card.ziel) return 'gut';
    if (card.wert_raw >= card.ziel * 0.9) return 'ok';
    return 'warn';
  } else {
    if (card.wert_raw <= card.ziel) return 'gut';
    if (card.wert_raw <= card.ziel * 1.1) return 'ok';
    return 'warn';
  }
}

const STATUS_COLORS = {
  gut:  'text-green-600 dark:text-green-400',
  ok:   'text-yellow-600 dark:text-yellow-400',
  warn: 'text-red-600 dark:text-red-400',
};

const BAR_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff', '#0284c7', '#0369a1'];

export function LieferdienstPhase4895StatistikenDashboardV18() {
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/lieferdienst/statistiken-dashboard');
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock fallback */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-50 to-sky-50 dark:from-slate-800/40 dark:to-sky-950/20">
        <div className="flex items-center gap-2">
          <Sunrise className="w-5 h-5 text-sky-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">Statistiken V18</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-full font-medium">
            {data.schicht_tag}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Bike className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{data.live_fahrer}</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{data.aktive_touren}</span>
          </div>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-700/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 divide-x divide-y divide-slate-100 dark:divide-slate-700/50 border-b border-slate-100 dark:border-slate-700/50">
        {data.kpis.map(k => {
          const status = kpiStatus(k);
          const isGood = k.gut_wenn_hoch ? k.trend_richtung === 'up' : k.trend_richtung === 'down';
          const trendCl = isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
          return (
            <div key={k.label} className="p-3">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{k.label}</div>
              <div className={`text-lg font-extrabold tabular-nums ${STATUS_COLORS[status]}`}>
                {k.wert}{k.einheit}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {k.trend_richtung === 'up'
                  ? <TrendingUp className={`w-3 h-3 ${trendCl}`} />
                  : <TrendingDown className={`w-3 h-3 ${trendCl}`} />
                }
                <span className={`text-[10px] font-medium ${trendCl}`}>
                  {k.trend_pct > 0 ? '+' : ''}{k.trend_pct}%
                </span>
                <div className="flex items-center gap-0.5 ml-auto">
                  <Target className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] text-slate-400">{k.ziel}{k.einheit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stunden-Chart */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Bestellungen pro Stunde
        </div>
        <ResponsiveContainer width="100%" height={72}>
          <BarChart data={data.stunden_daten} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as StundenDaten;
                return (
                  <div className="bg-slate-800 rounded px-2 py-1 text-[10px] text-white">
                    {d.stunde}:00 · {d.bestellungen} Bestellungen · €{d.umsatz}
                  </div>
                );
              }}
            />
            {data.stunden_daten.map((_, i) => (
              <Bar key={i} dataKey="bestellungen" fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[2, 2, 0, 0]}>
                {data.stunden_daten.map((__, j) => (
                  <Cell key={j} fill={BAR_COLORS[j % BAR_COLORS.length]} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top-Fahrer */}
      <div className="px-4 py-3">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Top-Fahrer
        </div>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-yellow-500' : 'text-slate-400'}`}>
                {i + 1}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{f.name}</span>
              <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 tabular-nums w-8 text-right">{f.score}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{f.touren}T · €{f.trinkgeld}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">60-Sek-Polling · Mock-Fallback</span>
        <span className="text-[10px] text-sky-500 font-medium">V18</span>
      </div>
    </div>
  );
}
