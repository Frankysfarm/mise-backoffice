'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Euro, Clock, Package, Bike, Star, AlertTriangle, BarChart3, Target, Zap, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface KpiCard {
  label: string;
  value: string;
  unit: string;
  trend: number;
  status: 'gut' | 'ok' | 'kritisch';
}

interface HourlyBar {
  hour: string;
  bestellungen: number;
  umsatz: number;
}

interface ZoneRow {
  zone: string;
  bestellungen: number;
  avg_liefer_min: number;
  on_time_pct: number;
}

interface AlertRow {
  type: 'storno' | 'delay' | 'ontime' | 'rating';
  message: string;
  severity: 'info' | 'warn' | 'crit';
}

interface ApiData {
  kpis: KpiCard[];
  hourly: HourlyBar[];
  zones: ZoneRow[];
  alerts: AlertRow[];
  last_updated: string;
}

const MOCK: ApiData = {
  last_updated: new Date().toISOString(),
  kpis: [
    { label: 'Umsatz heute', value: '2.847', unit: '€', trend: 12, status: 'gut' },
    { label: 'Bestellungen', value: '84', unit: 'Stk', trend: 8, status: 'gut' },
    { label: 'Ø Lieferzeit', value: '28', unit: 'Min', trend: -3, status: 'ok' },
    { label: 'On-Time-Rate', value: '87', unit: '%', trend: 2, status: 'ok' },
    { label: 'Stornoquote', value: '4.2', unit: '%', trend: -1, status: 'ok' },
    { label: 'Ø Bewertung', value: '4.6', unit: '★', trend: 0.1, status: 'gut' },
    { label: 'Akt. Fahrer', value: '6', unit: 'online', trend: 0, status: 'gut' },
    { label: 'Ø Bestellwert', value: '33.9', unit: '€', trend: 5, status: 'gut' },
  ],
  hourly: [
    { hour: '11', bestellungen: 4, umsatz: 135 },
    { hour: '12', bestellungen: 12, umsatz: 408 },
    { hour: '13', bestellungen: 18, umsatz: 612 },
    { hour: '14', bestellungen: 9, umsatz: 306 },
    { hour: '15', bestellungen: 5, umsatz: 170 },
    { hour: '16', bestellungen: 7, umsatz: 238 },
    { hour: '17', bestellungen: 11, umsatz: 374 },
    { hour: '18', bestellungen: 18, umsatz: 604 },
  ],
  zones: [
    { zone: 'Innenstadt', bestellungen: 34, avg_liefer_min: 24, on_time_pct: 94 },
    { zone: 'Schwabing', bestellungen: 22, avg_liefer_min: 31, on_time_pct: 82 },
    { zone: 'Maxvorstadt', bestellungen: 18, avg_liefer_min: 27, on_time_pct: 89 },
    { zone: 'Haidhausen', bestellungen: 10, avg_liefer_min: 35, on_time_pct: 70 },
  ],
  alerts: [
    { type: 'delay', message: 'Haidhausen: Ø Lieferzeit 35 Min (+12 über Ziel)', severity: 'warn' },
    { type: 'storno', message: 'Stornoquote heute 4.2% — Ziel: <5%', severity: 'info' },
  ],
};

const STATUS_STYLES: Record<KpiCard['status'], { bg: string; text: string; dot: string }> = {
  gut: { bg: 'bg-matcha-50', text: 'text-matcha-800', dot: 'bg-matcha-500' },
  ok: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-400' },
  kritisch: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500' },
};

const ALERT_STYLES = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-500' },
  warn: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-500' },
  crit: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-500' },
};

type ChartMode = 'bestellungen' | 'umsatz';

export function LieferdienstPhase2575StatistikenMasterCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/statistiken?location_id=${locationId ?? ''}`);
        const d = await res.json();
        if (mounted) setData(d);
      } catch {
        if (mounted) setData(MOCK);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!data) return null;

  const chartData = data.hourly;
  const chartKey = chartMode === 'bestellungen' ? 'bestellungen' : 'umsatz';
  const maxVal = Math.max(...chartData.map(h => h[chartKey] as number));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">Statistiken Master Cockpit</div>
          <div className="text-[11px] text-stone-400">
            Heute · aktualisiert {new Date(data.last_updated).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
            {loading && ' · aktualisiert…'}
          </div>
        </div>
        {data.alerts.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <AlertTriangle className="h-3 w-3" />{data.alerts.length} Alert{data.alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="px-5 pt-4 space-y-2">
          {data.alerts.map((a, i) => {
            const s = ALERT_STYLES[a.severity];
            return (
              <div key={i} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2', s.bg, s.border)}>
                <AlertTriangle className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', s.icon)} />
                <span className={cn('text-[11px]', s.text)}>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {data.kpis.map(kpi => {
          const s = STATUS_STYLES[kpi.status];
          const trendUp = kpi.trend > 0;
          const trendNeutral = kpi.trend === 0;
          return (
            <div key={kpi.label} className={cn('rounded-xl p-3', s.bg)}>
              <div className="flex items-start justify-between">
                <div className={cn('text-xl font-black tabular-nums', s.text)}>
                  {kpi.value}<span className="text-sm font-semibold ml-0.5">{kpi.unit}</span>
                </div>
                {!trendNeutral && (
                  <span className={cn('flex items-center text-[10px] font-bold', trendUp ? 'text-matcha-600' : 'text-red-500')}>
                    {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trendUp ? '+' : ''}{kpi.trend}{kpi.unit === '%' || kpi.unit === '★' ? '' : '%'}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-semibold text-stone-500 mt-1">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Hourly Chart */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as ChartMode[]).map(m => (
              <button
                key={m}
                className={cn('rounded-lg px-2.5 py-1 text-[10px] font-bold transition', chartMode === m ? 'bg-matcha-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')}
                onClick={() => setChartMode(m)}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => { const n = typeof v === 'number' ? v : 0; return chartMode === 'umsatz' ? [`${n.toFixed(0)} €`, 'Umsatz'] : [n, 'Bestellungen']; }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
              />
              <Bar dataKey={chartKey} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={(entry[chartKey] as number) >= maxVal * 0.8 ? '#5a7a52' : (entry[chartKey] as number) >= maxVal * 0.5 ? '#7fa370' : '#b5cdb0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zones */}
      <div className="px-5 pb-5">
        <div className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Zonen-Übersicht</div>
        <div className="rounded-xl border border-stone-100 overflow-hidden">
          {data.zones.map((zone, i) => (
            <div key={zone.zone} className={cn('flex items-center gap-3 px-4 py-2.5', i % 2 === 0 ? 'bg-stone-50' : 'bg-white')}>
              <div className={cn('h-2 w-2 rounded-full shrink-0', zone.on_time_pct >= 90 ? 'bg-matcha-500' : zone.on_time_pct >= 80 ? 'bg-amber-400' : 'bg-red-400')} />
              <span className="text-sm font-semibold flex-1">{zone.zone}</span>
              <span className="text-xs tabular-nums text-stone-500">{zone.bestellungen} Bestellungen</span>
              <span className="text-xs tabular-nums text-stone-500">{zone.avg_liefer_min} Min</span>
              <span className={cn('text-xs font-bold tabular-nums', zone.on_time_pct >= 90 ? 'text-matcha-700' : zone.on_time_pct >= 80 ? 'text-amber-600' : 'text-red-600')}>
                {zone.on_time_pct}% p.
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
