'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Users, Clock, Star, Euro, Target, Truck, XCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KPI {
  key: string;
  label: string;
  value: string;
  delta_pct: number | null;
  ziel: string | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  invert: boolean;
}

interface StundenPunkt { h: number; label: string; bestellungen: number; umsatz: number; }
interface FahrerTop { fahrer_id: string; fahrer_name: string; score: number; touren: number; umsatz: number; }
interface ZoneRow { zone: string; bestellungen: number; sla_pct: number; avg_lieferzeit_min: number; }

interface ApiData {
  kpis: KPI[];
  stunden: StundenPunkt[];
  top_fahrer: FahrerTop[];
  zonen: ZoneRow[];
  jetzt_stunde: number;
  gesamt_score: number;
  insight: string;
}

const MOCK: ApiData = {
  gesamt_score: 74,
  insight: 'Pünktlichkeit unter Ziel – Kürzere Batches ab 18 Uhr empfohlen.',
  jetzt_stunde: new Date().getHours(),
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', value: '47', delta_pct: +12, ziel: '60', ampel: 'gelb', invert: false },
    { key: 'umsatz', label: 'Umsatz', value: '€ 1.240', delta_pct: +8, ziel: '€ 1.500', ampel: 'gelb', invert: false },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', value: '27 min', delta_pct: -3, ziel: '25 min', ampel: 'gelb', invert: true },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', value: '79%', delta_pct: -4, ziel: '85%', ampel: 'rot', invert: true },
    { key: 'bewertung', label: 'Bewertung', value: '4.4★', delta_pct: +1, ziel: '4.5★', ampel: 'gelb', invert: false },
    { key: 'fahrer_online', label: 'Fahrer online', value: '5', delta_pct: null, ziel: '6', ampel: 'gelb', invert: false },
    { key: 'sla', label: 'SLA-Rate', value: '81%', delta_pct: -2, ziel: '90%', ampel: 'rot', invert: true },
    { key: 'storno', label: 'Stornoquote', value: '3.2%', delta_pct: +0.5, ziel: '≤3%', ampel: 'rot', invert: false },
  ],
  stunden: [
    { h: 11, label: '11', bestellungen: 4, umsatz: 104 },
    { h: 12, label: '12', bestellungen: 9, umsatz: 234 },
    { h: 13, label: '13', bestellungen: 7, umsatz: 187 },
    { h: 14, label: '14', bestellungen: 5, umsatz: 130 },
    { h: 17, label: '17', bestellungen: 6, umsatz: 156 },
    { h: 18, label: '18', bestellungen: 8, umsatz: 208 },
    { h: 19, label: '19', bestellungen: 8, umsatz: 221 },
  ],
  top_fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Maria S.', score: 92, touren: 6, umsatz: 312 },
    { fahrer_id: 'f2', fahrer_name: 'Lara M.', score: 86, touren: 5, umsatz: 270 },
    { fahrer_id: 'f3', fahrer_name: 'Ben K.', score: 71, touren: 4, umsatz: 198 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 22, sla_pct: 88, avg_lieferzeit_min: 24 },
    { zone: 'Burtscheid', bestellungen: 14, sla_pct: 79, avg_lieferzeit_min: 29 },
    { zone: 'Haaren', bestellungen: 11, sla_pct: 73, avg_lieferzeit_min: 32 },
  ],
};

type ChartMode = 'bestellungen' | 'umsatz';

const ampelColor: Record<string, string> = { gruen: 'text-emerald-600', gelb: 'text-yellow-500', rot: 'text-red-500' };
const ampelBg: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-yellow-50 border-yellow-200', rot: 'bg-red-50 border-red-200' };
const kpiIcon: Record<string, React.ReactNode> = {
  bestellungen: <Target className="w-3.5 h-3.5" />,
  umsatz: <Euro className="w-3.5 h-3.5" />,
  lieferzeit: <Clock className="w-3.5 h-3.5" />,
  puenktlichkeit: <CheckCircle2 className="w-3.5 h-3.5" />,
  bewertung: <Star className="w-3.5 h-3.5" />,
  fahrer_online: <Users className="w-3.5 h-3.5" />,
  sla: <TrendingUp className="w-3.5 h-3.5" />,
  storno: <XCircle className="w-3.5 h-3.5" />,
};

interface Props { locationId?: string | null; }

export function LieferdienstPhase2780StatistikTagesIntelligence({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-tages-intelligence?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const alertKpis = data.kpis.filter((k) => k.ampel === 'rot');
  const scoreColor = data.gesamt_score >= 80 ? 'text-emerald-600' : data.gesamt_score >= 65 ? 'text-yellow-500' : 'text-red-500';
  const scoreBarColor = data.gesamt_score >= 80 ? 'bg-emerald-500' : data.gesamt_score >= 65 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Tages-Intelligence Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {alertKpis.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" /> {alertKpis.length} Alerts
            </span>
          )}
        </div>
      </div>

      {/* Alert Strip */}
      {alertKpis.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {alertKpis.map((k) => (
            <span key={k.key} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-medium">
              {k.label}: {k.value}
            </span>
          ))}
        </div>
      )}

      {/* Score Ring + Insight */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke={data.gesamt_score >= 80 ? '#10b981' : data.gesamt_score >= 65 ? '#f59e0b' : '#ef4444'}
              strokeWidth="4"
              strokeDasharray={`${(data.gesamt_score / 100) * 125.6} 125.6`}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor}`}>
            {data.gesamt_score}
          </span>
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-gray-400 mb-0.5">Schicht-Score</div>
          <div className="text-[11px] text-gray-700 leading-snug">{data.insight}</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {data.kpis.map((kpi) => {
          const deltaUp = (kpi.delta_pct ?? 0) > 0;
          const deltaColor = kpi.invert
            ? (deltaUp ? 'text-red-500' : 'text-emerald-500')
            : (deltaUp ? 'text-emerald-500' : 'text-red-500');

          return (
            <div key={kpi.key} className={`rounded-lg border p-2 ${ampelBg[kpi.ampel]}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className={ampelColor[kpi.ampel]}>{kpiIcon[kpi.key] ?? <BarChart2 className="w-3.5 h-3.5" />}</span>
                <span className="text-[10px] text-gray-500 truncate">{kpi.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-bold ${ampelColor[kpi.ampel]}`}>{kpi.value}</span>
                {kpi.delta_pct !== null && (
                  <span className={`text-[10px] font-medium ${deltaColor} flex items-center gap-0.5`}>
                    {kpi.delta_pct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                  </span>
                )}
              </div>
              {kpi.ziel && <div className="text-[9px] text-gray-400">Ziel: {kpi.ziel}</div>}
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf Chart */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-700">Stundenverlauf</span>
          <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
            {(['bestellungen', 'umsatz'] as ChartMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${chartMode === m ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-gray-500'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: number) => chartMode === 'umsatz' ? [`€${v}`, 'Umsatz'] : [v, 'Bestellungen']}
                contentStyle={{ fontSize: 10, padding: '2px 6px' }}
              />
              <Bar dataKey={chartMode} radius={[2, 2, 0, 0]}>
                {data.stunden.map((s) => (
                  <Cell
                    key={s.h}
                    fill={s.h === data.jetzt_stunde ? '#6366f1' : '#c7d2fe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-gray-700 flex items-center gap-1">
          <Truck className="w-3 h-3" /> Top-Fahrer heute
        </div>
        {data.top_fahrer.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-4">#{i + 1}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${f.score}%` }} />
            </div>
            <span className="text-[10px] text-gray-700 w-16 truncate">{f.fahrer_name}</span>
            <span className="text-[10px] font-bold text-indigo-600 w-8 text-right">{f.score}</span>
          </div>
        ))}
      </div>

      {/* Zonen */}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-gray-700">Zonen-SLA</div>
        {data.zonen.map((z) => {
          const slaColor = z.sla_pct >= 85 ? 'bg-emerald-400' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={z.zone} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-20 truncate">{z.zone}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${slaColor} rounded-full`} style={{ width: `${z.sla_pct}%` }} />
              </div>
              <span className="text-[10px] font-bold text-gray-700 w-8 text-right">{z.sla_pct}%</span>
              <span className="text-[9px] text-gray-400 w-10 text-right">{z.avg_lieferzeit_min} min</span>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-1">
        60-Sek-Polling · 8 KPI-Kacheln · Stundenverlauf · Top-Fahrer · Zonen-SLA
      </div>
    </div>
  );
}
