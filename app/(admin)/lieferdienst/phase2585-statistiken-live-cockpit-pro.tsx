'use client';

/**
 * Phase 2585 — Statistiken Live Cockpit Pro
 * 10 KPI-Kacheln Ampel-Farbkodierung + Trend vs. Vortag
 * + Stundenverlauf-Chart 2-Modi (Bestellungen/Umsatz)
 * + Zonen-Top-5 + Fahrer-Top-3 + Alert-Strip
 * Polling: 3 Min.
 */

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Users, ShoppingBag, Euro, Clock, Star, MapPin, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  key: string;
  label: string;
  value: string;
  unit: string;
  trend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface HourSlot {
  hour: string;
  orders: number;
  revenue: number;
}

interface Zone {
  name: string;
  orders: number;
}

interface TopDriver {
  name: string;
  score: number;
  tours: number;
}

interface Stats {
  kpis: KPI[];
  stundenverlauf: HourSlot[];
  zonen: Zone[];
  top_fahrer: TopDriver[];
  alerts: string[];
}

const MOCK_STATS: Stats = {
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen heute', value: '47', unit: '', trend: 12, ampel: 'gruen' },
    { key: 'umsatz', label: 'Umsatz heute', value: '1.284', unit: '€', trend: 8, ampel: 'gruen' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', value: '28', unit: 'min', trend: -3, ampel: 'gruen' },
    { key: 'ontime', label: 'On-Time-Rate', value: '87', unit: '%', trend: 2, ampel: 'gruen' },
    { key: 'storno', label: 'Storno-Rate', value: '4.2', unit: '%', trend: 1, ampel: 'gelb' },
    { key: 'bewertung', label: 'Ø Bewertung', value: '4.6', unit: '★', trend: 0, ampel: 'gruen' },
    { key: 'fahrer', label: 'Aktive Fahrer', value: '5', unit: '', trend: 0, ampel: 'gruen' },
    { key: 'touren', label: 'Touren gesamt', value: '38', unit: '', trend: 15, ampel: 'gruen' },
    { key: 'wartezeit', label: 'Ø Wartezeit Abholung', value: '3.8', unit: 'min', trend: -1, ampel: 'gelb' },
    { key: 'km', label: 'Ø km/Tour', value: '5.2', unit: 'km', trend: -2, ampel: 'gruen' },
  ],
  stundenverlauf: [
    { hour: '10', orders: 3, revenue: 78 },
    { hour: '11', orders: 5, revenue: 134 },
    { hour: '12', orders: 12, revenue: 318 },
    { hour: '13', orders: 9, revenue: 243 },
    { hour: '14', orders: 6, revenue: 162 },
    { hour: '15', orders: 4, revenue: 108 },
    { hour: '16', orders: 5, revenue: 135 },
    { hour: '17', orders: 3, revenue: 106 },
  ],
  zonen: [
    { name: 'Mitte', orders: 18 },
    { name: 'Nord', orders: 12 },
    { name: 'Süd', orders: 9 },
    { name: 'West', orders: 5 },
    { name: 'Ost', orders: 3 },
  ],
  top_fahrer: [
    { name: 'Max M.', score: 92, tours: 10 },
    { name: 'Sara K.', score: 85, tours: 8 },
    { name: 'Tom B.', score: 78, tours: 7 },
  ],
  alerts: ['Storno-Rate >4% — Ursachenanalyse empfohlen'],
};

interface Props {
  locationId?: string | null;
}

export function LieferdienstPhase2585StatistikLiveCockpitPro({ locationId }: Props) {
  const [stats, setStats] = useState<Stats>(MOCK_STATS);
  const [chartMode, setChartMode] = useState<'orders' | 'revenue'>('orders');

  useEffect(() => {
    async function load() {
      if (!locationId) { setStats(MOCK_STATS); return; }
      try {
        const res = await fetch(`/api/delivery/stats?location_id=${locationId}&period=today`);
        if (res.ok) {
          const json = await res.json();
          if (json?.kpis?.length) setStats(json as Stats);
        }
      } catch {}
    }
    load();
    const poll = setInterval(load, 3 * 60_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const ampelBg: Record<string, string> = {
    gruen: 'bg-green-500/10 border-green-500/20',
    gelb: 'bg-yellow-500/10 border-yellow-500/20',
    rot: 'bg-red-500/10 border-red-500/20',
  };
  const ampelText: Record<string, string> = {
    gruen: 'text-green-400',
    gelb: 'text-yellow-400',
    rot: 'text-red-400',
  };

  const chartData = stats.stundenverlauf.map(h => ({
    hour: `${h.hour}h`,
    value: chartMode === 'orders' ? h.orders : h.revenue,
  }));

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Statistiken Live Cockpit Pro</span>
        </div>
        <span className="text-xs text-white/30">Polling 3 Min.</span>
      </div>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="space-y-1">
          {stats.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI-Grid 2x5 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.kpis.map(kpi => {
          const TrendIcon = kpi.trend > 0 ? TrendingUp : kpi.trend < 0 ? TrendingDown : Minus;
          const trendColor = kpi.trend > 0 ? 'text-green-400' : kpi.trend < 0 ? 'text-red-400' : 'text-white/30';
          return (
            <div key={kpi.key} className={cn('rounded-lg border p-2.5 space-y-1', ampelBg[kpi.ampel])}>
              <div className="text-xs text-white/50 leading-tight">{kpi.label}</div>
              <div className={cn('text-lg font-bold', ampelText[kpi.ampel])}>
                {kpi.value}<span className="text-xs font-normal text-white/40 ml-0.5">{kpi.unit}</span>
              </div>
              <div className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                {kpi.trend > 0 ? '+' : ''}{kpi.trend}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/70">Stundenverlauf</span>
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
            <button
              onClick={() => setChartMode('orders')}
              className={cn('px-2 py-0.5', chartMode === 'orders' ? 'bg-blue-500/30 text-blue-300' : 'text-white/40')}
            >
              Bestellungen
            </button>
            <button
              onClick={() => setChartMode('revenue')}
              className={cn('px-2 py-0.5', chartMode === 'revenue' ? 'bg-blue-500/30 text-blue-300' : 'text-white/40')}
            >
              Umsatz
            </button>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#3b82f6' : 'rgba(59,130,246,0.4)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Zonen + Top-Fahrer */}
      <div className="grid grid-cols-2 gap-3">
        {/* Zonen-Top-5 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
            <MapPin className="h-3 w-3 text-purple-400" />Zonen-Top-5
          </div>
          {stats.zonen.slice(0, 5).map((z, i) => (
            <div key={z.name} className="flex items-center gap-2">
              <span className="text-xs text-white/30 w-4">#{i + 1}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500/60 rounded-full"
                  style={{ width: `${(z.orders / stats.zonen[0].orders) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/60 w-16 truncate">{z.name}</span>
              <span className="text-xs font-medium text-white">{z.orders}</span>
            </div>
          ))}
        </div>

        {/* Top-3 Fahrer */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Bike className="h-3 w-3 text-orange-400" />Top-3 Fahrer
          </div>
          {stats.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-xs text-white/30 w-4">#{i + 1}</span>
              <span className="text-xs text-white/80 flex-1 truncate">{f.name}</span>
              <span className={cn('text-xs font-bold', f.score >= 80 ? 'text-green-400' : 'text-yellow-400')}>{f.score}</span>
              <span className="text-xs text-white/40">{f.tours} Touren</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
