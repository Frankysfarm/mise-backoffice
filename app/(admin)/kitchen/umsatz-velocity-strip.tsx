'use client';

/**
 * KitchenUmsatzVelocityStrip — Phase 313
 *
 * Zeigt der Küche den aktuellen stündlichen Umsatz-Tempo (Velocity)
 * inkl. Heute-vs-Gestern-Vergleich und Pace-Label.
 * Polling alle 60 s auf /api/delivery/admin/revenue-velocity
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw, Euro } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Comparison {
  hour: number;
  today: number | null;
  yesterday: number | null;
}

interface VelocityData {
  todayRevenue: number;
  todayOrders: number;
  currentVelocity: number | null;
  peakVelocity: number | null;
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;
  shiftProjection: number | null;
  paceLabel: 'ahead' | 'on_track' | 'behind' | 'no_data';
  comparison: Comparison[];
}

const PACE_CONFIG = {
  ahead:    { label: 'Über Plan',    color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200' },
  on_track: { label: 'Im Plan',      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  behind:   { label: 'Unter Plan',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  no_data:  { label: 'Keine Daten',  color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
};

function euro(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function deltaBadge(pct: number | null) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-matcha-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export function KitchenUmsatzVelocityStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/revenue-velocity?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || !data) return null;

  const pace = PACE_CONFIG[data.paceLabel];
  const chartData = data.comparison.slice(-8).map((c) => ({
    h: `${c.hour}h`,
    heute: c.today ?? 0,
    gestern: c.yesterday ?? 0,
  }));

  return (
    <div className={`rounded-xl border px-4 py-3 ${pace.bg} w-full`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Umsatz-Velocity
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${pace.bg} ${pace.color}`}>
            {pace.label}
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/70 rounded-lg px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Heute</div>
          <div className="text-sm font-black text-gray-900 tabular-nums">{euro(data.todayRevenue)}</div>
          <div className="mt-0.5">{deltaBadge(data.revenueDeltaPct)}</div>
        </div>
        <div className="bg-white/70 rounded-lg px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Aktuelle Stunde</div>
          <div className="text-sm font-black text-gray-900 tabular-nums">
            {data.currentVelocity !== null ? euro(data.currentVelocity) : '—'}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">/ Stunde</div>
        </div>
        <div className="bg-white/70 rounded-lg px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Prognose</div>
          <div className="text-sm font-black text-gray-900 tabular-nums">
            {data.shiftProjection !== null ? euro(data.shiftProjection) : '—'}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Schicht-Ende</div>
        </div>
      </div>

      {/* Sparkline Chart */}
      {chartData.length > 0 && (
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
              <XAxis dataKey="h" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                formatter={(v: number, name: string) => [euro(v), name === 'heute' ? 'Heute' : 'Gestern']}
                labelStyle={{ fontWeight: 600, fontSize: 10 }}
              />
              <Bar dataKey="gestern" fill="#e5e7eb" radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="heute" radius={[2, 2, 0, 0]} maxBarSize={10}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#4f9c6a' : '#86c9a0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-matcha-400" />
          <span className="text-[9px] text-gray-400">Heute</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="text-[9px] text-gray-400">Gestern</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Euro className="w-2.5 h-2.5 text-gray-300" />
          <span className="text-[9px] text-gray-400 tabular-nums">
            Peak {data.peakVelocity !== null ? euro(data.peakVelocity) : '—'}/h
          </span>
        </div>
      </div>
    </div>
  );
}
