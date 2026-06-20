'use client';

/**
 * DispatchUmsatzPacePanel — Phase 313
 *
 * Zeigt dem Dispatcher den aktuellen Umsatz-Pace (Revenue Velocity)
 * im Kontext der aktiven Touren: Bestellungen/Stunde, Lieferanteil, Prognose.
 * Polling 60 s auf /api/delivery/admin/revenue-velocity
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Gauge, RefreshCw, ShoppingBag, Truck } from 'lucide-react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
  deliveryShare: number;
  paceLabel: 'ahead' | 'on_track' | 'behind' | 'no_data';
  comparison: Comparison[];
}

function euroFmt(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const PACE_STYLE = {
  ahead:    'text-matcha-700 bg-matcha-50 border-matcha-300',
  on_track: 'text-amber-700 bg-amber-50 border-amber-300',
  behind:   'text-red-700 bg-red-50 border-red-300',
  no_data:  'text-gray-500 bg-gray-50 border-gray-200',
};

const PACE_LABEL = {
  ahead: 'Über Plan', on_track: 'Im Plan', behind: 'Unter Plan', no_data: 'Keine Daten',
};

export function DispatchUmsatzPacePanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch60 = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/revenue-velocity?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch60();
    timer.current = setInterval(fetch60, 60_000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || !data) return null;

  const paceStyle = PACE_STYLE[data.paceLabel];
  const paceLabel = PACE_LABEL[data.paceLabel];
  const delta = data.revenueDeltaPct;
  const ordDelta = data.ordersDeltaPct;

  const lineData = data.comparison.slice(-10).map((c) => ({
    h: `${c.hour}h`,
    heute: c.today,
    gestern: c.yesterday,
  }));

  const maxVal = Math.max(...data.comparison.map((c) => Math.max(c.today ?? 0, c.yesterday ?? 0)), 1);

  return (
    <div className="bg-white rounded-xl border shadow-sm px-4 py-3 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-matcha-500" />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Umsatz-Pace
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${paceStyle}`}>
            {paceLabel}
          </span>
        </div>
        <button onClick={fetch60} disabled={loading} className="text-gray-400 hover:text-matcha-500 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <ShoppingBag className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">Bestellungen</span>
          </div>
          <div className="text-base font-black text-gray-900 tabular-nums">{data.todayOrders}</div>
          {ordDelta !== null && (
            <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-0.5 ${ordDelta >= 0 ? 'text-matcha-600' : 'text-red-600'}`}>
              {ordDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {ordDelta >= 0 ? '+' : ''}{ordDelta.toFixed(1)}% vs. Gestern
            </div>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Truck className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">Lieferanteil</span>
          </div>
          <div className="text-base font-black text-gray-900 tabular-nums">
            {data.deliveryShare.toFixed(0)}%
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">aller Bestellungen</div>
        </div>
      </div>

      {/* Revenue Row */}
      <div className="flex items-center justify-between mb-3 bg-matcha-50 rounded-lg px-3 py-2">
        <div>
          <div className="text-[10px] text-gray-500 mb-0.5">Umsatz Heute</div>
          <div className="text-lg font-black text-matcha-700 tabular-nums">{euroFmt(data.todayRevenue)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 mb-0.5">Prognose</div>
          <div className="text-base font-bold text-gray-700 tabular-nums">
            {data.shiftProjection ? euroFmt(data.shiftProjection) : '—'}
          </div>
        </div>
        {delta !== null && (
          <div className={`text-center text-[11px] font-bold px-2 py-1 rounded ${delta >= 0 ? 'text-matcha-700 bg-matcha-100' : 'text-red-700 bg-red-100'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%<br />
            <span className="text-[9px] font-normal">vs. Gestern</span>
          </div>
        )}
      </div>

      {/* Trend Line */}
      {lineData.length > 1 && (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 9, padding: '2px 6px' }}
                formatter={(v: number | null, name: string) => [v ? euroFmt(v) : '—', name === 'heute' ? 'Heute' : 'Gestern']}
              />
              <ReferenceLine y={maxVal * 0.8} stroke="#e5e7eb" strokeDasharray="3 3" />
              <Line dataKey="gestern" stroke="#d1d5db" strokeWidth={1.5} dot={false} />
              <Line dataKey="heute" stroke="#4f9c6a" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
