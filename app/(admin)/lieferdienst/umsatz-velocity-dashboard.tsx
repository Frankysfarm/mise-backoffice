'use client';

/**
 * UmsatzVelocityDashboard — Phase 313
 *
 * Vollständiges Revenue-Velocity-Dashboard für den Lieferdienst-Manager:
 * - Live-KPIs (Heute-Umsatz, Velocity, Prognose, Lieferanteil)
 * - Vergleichsdiagramm Heute vs. Gestern vs. Vorwoche
 * - Pace-Ampel mit Handlungsempfehlung
 * Polling 60 s auf /api/delivery/admin/revenue-velocity
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, BarChart2, RefreshCw, Euro, ShoppingBag,
  Truck, Zap, Clock, Target,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface Comparison {
  hour: number;
  today: number | null;
  yesterday: number | null;
  lastWeek: number | null;
}

interface RevenueVelocityDashboard {
  todayRevenue: number;
  todayOrders: number;
  avgOrderValue: number | null;
  currentVelocity: number | null;
  peakVelocity: number | null;
  deliveryShare: number;
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;
  shiftProjection: number | null;
  paceLabel: 'ahead' | 'on_track' | 'behind' | 'no_data';
  comparison: Comparison[];
}

function euroFmt(v: number | null) {
  if (v === null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <Minus className="w-3.5 h-3.5 text-gray-400" />;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-matcha-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

const PACE_STYLES = {
  ahead:    { border: 'border-matcha-400', bg: 'bg-matcha-50', text: 'text-matcha-700', label: 'Über Plan 🚀', tip: 'Excellent! Schicht liegt vorn.' },
  on_track: { border: 'border-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Im Plan ✓',   tip: 'Solide. Tempo halten.' },
  behind:   { border: 'border-red-400',    bg: 'bg-red-50',    text: 'text-red-700',    label: 'Unter Plan ⚠', tip: 'Aufholen! Aktionen prüfen.' },
  no_data:  { border: 'border-gray-300',   bg: 'bg-gray-50',   text: 'text-gray-500',   label: 'Kein Signal',  tip: 'Daten werden geladen...' },
};

function KpiCard({
  icon: Icon, label, value, sub, delta,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; delta?: number | null;
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-xl font-black text-gray-900 tabular-nums">{value}</div>
      <div className="flex items-center gap-2 mt-0.5">
        {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
        {delta !== undefined && <DeltaBadge pct={delta} />}
      </div>
    </div>
  );
}

export function UmsatzVelocityDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<RevenueVelocityDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/revenue-velocity?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(fetchData, 60_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetchData]);

  if (!locationId) return null;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Lade Revenue Velocity…
      </div>
    );
  }

  const pace = PACE_STYLES[data.paceLabel];

  const chartData = data.comparison
    .filter((c) => c.today !== null || c.yesterday !== null)
    .map((c) => ({
      h: `${c.hour}h`,
      Heute: c.today ?? 0,
      Gestern: c.yesterday ?? 0,
      Vorwoche: c.lastWeek ?? 0,
    }));

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${pace.border} ${pace.bg}`}>
        <div className="flex items-center gap-2">
          <BarChart2 className={`w-4 h-4 ${pace.text}`} />
          <span className={`text-sm font-bold ${pace.text}`}>{pace.label}</span>
          <span className="text-[11px] text-gray-500 ml-1">{pace.tip}</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-gray-400">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchData} disabled={loading} className={`${pace.text} hover:opacity-70 transition-opacity disabled:opacity-40`}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={Euro}
          label="Umsatz Heute"
          value={euroFmt(data.todayRevenue)}
          sub="vs. Gestern"
          delta={data.revenueDeltaPct}
        />
        <KpiCard
          icon={ShoppingBag}
          label="Bestellungen"
          value={String(data.todayOrders)}
          sub="vs. Gestern"
          delta={data.ordersDeltaPct}
        />
        <KpiCard
          icon={Zap}
          label="Akt. Velocity"
          value={euroFmt(data.currentVelocity)}
          sub="€/Stunde"
        />
        <KpiCard
          icon={Target}
          label="Prognose"
          value={euroFmt(data.shiftProjection)}
          sub="Schicht-Ende"
        />
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={Clock}
          label="Spitzenvelocity"
          value={euroFmt(data.peakVelocity)}
          sub="€/Stunde (heute)"
        />
        <KpiCard
          icon={Truck}
          label="Lieferanteil"
          value={`${data.deliveryShare.toFixed(0)}%`}
          sub={data.avgOrderValue ? `Ø ${euroFmt(data.avgOrderValue)} / Bestellung` : undefined}
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
              Umsatz je Stunde
            </span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorHeute" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f9c6a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f9c6a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="h" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 100) * 100}`}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                  formatter={(v: unknown, name: unknown) => [euroFmt(v as number), name as string]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                  iconType="circle"
                  iconSize={6}
                />
                <Area dataKey="Vorwoche" type="monotone" stroke="#d1d5db" strokeWidth={1} fill="none" dot={false} />
                <Area dataKey="Gestern" type="monotone" stroke="#94a3b8" strokeWidth={1.5} fill="none" dot={false} />
                <Area
                  dataKey="Heute"
                  type="monotone"
                  stroke="#4f9c6a"
                  strokeWidth={2.5}
                  fill="url(#colorHeute)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
