'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Star, Target, Zap, Clock, Euro, Users, Route, CheckCircle } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface KpiKachel {
  label: string;
  wert: string | number;
  einheit: string;
  trend: 'up' | 'down' | 'neutral';
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiData {
  kpis: KpiKachel[];
  top_insight: string;
  alert_kpis: string[];
  gesamt_score: number;
  stunden_verlauf: StundenPunkt[];
  zuletzt_aktualisiert: string;
}

const MOCK_STUNDEN: StundenPunkt[] = Array.from({ length: 12 }, (_, i) => ({
  stunde: `${11 + i}h`,
  bestellungen: Math.round(3 + Math.random() * 12),
  umsatz: Math.round(80 + Math.random() * 300),
}));

const MOCK: ApiData = {
  gesamt_score: 79,
  top_insight: 'Lieferzeit um 12% verbessert — weiter so! Storno-Quote leicht erhöht, prüfen.',
  alert_kpis: ['Storno-Quote'],
  zuletzt_aktualisiert: new Date().toISOString(),
  stunden_verlauf: MOCK_STUNDEN,
  kpis: [
    { label: 'Touren heute',   wert: 22,   einheit: '',        trend: 'up',      delta_pct: +8,  ampel: 'gruen', inverted: false },
    { label: 'Ø Lieferzeit',   wert: 27,   einheit: 'Min',     trend: 'down',    delta_pct: -12, ampel: 'gruen', inverted: true  },
    { label: 'Pünktlichkeit',  wert: 83,   einheit: '%',       trend: 'up',      delta_pct: +5,  ampel: 'gruen', inverted: false },
    { label: 'Storno-Quote',   wert: 4.2,  einheit: '%',       trend: 'up',      delta_pct: +18, ampel: 'rot',   inverted: true  },
    { label: 'Ø Bewertung',    wert: 4.5,  einheit: '★',       trend: 'neutral', delta_pct: 0,   ampel: 'gelb',  inverted: false },
    { label: 'Umsatz heute',   wert: 5840, einheit: '€',       trend: 'up',      delta_pct: +14, ampel: 'gruen', inverted: false },
    { label: 'Aktive Fahrer',  wert: 6,    einheit: '',        trend: 'neutral', delta_pct: 0,   ampel: 'gelb',  inverted: false },
    { label: 'SLA-Einhaltung', wert: 91,   einheit: '%',       trend: 'up',      delta_pct: +3,  ampel: 'gruen', inverted: false },
  ],
};

const AMPEL_BG: Record<string, string>   = { gruen: 'bg-emerald-50 dark:bg-emerald-950', gelb: 'bg-yellow-50 dark:bg-yellow-950',  rot: 'bg-red-50 dark:bg-red-950'   };
const AMPEL_DOT: Record<string, string>  = { gruen: 'bg-emerald-500',                    gelb: 'bg-yellow-400',                    rot: 'bg-red-500'                   };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-700 dark:text-emerald-300', gelb: 'text-yellow-700 dark:text-yellow-300', rot: 'text-red-700 dark:text-red-300' };

const KPI_ICONS: Record<string, JSX.Element> = {
  'Touren heute':   <Route    className="w-3 h-3" />,
  'Ø Lieferzeit':   <Clock    className="w-3 h-3" />,
  'Pünktlichkeit':  <Target   className="w-3 h-3" />,
  'Storno-Quote':   <AlertTriangle className="w-3 h-3" />,
  'Ø Bewertung':    <Star     className="w-3 h-3" />,
  'Umsatz heute':   <Euro     className="w-3 h-3" />,
  'Aktive Fahrer':  <Users    className="w-3 h-3" />,
  'SLA-Einhaltung': <CheckCircle className="w-3 h-3" />,
};

function trendGood(kpi: KpiKachel): boolean {
  if (kpi.trend === 'neutral') return true;
  return kpi.inverted ? kpi.trend === 'down' : kpi.trend === 'up';
}

type ChartMode = 'bestellungen' | 'umsatz';

interface Props { locationId: string | null }

export function LieferdienstPhase4500StatistikIntelligenceMaster({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-intelligence?location_id=${locationId}`);
      if (res.ok) {
        const j = await res.json();
        if (!j.error) {
          setData({
            ...j,
            stunden_verlauf: j.stunden_verlauf ?? MOCK_STUNDEN,
          });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scoreColor = data.gesamt_score >= 80 ? 'text-emerald-600' : data.gesamt_score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreBar   = data.gesamt_score >= 80 ? 'bg-emerald-500' : data.gesamt_score >= 60 ? 'bg-yellow-400' : 'bg-red-500';
  const alertKpis  = data.kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Statistiken Intelligence Master</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {alertKpis.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> {alertKpis.length} Alert
          </span>
        )}
      </div>

      {/* Gesamt-Score */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Zap className="w-3 h-3" /> Gesamt-Score
          </span>
          <span className={`text-2xl font-black ${scoreColor}`}>{data.gesamt_score}<span className="text-sm font-medium text-gray-400">/100</span></span>
        </div>
        <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${scoreBar}`} style={{ width: `${data.gesamt_score}%` }} />
        </div>
      </div>

      {/* Alert-Strip */}
      {alertKpis.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-2.5 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">
            Kritisch: {alertKpis.map(k => k.label).join(', ')}
          </span>
        </div>
      )}

      {/* KPI-Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(kpi => {
          const good = trendGood(kpi);
          return (
            <div key={kpi.label} className={`rounded-lg p-2.5 ${AMPEL_BG[kpi.ampel]} border border-transparent`}>
              <div className="flex items-center justify-between mb-1">
                <div className={`flex items-center gap-1 text-[9px] font-medium ${AMPEL_TEXT[kpi.ampel]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${AMPEL_DOT[kpi.ampel]}`} />
                  {KPI_ICONS[kpi.label] ?? null}
                  <span className="truncate">{kpi.label}</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className={`text-lg font-black ${AMPEL_TEXT[kpi.ampel]}`}>
                  {kpi.einheit === '€' && (kpi.wert as number) >= 1000
                    ? `${(Number(kpi.wert) / 1000).toFixed(1)}k`
                    : kpi.wert}
                  <span className="text-[10px] font-normal ml-0.5">{kpi.einheit}</span>
                </span>
                {kpi.delta_pct !== 0 && (
                  <span className={`text-[9px] font-bold flex items-center gap-0.5 ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {good ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                  </span>
                )}
                {kpi.delta_pct === 0 && (
                  <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                    <Minus className="w-2.5 h-2.5" /> stabil
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf-Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Stundenverlauf</p>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setChartMode('bestellungen')}
              className={`text-[9px] px-2 py-0.5 rounded font-medium transition-colors ${chartMode === 'bestellungen' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500'}`}
            >
              Bestellg.
            </button>
            <button
              onClick={() => setChartMode('umsatz')}
              className={`text-[9px] px-2 py-0.5 rounded font-medium transition-colors ${chartMode === 'umsatz' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500'}`}
            >
              Umsatz
            </button>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden_verlauf} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={((v: number) => chartMode === 'umsatz' ? [`${v}€`, 'Umsatz'] : [v, 'Bestellungen']) as any}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                {data.stunden_verlauf.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === data.stunden_verlauf.length - 1 ? '#6366f1' : '#a5b4fc'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-gray-400 text-center">Letzte Stunde (lila) hervorgehoben</p>
      </div>

      {/* Top-Insight */}
      {data.top_insight && (
        <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 rounded-lg p-2.5">
          <Star className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">{data.top_insight}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
        <span>60-Sek-Polling · Mock-Fallback</span>
        {data.zuletzt_aktualisiert && (
          <span>
            {new Date(data.zuletzt_aktualisiert).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>
    </div>
  );
}
