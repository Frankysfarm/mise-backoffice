'use client';

import { useEffect, useState } from 'react';
import {
  BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Euro, Clock, Star, Target, Users, Zap, WifiOff, Activity,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface KpiItem {
  label: string;
  value: string;
  ziel: string;
  delta_pct: number;
  status: 'ok' | 'warn' | 'crit';
  icon: string;
}

interface HourBucket {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface FahrerStat {
  name: string;
  score: number;
  touren: number;
  trinkgeld_eur: number;
}

interface ZoneStat {
  zone: string;
  bestellungen: number;
  sla_pct: number;
  avg_min: number;
}

interface DashboardData {
  gesamt_score: number;
  score_delta: number;
  alert_kpis: number;
  kpis: KpiItem[];
  stunden: HourBucket[];
  top_fahrer: FahrerStat[];
  zonen: ZoneStat[];
  updated_at: string;
}

const NOW_H = new Date().getHours();
const MOCK: DashboardData = {
  gesamt_score: 84,
  score_delta: 3,
  alert_kpis: 2,
  kpis: [
    { label: 'Bestellungen',  value: '47',     ziel: '60',   delta_pct: +12,  status: 'warn', icon: 'zap'   },
    { label: 'Umsatz',        value: '842 €',  ziel: '1000 €', delta_pct: +8, status: 'warn', icon: 'euro'  },
    { label: 'Lieferzeit',    value: '31 Min', ziel: '≤35 Min', delta_pct: -5, status: 'ok', icon: 'clock' },
    { label: 'Pünktlichkeit', value: '88%',    ziel: '≥85%',  delta_pct: +3,  status: 'ok',   icon: 'target'},
    { label: 'Bewertung',     value: '4.6 ★',  ziel: '≥4.5',  delta_pct: +1,  status: 'ok',   icon: 'star'  },
    { label: 'Storno-Quote',  value: '4.2%',   ziel: '≤3%',   delta_pct: +40, status: 'crit', icon: 'alert' },
    { label: 'Aktive Fahrer', value: '6',      ziel: '8',     delta_pct: -25, status: 'crit', icon: 'users' },
    { label: 'Durchsatz',     value: '3.8/h',  ziel: '≥4/h',  delta_pct: -5,  status: 'warn', icon: 'activity'},
  ],
  stunden: Array.from({ length: 8 }, (_, i) => ({
    stunde: `${NOW_H - 7 + i}:00`,
    bestellungen: 4 + Math.round(Math.random() * 12),
    umsatz: 70 + Math.round(Math.random() * 180),
  })),
  top_fahrer: [
    { name: 'L. Meyer', score: 94, touren: 8,  trinkgeld_eur: 6.50 },
    { name: 'P. Braun', score: 88, touren: 7,  trinkgeld_eur: 4.80 },
    { name: 'S. Koch',  score: 74, touren: 5,  trinkgeld_eur: 2.20 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 24, sla_pct: 92, avg_min: 28 },
    { zone: 'Burtscheid', bestellungen: 14, sla_pct: 85, avg_min: 34 },
    { zone: 'Laurensberg', bestellungen:  9, sla_pct: 78, avg_min: 38 },
  ],
  updated_at: new Date().toISOString(),
};

const ICON_MAP: Record<string, React.ElementType> = {
  zap: Zap, euro: Euro, clock: Clock, target: Target,
  star: Star, alert: AlertTriangle, users: Users, activity: Activity,
};

const STATUS_COLORS = {
  ok:   { bg: 'bg-green-50 dark:bg-green-950/30',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-800' },
  warn: { bg: 'bg-amber-50 dark:bg-amber-950/30',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800' },
  crit: { bg: 'bg-red-50 dark:bg-red-950/30',      text: 'text-red-700 dark:text-red-300',      border: 'border-red-200 dark:border-red-800'     },
};

export function LieferdienstPhase4710StatistikenLiveDashboardUltimate({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/statistiken-dashboard${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: DashboardData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const scoreColor = d.gesamt_score >= 85 ? 'text-green-600 dark:text-green-400' : d.gesamt_score >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const scoreBg    = d.gesamt_score >= 85 ? 'bg-green-500' : d.gesamt_score >= 70 ? 'bg-amber-400' : 'bg-red-500';

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-xs">Dashboard nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Statistiken Ultimate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xl font-extrabold tabular-nums', scoreColor)}>{d.gesamt_score}</span>
          <span className={cn('text-xs font-semibold', d.score_delta >= 0 ? 'text-green-500' : 'text-red-500')}>
            {d.score_delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', scoreBg)} style={{ width: `${d.gesamt_score}%` }} />
      </div>

      {/* Alert strip */}
      {d.alert_kpis > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {d.alert_kpis} KPI{d.alert_kpis > 1 ? 's' : ''} außerhalb Ziel
          </span>
        </div>
      )}

      {/* KPI Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-2">
        {d.kpis.map((k) => {
          const Icon = ICON_MAP[k.icon] ?? Activity;
          const cfg = STATUS_COLORS[k.status];
          const DeltaIcon = k.delta_pct > 0 ? TrendingUp : k.delta_pct < 0 ? TrendingDown : Minus;
          return (
            <div key={k.label} className={cn('rounded-xl border p-2.5 space-y-0.5', cfg.bg, cfg.border)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Icon className={cn('w-3 h-3', cfg.text)} />
                  <span className={cn('text-[10px] font-medium', cfg.text)}>{k.label}</span>
                </div>
                <DeltaIcon className={cn('w-3 h-3', k.delta_pct > 0 ? 'text-green-500' : k.delta_pct < 0 ? 'text-red-400' : 'text-gray-400')} />
              </div>
              <div className={cn('text-base font-extrabold tabular-nums', cfg.text)}>{k.value}</div>
              <div className="text-[10px] text-gray-400">Ziel: {k.ziel}</div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors',
                  chartMode === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                )}
              >
                {m === 'bestellungen' ? 'Bestellg.' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.stunden} barSize={16}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8 }}
                formatter={((v: number) => chartMode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']) as any}
              />
              <Bar dataKey={chartMode} radius={[4, 4, 0, 0]}>
                {d.stunden.map((h, i) => (
                  <Cell key={i} fill={i === d.stunden.length - 1 ? '#6366f1' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Top Fahrer</div>
        <div className="space-y-1.5">
          {d.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 text-xs text-gray-700 dark:text-gray-300">{f.name}</div>
              <div className="h-1.5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${f.score}%` }} />
              </div>
              <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 w-6 tabular-nums">{f.score}</div>
              <div className="text-[10px] text-gray-400">{f.trinkgeld_eur.toFixed(2)}€</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen */}
      <div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Zonen-SLA</div>
        <div className="space-y-1.5">
          {d.zonen.map((z) => {
            const slaColor = z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-amber-400' : 'bg-red-500';
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 dark:text-gray-400 w-24 shrink-0">{z.zone}</div>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', slaColor)} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <div className="text-[10px] font-bold text-gray-700 dark:text-gray-300 tabular-nums w-8">{z.sla_pct}%</div>
                <div className="text-[10px] text-gray-400">{z.avg_min} Min</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right border-t border-gray-100 dark:border-gray-800 pt-2">
        60-Sek-Update · Mock-Fallback
      </div>
    </div>
  );
}
