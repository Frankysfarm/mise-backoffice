'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Euro, Target, AlertTriangle, CheckCircle2, Zap, Users, Star, RefreshCw, Award, Activity } from 'lucide-react';

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_lieferzeit_min: number;
  bestellungen: number;
  umsatz_eur: number;
}

interface StundenDaten {
  stunde: string;
  bestellungen: number;
  umsatz_eur: number;
  sla_pct: number;
}

interface KpiTile {
  label: string;
  wert: string | number;
  delta_pct: number | null;
  ziel: string | number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface TopFahrer {
  name: string;
  score: number;
  touren: number;
  pünktlichkeit_pct: number;
}

interface DashboardData {
  schicht_score: number;
  schicht_score_delta: number;
  alert_count: number;
  kpis: KpiTile[];
  stunden: StundenDaten[];
  zonen: ZoneKpi[];
  top_fahrer: TopFahrer[];
  schicht_umsatz_eur: number;
  schicht_profit_eur: number;
  prognose_umsatz_eur: number;
  produktivitaet_pct: number;
}

const MOCK: DashboardData = {
  schicht_score: 87,
  schicht_score_delta: 3,
  alert_count: 1,
  schicht_umsatz_eur: 1380,
  schicht_profit_eur: 207,
  prognose_umsatz_eur: 1600,
  produktivitaet_pct: 86,
  kpis: [
    { label: 'Umsatz',        wert: '1.380 €',  delta_pct: 11,   ziel: '1.600 €', ampel: 'gelb'  },
    { label: 'Bestellungen',  wert: 64,          delta_pct: 10,   ziel: 70,        ampel: 'gelb'  },
    { label: 'Pünktlichkeit', wert: '91%',       delta_pct: 4,    ziel: '90%',     ampel: 'gruen' },
    { label: 'Ø Lieferzeit',  wert: '21m',       delta_pct: -6,   ziel: '25m',     ampel: 'gruen' },
    { label: 'Stornos',       wert: 2,           delta_pct: -60,  ziel: 5,         ampel: 'gruen' },
    { label: 'Fahrer aktiv',  wert: 4,           delta_pct: null, ziel: null,      ampel: 'gruen' },
    { label: 'Ø Score',       wert: 85,          delta_pct: 5,    ziel: 85,        ampel: 'gruen' },
    { label: 'SLA Zone A',    wert: '94%',       delta_pct: 2,    ziel: '90%',     ampel: 'gruen' },
    { label: 'Trinkgeld Ø',  wert: '2,10 €',    delta_pct: 17,   ziel: null,      ampel: 'gruen' },
    { label: 'Überfällig',   wert: 1,           delta_pct: null, ziel: 0,         ampel: 'rot'   },
    { label: 'Profit',        wert: '207 €',     delta_pct: 11,   ziel: '220 €',   ampel: 'gelb'  },
    { label: 'Bewertung Ø', wert: '4,7 ★',     delta_pct: 2,    ziel: '4,5',     ampel: 'gruen' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 5,  umsatz_eur: 95,  sla_pct: 90 },
    { stunde: '12', bestellungen: 14, umsatz_eur: 290, sla_pct: 88 },
    { stunde: '13', bestellungen: 18, umsatz_eur: 370, sla_pct: 92 },
    { stunde: '14', bestellungen: 11, umsatz_eur: 225, sla_pct: 95 },
    { stunde: '15', bestellungen: 7,  umsatz_eur: 140, sla_pct: 94 },
    { stunde: '16', bestellungen: 9,  umsatz_eur: 190, sla_pct: 91 },
    { stunde: '17', bestellungen: 0,  umsatz_eur: 0,   sla_pct: 0  },
  ],
  zonen: [
    { zone: 'A – Mitte',  sla_pct: 94, avg_lieferzeit_min: 19, bestellungen: 32, umsatz_eur: 690 },
    { zone: 'B – Nord',   sla_pct: 88, avg_lieferzeit_min: 24, bestellungen: 21, umsatz_eur: 450 },
    { zone: 'C – Süd',    sla_pct: 91, avg_lieferzeit_min: 21, bestellungen: 11, umsatz_eur: 240 },
  ],
  top_fahrer: [
    { name: 'Max M.', score: 93, touren: 8, pünktlichkeit_pct: 96 },
    { name: 'Lisa K.', score: 85, touren: 6, pünktlichkeit_pct: 87 },
    { name: 'Tom S.', score: 78, touren: 5, pünktlichkeit_pct: 82 },
  ],
};

function ampelBg(a: KpiTile['ampel']) {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
  if (a === 'gelb')  return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
  return                     'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
}

function ampelText(a: KpiTile['ampel']) {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb')  return 'text-yellow-700 dark:text-yellow-300';
  return                     'text-red-700 dark:text-red-300';
}

type ChartMode = 'bestellungen' | 'umsatz' | 'sla';

export function LieferdienstPhase4410StatistikDashboardV6() {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/analytics', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json?.schicht_score !== undefined) { setData(json); setLastRefresh(new Date()); }
    } catch { /* mock */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const i = setInterval(fetchData, 60_000);
    return () => clearInterval(i);
  }, [fetchData]);

  const scoreColor = data.schicht_score >= 85 ? 'text-green-600' : data.schicht_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const chartData = data.stunden.filter(s => s.bestellungen > 0 || s.umsatz_eur > 0);
  const chartKey = chartMode === 'bestellungen' ? 'bestellungen' : chartMode === 'umsatz' ? 'umsatz_eur' : 'sla_pct';

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Statistiken V6</span>
          <span className="text-xs text-emerald-100">Schicht-Dashboard</span>
        </div>
        <button onClick={fetchData} className="p-1 rounded bg-emerald-500 text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alert-Strip */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''} aktiv — sofort prüfen
          </span>
        </div>
      )}

      {/* Score + Summary-Cards */}
      <div className="grid grid-cols-4 gap-px bg-stone-100 dark:bg-stone-800">
        <div className="px-3 py-2.5 bg-white dark:bg-stone-900 text-center">
          <div className={`text-2xl font-bold ${scoreColor}`}>{data.schicht_score}</div>
          <div className="text-[10px] text-stone-500">Schicht-Score</div>
          <div className={`text-[10px] font-medium ${data.schicht_score_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {data.schicht_score_delta >= 0 ? '▲' : '▼'} {Math.abs(data.schicht_score_delta)} Pkt.
          </div>
        </div>
        <div className="px-3 py-2.5 bg-white dark:bg-stone-900 text-center">
          <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{data.schicht_umsatz_eur.toLocaleString('de-DE')} €</div>
          <div className="text-[10px] text-stone-500">Umsatz</div>
          <div className="text-[10px] text-stone-400">Ziel: {data.prognose_umsatz_eur.toLocaleString('de-DE')} €</div>
        </div>
        <div className="px-3 py-2.5 bg-white dark:bg-stone-900 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.schicht_profit_eur} €</div>
          <div className="text-[10px] text-stone-500">Profit</div>
          <div className="text-[10px] text-stone-400">{((data.schicht_profit_eur / data.schicht_umsatz_eur) * 100).toFixed(1)}% Marge</div>
        </div>
        <div className="px-3 py-2.5 bg-white dark:bg-stone-900 text-center">
          <div className={`text-2xl font-bold ${data.produktivitaet_pct >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>{data.produktivitaet_pct}%</div>
          <div className="text-[10px] text-stone-500">Produktivität</div>
          <div className="h-1.5 mt-1 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${data.produktivitaet_pct >= 85 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${data.produktivitaet_pct}%` }} />
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-stone-100 dark:border-stone-700">
        {data.kpis.map(k => (
          <div key={k.label} className={`rounded-lg border p-2 ${ampelBg(k.ampel)}`}>
            <div className={`text-sm font-bold ${ampelText(k.ampel)}`}>{k.wert}</div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400">{k.label}</div>
            {k.delta_pct !== null && (
              <div className={`flex items-center gap-0.5 text-[9px] mt-0.5 ${k.delta_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {k.delta_pct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(k.delta_pct)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stunden-Chart mit 3 Modi */}
      <div className="p-3 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'sla'] as ChartMode[]).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded ${chartMode === m ? 'bg-emerald-600 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500'}`}
              >
                {m === 'bestellungen' ? 'Bestellg.' : m === 'umsatz' ? 'Umsatz' : 'SLA'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px' }}
              formatter={((val: number) => [
                chartMode === 'umsatz' ? `${val} €` : chartMode === 'sla' ? `${val}%` : val,
                chartMode === 'bestellungen' ? 'Bestellungen' : chartMode === 'umsatz' ? 'Umsatz' : 'SLA'
              ]) as any}
            />
            <Bar dataKey={chartKey} radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={
                  chartMode === 'sla'
                    ? (d.sla_pct >= 90 ? '#22c55e' : d.sla_pct >= 80 ? '#eab308' : '#ef4444')
                    : '#059669'
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen-Ranking */}
      <div className="p-3 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-1.5 mb-2">
          <Target className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Zonen-Performance</span>
        </div>
        {data.zonen.map(z => (
          <div key={z.zone} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300 w-20 truncate">{z.zone}</span>
            <div className="flex-1 h-3 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${z.sla_pct}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-500 w-8 text-right">{z.sla_pct}%</span>
            <span className="text-[9px] text-stone-400">{z.bestellungen} Bestellg.</span>
          </div>
        ))}
      </div>

      {/* Top-3-Fahrer */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Top-Fahrer</span>
        </div>
        <div className="space-y-1.5">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-stone-400 w-4">{i + 1}.</span>
              <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 flex-1">{f.name}</span>
              <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden max-w-16">
                <div className={`h-full rounded-full ${f.score >= 90 ? 'bg-green-500' : f.score >= 80 ? 'bg-yellow-500' : 'bg-orange-500'}`} style={{ width: `${f.score}%` }} />
              </div>
              <span className={`text-[11px] font-bold w-7 text-right ${f.score >= 90 ? 'text-green-600' : f.score >= 80 ? 'text-yellow-600' : 'text-orange-600'}`}>{f.score}</span>
              <span className="text-[10px] text-stone-400">{f.touren} Touren</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-1.5 bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 flex justify-end">
        <span className="text-[9px] text-stone-400">↻ {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
