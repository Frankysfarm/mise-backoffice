'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Package, Bike, Euro, Star, AlertTriangle, Target, Activity } from 'lucide-react';

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
  pünktlich_pct: number;
}

interface ZonenPerformance {
  zone: string;
  lieferungen: number;
  avg_min: number;
  pünktlich_pct: number;
  umsatz: number;
}

interface ApiResponse {
  kpis: KpiCard[];
  stunden_daten: StundenDaten[];
  zonen: ZonenPerformance[];
  schicht_tag: string;
  alert: string | null;
  live_fahrer: number;
  aktive_touren: number;
}

const MOCK: ApiResponse = {
  schicht_tag: 'Heute',
  alert: null,
  live_fahrer: 4,
  aktive_touren: 3,
  kpis: [
    { label: 'Bestellungen',   wert: '89',    wert_raw: 89,   ziel: 100, einheit: '',    trend_pct: +8,  trend_richtung: 'up',   gut_wenn_hoch: true },
    { label: 'Umsatz',         wert: '2.340', wert_raw: 2340, ziel: 2500, einheit: '€',  trend_pct: +12, trend_richtung: 'up',   gut_wenn_hoch: true },
    { label: 'Pünktlichkeit',  wert: '84',    wert_raw: 84,   ziel: 90,  einheit: '%',   trend_pct: +3,  trend_richtung: 'up',   gut_wenn_hoch: true },
    { label: 'Ø Lieferzeit',   wert: '26',    wert_raw: 26,   ziel: 25,  einheit: 'min', trend_pct: -2,  trend_richtung: 'down', gut_wenn_hoch: false },
    { label: 'Stornoquote',    wert: '3,2',   wert_raw: 3.2,  ziel: 5,   einheit: '%',   trend_pct: -5,  trend_richtung: 'down', gut_wenn_hoch: false },
    { label: 'Ø Bewertung',    wert: '4,6',   wert_raw: 4.6,  ziel: 4.5, einheit: '★',   trend_pct: +2,  trend_richtung: 'up',   gut_wenn_hoch: true },
  ],
  stunden_daten: [
    { stunde: '11', bestellungen: 4,  umsatz: 95,  pünktlich_pct: 100 },
    { stunde: '12', bestellungen: 12, umsatz: 298, pünktlich_pct: 92 },
    { stunde: '13', bestellungen: 18, umsatz: 445, pünktlich_pct: 88 },
    { stunde: '14', bestellungen: 14, umsatz: 337, pünktlich_pct: 86 },
    { stunde: '15', bestellungen: 8,  umsatz: 192, pünktlich_pct: 90 },
    { stunde: '16', bestellungen: 6,  umsatz: 141, pünktlich_pct: 93 },
    { stunde: '17', bestellungen: 11, umsatz: 260, pünktlich_pct: 80 },
    { stunde: '18', bestellungen: 16, umsatz: 572, pünktlich_pct: 77 },
  ],
  zonen: [
    { zone: 'Mitte',    lieferungen: 34, avg_min: 22, pünktlich_pct: 91, umsatz: 880 },
    { zone: 'Nord',     lieferungen: 21, avg_min: 29, pünktlich_pct: 78, umsatz: 545 },
    { zone: 'Süd',      lieferungen: 18, avg_min: 26, pünktlich_pct: 84, umsatz: 468 },
    { zone: 'West',     lieferungen: 16, avg_min: 31, pünktlich_pct: 75, umsatz: 447 },
  ],
};

function trendColor(card: KpiCard) {
  const isGood = card.gut_wenn_hoch ? card.trend_richtung === 'up' : card.trend_richtung === 'down';
  return isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}

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

const STATUS_COLORS = { gut: 'text-green-600 dark:text-green-400', ok: 'text-yellow-600 dark:text-yellow-400', warn: 'text-red-600 dark:text-red-400' };
const BAR_COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed', '#ea580c', '#c2410c'];

export function LieferdienstPhase4890StatistikenDashboardV17() {
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
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-50 to-orange-50 dark:from-slate-800/40 dark:to-orange-950/20">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">Statistiken-Dashboard V17</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-full font-medium">
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
          return (
            <div key={k.label} className="p-3">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{k.label}</div>
              <div className={`text-lg font-extrabold tabular-nums ${STATUS_COLORS[status]}`}>
                {k.wert}{k.einheit}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {k.trend_richtung === 'up'
                  ? <TrendingUp className={`w-3 h-3 ${trendColor(k)}`} />
                  : <TrendingDown className={`w-3 h-3 ${trendColor(k)}`} />
                }
                <span className={`text-[10px] font-medium ${trendColor(k)}`}>
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
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden_daten} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as StundenDaten;
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
                    <div className="font-bold text-white">{d.stunde}:00 Uhr</div>
                    <div className="text-orange-400">{d.bestellungen} Bestellungen</div>
                    <div className="text-slate-400">{d.pünktlich_pct}% pünktlich</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
              {data.stunden_daten.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.pünktlich_pct >= 90 ? '#f97316' : d.pünktlich_pct >= 80 ? '#facc15' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pünktlichkeits-Trend */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Pünktlichkeits-Trend (%)
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={data.stunden_daten} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
                    <div className="text-green-400">{payload[0].value}% pünktlich</div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="pünktlich_pct"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen-Tabelle */}
      <div className="px-4 py-3">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Zonen-Performance
        </div>
        <div className="space-y-2">
          {data.zonen.map(z => {
            const barW = Math.round((z.lieferungen / Math.max(...data.zonen.map(x => x.lieferungen))) * 100);
            return (
              <div key={z.zone} className="flex items-center gap-3">
                <div className="w-10 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">{z.zone}</div>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${z.pünktlich_pct >= 90 ? 'bg-orange-500' : z.pünktlich_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums w-10 text-right">{z.lieferungen}×</span>
                <span className="text-[10px] text-slate-400 tabular-nums w-10">{z.avg_min} min</span>
                <span className={`text-[10px] tabular-nums w-8 font-medium ${z.pünktlich_pct >= 90 ? 'text-green-600 dark:text-green-400' : z.pünktlich_pct >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {z.pünktlich_pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-400">60-Sek-Polling · KPI-Trend · Stunden-Chart · Zonen-Tabelle · Mock-Fallback</span>
      </div>
    </div>
  );
}
