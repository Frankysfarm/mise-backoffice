'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Euro, Package, Truck, Star, Users, Zap, Activity } from 'lucide-react';

interface KpiTile {
  key: string;
  label: string;
  value: string;
  unit: string;
  trend_pct: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundeData {
  h: number;
  label: string;
  bestellungen: number;
  umsatz_eur: number;
}

interface ZoneStat {
  zone: string;
  bestellungen: number;
  avg_min: number;
  sla_pct: number;
}

interface StatsData {
  kpis: KpiTile[];
  stunden: StundeData[];
  zonen: ZoneStat[];
  alert_count: number;
}

const MOCK: StatsData = {
  alert_count: 2,
  kpis: [
    { key: 'bestellungen',   label: 'Bestellungen',   value: '47',    unit: '',   trend_pct: 12,  ampel: 'gruen' },
    { key: 'umsatz',         label: 'Umsatz',         value: '1.240', unit: '€',  trend_pct: 8,   ampel: 'gruen' },
    { key: 'lieferzeit',     label: 'Ø Lieferzeit',   value: '24',    unit: 'min', trend_pct: -3, ampel: 'gelb'  },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit',  value: '87',    unit: '%',  trend_pct: 2,   ampel: 'gruen' },
    { key: 'storno',         label: 'Stornoquote',    value: '3.2',   unit: '%',  trend_pct: 1.5, ampel: 'gelb'  },
    { key: 'fahrer',         label: 'Akt. Fahrer',    value: '4',     unit: '',   trend_pct: null, ampel: 'gruen' },
    { key: 'bewertung',      label: 'Ø Bewertung',    value: '4.6',   unit: '★',  trend_pct: 0.2, ampel: 'gruen' },
    { key: 'sla',            label: 'SLA-Quote',      value: '91',    unit: '%',  trend_pct: -1,  ampel: 'gelb'  },
    { key: 'trinkgeld',      label: 'Ø Trinkgeld',    value: '1.80',  unit: '€',  trend_pct: 5,   ampel: 'gruen' },
    { key: 'touren',         label: 'Touren',         value: '18',    unit: '',   trend_pct: 6,   ampel: 'gruen' },
    { key: 'avg_wert',       label: 'Ø Bestellwert',  value: '26.40', unit: '€',  trend_pct: 2,   ampel: 'gruen' },
    { key: 'leerfahrt',      label: 'Leerfahrten',    value: '5.6',   unit: '%',  trend_pct: -0.5, ampel: 'gelb' },
  ],
  stunden: [
    { h: 11, label: '11h', bestellungen: 3,  umsatz_eur: 80  },
    { h: 12, label: '12h', bestellungen: 9,  umsatz_eur: 240 },
    { h: 13, label: '13h', bestellungen: 11, umsatz_eur: 295 },
    { h: 14, label: '14h', bestellungen: 7,  umsatz_eur: 185 },
    { h: 15, label: '15h', bestellungen: 4,  umsatz_eur: 105 },
    { h: 16, label: '16h', bestellungen: 3,  umsatz_eur: 78  },
    { h: 17, label: '17h', bestellungen: 10, umsatz_eur: 257 },
  ],
  zonen: [
    { zone: 'Innenstadt',  bestellungen: 21, avg_min: 19, sla_pct: 95 },
    { zone: 'West',        bestellungen: 14, avg_min: 26, sla_pct: 86 },
    { zone: 'Nord',        bestellungen: 8,  avg_min: 31, sla_pct: 75 },
    { zone: 'Süd',         bestellungen: 4,  avg_min: 28, sla_pct: 80 },
  ],
};

const AMPEL_STYLES = {
  gruen: { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400' },
  gelb:  { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  rot:   { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'   },
} as const;

const KPI_ICONS: Record<string, React.ReactNode> = {
  bestellungen:   <Package className="w-3 h-3" />,
  umsatz:         <Euro className="w-3 h-3" />,
  lieferzeit:     <Clock className="w-3 h-3" />,
  puenktlichkeit: <CheckCircle2 className="w-3 h-3" />,
  storno:         <AlertTriangle className="w-3 h-3" />,
  fahrer:         <Users className="w-3 h-3" />,
  bewertung:      <Star className="w-3 h-3" />,
  sla:            <Activity className="w-3 h-3" />,
  trinkgeld:      <Zap className="w-3 h-3" />,
  touren:         <Truck className="w-3 h-3" />,
  avg_wert:       <Euro className="w-3 h-3" />,
  leerfahrt:      <AlertTriangle className="w-3 h-3" />,
};

type ChartMode = 'bestellungen' | 'umsatz';

interface Props { locationId: string | null }

export function LieferdienstPhase4220StatistikDashboardV4({ locationId }: Props) {
  const [data, setData] = useState<StatsData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/stats/dashboard?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const nowH = new Date().getHours();
  const alerts = data.kpis.filter((k) => k.ampel === 'rot');

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-matcha-600" />
          <span className="text-xs font-semibold text-gray-900">Statistiken-Dashboard V4</span>
          {loading && <span className="w-2 h-2 border-2 border-matcha-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
            <AlertTriangle className="w-3 h-3" />{data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* KPI 12-Kacheln Grid */}
      <div className="grid grid-cols-4 gap-1">
        {data.kpis.map((kpi) => {
          const st = AMPEL_STYLES[kpi.ampel];
          const icon = KPI_ICONS[kpi.key];
          const isPos = kpi.trend_pct != null && kpi.trend_pct > 0;
          const isNeg = kpi.trend_pct != null && kpi.trend_pct < 0;

          return (
            <div key={kpi.key} className={`${st.bg} rounded-lg p-1.5 space-y-0.5`}>
              <div className={`flex items-center gap-0.5 ${st.text} opacity-60`}>
                {icon}
                <span className="text-[7px] font-bold uppercase tracking-wide truncate">{kpi.label}</span>
              </div>
              <div className="flex items-end gap-0.5">
                <span className={`text-xs font-bold ${st.text}`}>{kpi.value}</span>
                <span className="text-[7px] text-gray-400">{kpi.unit}</span>
              </div>
              {kpi.trend_pct != null && (
                <div className={`flex items-center gap-0.5 text-[7px] font-semibold ${isPos ? 'text-green-500' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
                  {isPos ? <TrendingUp className="w-2 h-2" /> : isNeg ? <TrendingDown className="w-2 h-2" /> : null}
                  {isPos ? '+' : ''}{kpi.trend_pct}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alert-Strip */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="text-[10px] text-red-700 font-medium">
            {alerts.map((a) => a.label).join(' · ')} — Handlung empfohlen
          </span>
        </div>
      )}

      {/* Stundenverlauf Chart */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex gap-1">
            <button
              onClick={() => setChartMode('bestellungen')}
              className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${chartMode === 'bestellungen' ? 'bg-matcha-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >Bestellungen</button>
            <button
              onClick={() => setChartMode('umsatz')}
              className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${chartMode === 'umsatz' ? 'bg-matcha-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >Umsatz</button>
          </div>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
                formatter={(v) => chartMode === 'umsatz' ? [`€${v}`, 'Umsatz'] : [v, 'Bestellungen']}
              />
              <Bar dataKey={chartMode === 'umsatz' ? 'umsatz_eur' : 'bestellungen'} radius={[3, 3, 0, 0]} maxBarSize={20}>
                {data.stunden.map((entry) => (
                  <Cell
                    key={entry.h}
                    fill={entry.h === nowH ? '#5c7a4e' : '#c7d8b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen-Ranking */}
      <div className="space-y-1">
        <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide">Zonen</span>
        <div className="space-y-0.5">
          {data.zonen.map((z) => {
            const slaColor = z.sla_pct >= 90 ? 'text-green-600' : z.sla_pct >= 80 ? 'text-yellow-600' : 'text-red-600';
            const maxBestellungen = Math.max(...data.zonen.map((x) => x.bestellungen), 1);
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-600 w-20 flex-shrink-0 truncate">{z.zone}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-matcha-400 rounded-full"
                    style={{ width: `${(z.bestellungen / maxBestellungen) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-500 w-5 text-right">{z.bestellungen}</span>
                <span className="text-[9px] text-gray-400 w-8 text-right">{z.avg_min}m</span>
                <span className={`text-[9px] font-bold w-8 text-right ${slaColor}`}>{z.sla_pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100">
        <span>12 KPIs · Ampel grün/gelb/rot · Trend vs. Vorperiode</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />60s</span>
      </div>
    </div>
  );
}
