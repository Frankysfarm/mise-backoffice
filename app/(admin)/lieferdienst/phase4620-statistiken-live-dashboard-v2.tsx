'use client';

import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Euro, Clock, Star, Users, Package, Target, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  delta: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  icon: string;
}

interface StundenPunkt { stunde: string; bestellungen: number; umsatz: number }

interface ApiData {
  kpis: KpiKachel[];
  stunden_verlauf: StundenPunkt[];
  gesamt_score: number;
  alert_count: number;
  periode: string;
}

const MOCK: ApiData = {
  gesamt_score: 81,
  alert_count: 1,
  periode: 'Heute',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: '94', delta: +14, ampel: 'gelb', icon: 'package' },
    { key: 'umsatz', label: 'Umsatz', wert: '1.960 €', delta: +9, ampel: 'gelb', icon: 'euro' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: '24 min', delta: -3, ampel: 'gruen', icon: 'clock' },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: '89%', delta: +2, ampel: 'gelb', icon: 'target' },
    { key: 'bewertung', label: 'Ø Bewertung', wert: '4.7 ★', delta: null, ampel: 'gruen', icon: 'star' },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: '7', delta: null, ampel: 'gruen', icon: 'users' },
  ],
  stunden_verlauf: [
    { stunde: '11', bestellungen: 6,  umsatz: 124  },
    { stunde: '12', bestellungen: 16, umsatz: 335 },
    { stunde: '13', bestellungen: 21, umsatz: 438 },
    { stunde: '14', bestellungen: 14, umsatz: 291 },
    { stunde: '15', bestellungen: 10, umsatz: 207 },
    { stunde: '16', bestellungen: 8,  umsatz: 165 },
    { stunde: '17', bestellungen: 19, umsatz: 400 },
  ],
};

const ICON_MAP: Record<string, React.ReactNode> = {
  package: <Package className="w-4 h-4" />,
  euro:    <Euro className="w-4 h-4" />,
  clock:   <Clock className="w-4 h-4" />,
  target:  <Target className="w-4 h-4" />,
  star:    <Star className="w-4 h-4" />,
  users:   <Users className="w-4 h-4" />,
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  gelb:  'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
  rot:   'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
};
const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-400',
  gelb:  'text-yellow-700 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};
const AMPEL_ICON: Record<string, string> = {
  gruen: 'text-emerald-500', gelb: 'text-yellow-500', rot: 'text-red-500',
};

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

export function LieferdienstPhase4620StatistikenLiveDashboardV2({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/analytics${p}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-80" />;

  const scoreColor = data.gesamt_score >= 85 ? 'text-emerald-600' : data.gesamt_score >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Statistiken Live v2</h3>
        <span className="text-xs text-gray-400 ml-1">{data.periode}</span>
        <div className="ml-auto flex items-center gap-1">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span className={`text-xl font-bold ${scoreColor}`}>{data.gesamt_score}</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-300">⚠ {data.alert_count} KPI unter Zielwert</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        {data.kpis.map(k => (
          <div key={k.key} className={`rounded-xl border ${AMPEL_BG[k.ampel]} p-3`}>
            <div className={`mb-1 ${AMPEL_ICON[k.ampel]}`}>{ICON_MAP[k.icon]}</div>
            <p className={`text-base font-bold ${AMPEL_TEXT[k.ampel]}`}>{k.wert}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
            {k.delta !== null && (
              <p className={`text-xs mt-1 flex items-center gap-0.5 ${k.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {k.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {k.delta > 0 ? '+' : ''}{k.delta}%
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setChartMode('bestellungen')}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${chartMode === 'bestellungen' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Bestellungen
          </button>
          <button
            onClick={() => setChartMode('umsatz')}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${chartMode === 'umsatz' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Umsatz
          </button>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden_verlauf} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => chartMode === 'umsatz' ? `${v} €` : String(v)} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
              {data.stunden_verlauf.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
