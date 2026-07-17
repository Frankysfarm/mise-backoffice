'use client';

/**
 * LieferdienstPerformanceHub
 * Erweitertes Statistiken-Dashboard mit:
 * - Stündliche Trend-Analyse
 * - Zonen-Vergleich
 * - Fahrer-Leaderboard
 * - SLA-Einhaltung
 */

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, MapPin, Bike, Clock, Star, Award, Target, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HourlyMetric {
  hour: number;
  orders: number;
  delivered: number;
  avg_time_min: number;
  on_time_rate: number;
}

interface ZoneStat {
  zone: string;
  orders: number;
  avg_time_min: number;
  on_time_rate: number;
  revenue_eur: number;
}

interface DriverStat {
  name: string;
  score: number;
  deliveries: number;
  on_time_rate: number;
  avg_time_min: number;
  earnings_eur: number;
}

interface PerfData {
  hourly: HourlyMetric[];
  zones: ZoneStat[];
  drivers: DriverStat[];
  sla_today: number;
  avg_delivery_time: number;
  total_orders: number;
  peak_hour: number;
}

const MOCK: PerfData = {
  sla_today: 91.3,
  avg_delivery_time: 28.4,
  total_orders: 134,
  peak_hour: 19,
  hourly: [
    { hour: 11, orders: 4,  delivered: 4,  avg_time_min: 24, on_time_rate: 100 },
    { hour: 12, orders: 11, delivered: 11, avg_time_min: 27, on_time_rate: 91  },
    { hour: 13, orders: 8,  delivered: 8,  avg_time_min: 31, on_time_rate: 88  },
    { hour: 14, orders: 5,  delivered: 5,  avg_time_min: 25, on_time_rate: 100 },
    { hour: 15, orders: 3,  delivered: 3,  avg_time_min: 22, on_time_rate: 100 },
    { hour: 16, orders: 7,  delivered: 7,  avg_time_min: 28, on_time_rate: 86  },
    { hour: 17, orders: 14, delivered: 13, avg_time_min: 33, on_time_rate: 79  },
    { hour: 18, orders: 21, delivered: 20, avg_time_min: 35, on_time_rate: 85  },
    { hour: 19, orders: 28, delivered: 26, avg_time_min: 37, on_time_rate: 82  },
    { hour: 20, orders: 22, delivered: 21, avg_time_min: 32, on_time_rate: 91  },
    { hour: 21, orders: 11, delivered: 11, avg_time_min: 29, on_time_rate: 100 },
  ],
  zones: [
    { zone: 'Innenstadt',  orders: 48, avg_time_min: 24, on_time_rate: 94, revenue_eur: 1240 },
    { zone: 'Burtscheid',  orders: 32, avg_time_min: 31, on_time_rate: 88, revenue_eur: 820  },
    { zone: 'Laurensberg', orders: 28, avg_time_min: 33, on_time_rate: 82, revenue_eur: 710  },
    { zone: 'Eilendorf',   orders: 18, avg_time_min: 38, on_time_rate: 78, revenue_eur: 490  },
    { zone: 'Forst',       orders: 8,  avg_time_min: 42, on_time_rate: 75, revenue_eur: 218  },
  ],
  drivers: [
    { name: 'Ahmed K.',  score: 94, deliveries: 31, on_time_rate: 97, avg_time_min: 24, earnings_eur: 62.40 },
    { name: 'Sara P.',   score: 88, deliveries: 26, on_time_rate: 92, avg_time_min: 28, earnings_eur: 52.00 },
    { name: 'Lukas M.',  score: 81, deliveries: 22, on_time_rate: 86, avg_time_min: 32, earnings_eur: 44.00 },
    { name: 'Marco T.',  score: 74, deliveries: 18, on_time_rate: 78, avg_time_min: 36, earnings_eur: 36.00 },
    { name: 'Yuki N.',   score: 69, deliveries: 15, on_time_rate: 73, avg_time_min: 41, earnings_eur: 30.00 },
  ],
};

function scoreColor(v: number, high = 90, mid = 75) {
  if (v >= high) return 'text-matcha-700';
  if (v >= mid)  return 'text-amber-600';
  return 'text-red-600';
}

function BarMini({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LieferdienstPerformanceHub({ locationId }: { locationId?: string | null }) {
  const [data] = useState<PerfData>(MOCK);
  const [tab, setTab] = useState<'hourly' | 'zones' | 'drivers'>('hourly');

  const maxOrders = Math.max(...data.hourly.map(h => h.orders));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-rose-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-black text-stone-900 uppercase tracking-wide">Performance Hub</div>
            <div className="text-[10px] text-stone-400">Statistiken · Trends · Leaderboard</div>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-sm font-black', scoreColor(data.sla_today))}>{data.sla_today.toFixed(1)}%</div>
          <div className="text-[9px] text-stone-400">SLA heute</div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50">
        {[
          { label: 'Bestellungen', value: data.total_orders, color: 'text-stone-800' },
          { label: 'Ø Lieferzeit', value: `${data.avg_delivery_time.toFixed(0)} Min`, color: 'text-blue-700' },
          { label: 'Pünktlich', value: `${data.sla_today.toFixed(0)}%`, color: scoreColor(data.sla_today) },
          { label: 'Peak', value: `${data.peak_hour}:00`, color: 'text-amber-700' },
        ].map(kpi => (
          <div key={kpi.label} className="py-2 px-2 text-center">
            <div className={cn('text-sm font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] text-stone-400">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 px-4 py-2 border-b border-stone-100 bg-white">
        {(['hourly', 'zones', 'drivers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 rounded-lg text-[10px] font-bold transition-all',
              tab === t ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
            )}
          >
            {t === 'hourly' ? 'Stündlich' : t === 'zones' ? 'Zonen' : 'Fahrer'}
          </button>
        ))}
      </div>

      {/* Hourly Chart */}
      {tab === 'hourly' && (
        <div className="px-4 py-3 space-y-1.5 max-h-56 overflow-y-auto">
          {data.hourly.map(h => (
            <div key={h.hour} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400 w-10 shrink-0">{h.hour}:00</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <div className="w-24 h-4 rounded-sm bg-stone-100 overflow-hidden flex items-end">
                  <div
                    className={cn('w-full rounded-sm transition-all', h.on_time_rate >= 90 ? 'bg-matcha-500' : h.on_time_rate >= 80 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ height: `${Math.round((h.orders / maxOrders) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-stone-700 w-6 tabular-nums">{h.orders}</span>
              </div>
              <span className="text-[10px] font-mono text-stone-500 w-12 text-right tabular-nums">{h.avg_time_min} Min</span>
              <span className={cn('text-[10px] font-bold w-10 text-right tabular-nums', scoreColor(h.on_time_rate, 90, 80))}>
                {h.on_time_rate}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Zones */}
      {tab === 'zones' && (
        <div className="divide-y divide-stone-50 max-h-56 overflow-y-auto">
          {data.zones.sort((a, b) => b.orders - a.orders).map((z, i) => (
            <div key={z.zone} className="flex items-center gap-3 px-4 py-2.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500',
              )}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-800">{z.zone}</span>
                  <span className={cn('text-[9px] font-bold', scoreColor(z.on_time_rate))}>{z.on_time_rate}%</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <BarMini value={z.orders} max={data.zones[0].orders} color="bg-rose-400" />
                  <span className="text-[9px] text-stone-400">{z.orders} Bestellungen</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-black text-stone-800">{z.revenue_eur} €</div>
                <div className="text-[9px] text-stone-400">{z.avg_time_min} Min Ø</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drivers Leaderboard */}
      {tab === 'drivers' && (
        <div className="divide-y divide-stone-50 max-h-56 overflow-y-auto">
          {data.drivers.map((d, i) => (
            <div key={d.name} className="flex items-center gap-3 px-4 py-2.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                i === 0 ? 'bg-amber-100 text-amber-700' :
                i === 1 ? 'bg-stone-200 text-stone-600' :
                i === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-stone-100 text-stone-400',
              )}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800">{d.name}</span>
                  <span className={cn('text-[9px] font-black', scoreColor(d.score))}>{d.score}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <BarMini value={d.score} max={100} color={d.score >= 90 ? 'bg-matcha-500' : d.score >= 75 ? 'bg-amber-400' : 'bg-red-400'} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-black text-stone-800">{d.earnings_eur.toFixed(2)} €</div>
                <div className="text-[9px] text-stone-400">{d.deliveries} Lieferungen · {d.avg_time_min} Min</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-stone-100 bg-stone-50">
        <Activity className="w-3 h-3 text-rose-400" />
        <span className="text-[10px] text-stone-500">
          {data.total_orders} Bestellungen heute · Ø {data.avg_delivery_time.toFixed(0)} Min · Peak {data.peak_hour}:00 Uhr
        </span>
      </div>
    </div>
  );
}
