'use client';

/**
 * Phase 2540 — Statistiken Executive Master
 *
 * 10 KPI-Kacheln mit Ampel-Farbkodierung + Stunden-Chart (Umsatz/Bestellungen)
 * + Zonen-Ranking Top-5 + Fahrer-Top-3 + Alert-Strip (Storno/Lieferzeit/On-Time/Bewertung).
 * 5-Min-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart2, CheckCircle2, Clock, Euro, Star, Target, TrendingUp, Users, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn, euro } from '@/lib/utils';

interface KpiTile {
  key: string;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  status: 'green' | 'yellow' | 'red';
  sub: string;
}

interface HourBucket {
  hour: string;
  umsatz: number;
  bestellungen: number;
}

interface ZoneEntry { name: string; orders: number; avg_time_min: number; }
interface DriverEntry { name: string; deliveries: number; rating: number; score: number; }
interface AlertEntry { type: 'danger' | 'warning'; text: string; }

interface Payload {
  kpis: KpiTile[];
  hourly: HourBucket[];
  zones: ZoneEntry[];
  drivers: DriverEntry[];
  alerts: AlertEntry[];
}

const MOCK: Payload = {
  kpis: [
    { key: 'umsatz',    label: 'Umsatz heute',      value: '€2.480',  trend: 'up',      status: 'green',  sub: '+12% vs. gestern' },
    { key: 'orders',    label: 'Bestellungen',       value: '87',      trend: 'up',      status: 'green',  sub: 'Ø 3,2/h' },
    { key: 'lieferzeit',label: 'Ø Lieferzeit',       value: '24 Min',  trend: 'neutral', status: 'yellow', sub: 'Ziel: ≤20 Min' },
    { key: 'ontime',    label: 'On-Time-Rate',       value: '82%',     trend: 'down',    status: 'yellow', sub: 'Ziel: ≥90%' },
    { key: 'storno',    label: 'Storno-Quote',       value: '3,1%',    trend: 'neutral', status: 'green',  sub: 'Limit: 5%' },
    { key: 'rating',    label: 'Ø Bewertung',        value: '4,7 ★',   trend: 'up',      status: 'green',  sub: '+0,1 vs. VW' },
    { key: 'fahrer',    label: 'Aktive Fahrer',      value: '6',       trend: 'neutral', status: 'green',  sub: '2 in Pause' },
    { key: 'umsatzph',  label: 'Umsatz/Stunde',      value: '€310',    trend: 'up',      status: 'green',  sub: 'Ziel: ≥€250' },
    { key: 'trinkgeld', label: 'Trinkgeld-Quote',    value: '8,4%',    trend: 'up',      status: 'green',  sub: '+1,2% vs. VW' },
    { key: 'kapazitaet',label: 'Auslastung',         value: '74%',     trend: 'up',      status: 'yellow', sub: 'Peak: 89%' },
  ],
  hourly: Array.from({ length: 10 }, (_, i) => ({
    hour: `${11 + i}:00`,
    umsatz: 80 + Math.round(Math.random() * 320),
    bestellungen: 3 + Math.round(Math.random() * 14),
  })),
  zones: [
    { name: 'Innenstadt', orders: 34, avg_time_min: 22 },
    { name: 'Nord',       orders: 21, avg_time_min: 27 },
    { name: 'Süd',        orders: 18, avg_time_min: 25 },
    { name: 'West',       orders: 9,  avg_time_min: 31 },
    { name: 'Ost',        orders: 5,  avg_time_min: 35 },
  ],
  drivers: [
    { name: 'Ahmad K.',  deliveries: 18, rating: 4.9, score: 94 },
    { name: 'Lena B.',   deliveries: 15, rating: 4.8, score: 88 },
    { name: 'Marco T.',  deliveries: 14, rating: 4.6, score: 82 },
  ],
  alerts: [
    { type: 'warning', text: 'On-Time-Rate unter 85% – letzte 2 Stunden' },
    { type: 'warning', text: 'Zone West: Ø Lieferzeit 31 Min (Ziel: ≤20)' },
  ],
};

const STATUS_STYLE: Record<string, string> = {
  green:  'bg-matcha-50 border-matcha-200 dark:bg-matcha-950/30 dark:border-matcha-800',
  yellow: 'bg-amber-50  border-amber-200  dark:bg-amber-950/30  dark:border-amber-800',
  red:    'bg-red-50    border-red-200    dark:bg-red-950/30    dark:border-red-800',
};
const STATUS_TEXT: Record<string, string> = {
  green:  'text-matcha-700  dark:text-matcha-300',
  yellow: 'text-amber-700   dark:text-amber-300',
  red:    'text-red-700     dark:text-red-300',
};

export function LieferdienstPhase2540StatistikExecutiveMaster({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Payload>(MOCK);
  const [chartMode, setChartMode] = useState<'umsatz' | 'bestellungen'>('umsatz');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/stats?type=executive${locationId ? `&location_id=${locationId}` : ''}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json?.kpis) setData(json);
    } catch { /* use mock */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 5 * 60_000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden space-y-3 p-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Statistiken Executive Master</span>
        <span className="ml-auto text-[9px] text-muted-foreground">5-Min-Update</span>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-1">
          {data.alerts.map((a, i) => (
            <div key={i} className={cn('flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-medium',
              a.type === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200')}>
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {a.text}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {data.kpis.map(kpi => (
          <div key={kpi.key} className={cn('rounded-lg border p-2', STATUS_STYLE[kpi.status])}>
            <div className={cn('text-[9px] font-bold uppercase tracking-wide', STATUS_TEXT[kpi.status])}>{kpi.label}</div>
            <div className={cn('font-display text-lg font-black leading-tight tabular-nums', STATUS_TEXT[kpi.status])}>{kpi.value}</div>
            <div className="text-[8px] text-muted-foreground">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Stunden-Chart */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Stundenverlauf</span>
          <div className="ml-auto flex rounded-lg overflow-hidden border border-border">
            {(['umsatz', 'bestellungen'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('px-2 py-0.5 text-[9px] font-medium transition', chartMode === m ? 'bg-matcha-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted')}>
                {m === 'umsatz' ? 'Umsatz' : 'Bestellungen'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.hourly} margin={{ top: 2, right: 2, bottom: 2, left: 2 }} barSize={16}>
            <XAxis dataKey="hour" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(v: number) => chartMode === 'umsatz' ? euro(v) : `${v} Bestellungen`}
            />
            <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
              {data.hourly.map((_, i) => <Cell key={i} fill={chartMode === 'umsatz' ? '#16a34a' : '#3b82f6'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen-Ranking + Fahrer-Top */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Zonen Top-5</div>
          {data.zones.map((z, i) => (
            <div key={z.name} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[9px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
              <span className="text-[10px] font-medium flex-1 truncate">{z.name}</span>
              <span className="text-[9px] font-bold text-matcha-600">{z.orders}</span>
              <span className={cn('text-[8px]', z.avg_time_min > 30 ? 'text-red-500' : z.avg_time_min > 25 ? 'text-amber-500' : 'text-matcha-600')}>
                {z.avg_time_min}m
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Fahrer Top-3</div>
          {data.drivers.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[9px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
              <span className="text-[10px] font-medium flex-1 truncate">{d.name}</span>
              <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5" />{d.rating}
              </span>
              <span className={cn('text-[9px] font-bold', d.score >= 80 ? 'text-matcha-600' : d.score >= 60 ? 'text-amber-600' : 'text-red-600')}>
                {d.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
