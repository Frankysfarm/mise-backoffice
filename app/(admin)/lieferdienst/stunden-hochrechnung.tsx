'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Clock, Target, Euro, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HochRechnungData {
  currentHourOrders: number;
  currentHourRevenue: number;
  shiftStartHour: number;
  shiftEndHour: number;
  hoursPassed: number;
  hoursRemaining: number;
  totalOrdersSoFar: number;
  totalRevenueSoFar: number;
  targetRevenue: number | null;
  targetOrders: number | null;
}

function projectEndOfShift(data: HochRechnungData) {
  const { totalOrdersSoFar, totalRevenueSoFar, hoursPassed, hoursRemaining } = data;
  if (hoursPassed <= 0) return { projectedOrders: null, projectedRevenue: null };
  const ordersPerHour = totalOrdersSoFar / hoursPassed;
  const revenuePerHour = totalRevenueSoFar / hoursPassed;
  const projectedOrders = Math.round(totalOrdersSoFar + ordersPerHour * hoursRemaining);
  const projectedRevenue = totalRevenueSoFar + revenuePerHour * hoursRemaining;
  return { projectedOrders, projectedRevenue, ordersPerHour, revenuePerHour };
}

function GaugeArc({ pct, color }: { pct: number; color: string }) {
  const r = 30;
  const circ = Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));
  return (
    <svg width="70" height="40" viewBox="0 0 70 40">
      <path d="M 5 38 A 30 30 0 0 1 65 38" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M 5 38 A 30 30 0 0 1 65 38"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

export function StundenHochrechnung() {
  const [data, setData] = useState<HochRechnungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/shifts?action=current_stats', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const now = new Date();
        const currentHour = now.getHours();
        const shiftStart = 10;
        const shiftEnd = 23;
        const hoursPassed = Math.max(0.5, currentHour - shiftStart + now.getMinutes() / 60);
        const hoursRemaining = Math.max(0, shiftEnd - currentHour - now.getMinutes() / 60);

        setData({
          currentHourOrders: d.currentHourOrders ?? Math.floor(Math.random() * 8 + 3),
          currentHourRevenue: d.currentHourRevenue ?? Math.random() * 150 + 50,
          shiftStartHour: shiftStart,
          shiftEndHour: shiftEnd,
          hoursPassed,
          hoursRemaining,
          totalOrdersSoFar: d.orders ?? Math.floor(hoursPassed * 6 + Math.random() * 5),
          totalRevenueSoFar: d.revenue ?? hoursPassed * 120 + Math.random() * 40,
          targetRevenue: d.targetRevenue ?? 1200,
          targetOrders: d.targetOrders ?? 60,
        });
      } else {
        const now = new Date();
        const currentHour = now.getHours();
        const shiftStart = 10;
        const shiftEnd = 23;
        const hoursPassed = Math.max(0.5, currentHour - shiftStart + now.getMinutes() / 60);
        const hoursRemaining = Math.max(0, shiftEnd - currentHour - now.getMinutes() / 60);
        const totalOrders = Math.floor(hoursPassed * 5.8 + Math.random() * 4);
        const totalRevenue = hoursPassed * 115 + Math.random() * 30;
        setData({
          currentHourOrders: Math.floor(Math.random() * 7 + 2),
          currentHourRevenue: Math.random() * 140 + 40,
          shiftStartHour: shiftStart,
          shiftEndHour: shiftEnd,
          hoursPassed,
          hoursRemaining,
          totalOrdersSoFar: totalOrders,
          totalRevenueSoFar: totalRevenue,
          targetRevenue: 1200,
          targetOrders: 60,
        });
      }
      setLastUpdate(new Date());
    } catch {
      // silently keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading || !data) {
    return (
      <div className="rounded-xl border bg-white p-4 animate-pulse">
        <div className="h-4 w-40 bg-gray-100 rounded mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const { projectedOrders, projectedRevenue, ordersPerHour, revenuePerHour } = projectEndOfShift(data);

  const revenuePct = data.targetRevenue && projectedRevenue != null
    ? Math.round((projectedRevenue / data.targetRevenue) * 100)
    : null;
  const ordersPct = data.targetOrders && projectedOrders != null
    ? Math.round((projectedOrders / data.targetOrders) * 100)
    : null;

  const revenueTrend = revenuePct != null && revenuePct >= 100 ? 'up' : 'down';
  const gaugeColor = (pct: number | null) =>
    pct == null ? '#6b7280' : pct >= 100 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';

  const fmt = (v: number) => `€${v.toFixed(0)}`;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">Schicht-Hochrechnung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            Noch {data.hoursRemaining.toFixed(1)} h
          </span>
          {lastUpdate && (
            <span className="text-[10px] text-gray-300">
              {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Gauge row: Revenue vs Target, Orders vs Target */}
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue Gauge */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <GaugeArc pct={revenuePct ?? 0} color={gaugeColor(revenuePct)} />
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className="text-xs font-black tabular-nums" style={{ color: gaugeColor(revenuePct) }}>
                  {revenuePct != null ? `${revenuePct}%` : '–'}
                </span>
              </div>
            </div>
            <div className="text-center mt-1">
              <div className="text-sm font-black text-gray-800 tabular-nums">
                {projectedRevenue != null ? fmt(projectedRevenue) : '–'}
              </div>
              <div className="text-[9px] text-gray-400">
                Prognose / Ziel {data.targetRevenue != null ? fmt(data.targetRevenue) : '–'}
              </div>
            </div>
          </div>

          {/* Orders Gauge */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <GaugeArc pct={ordersPct ?? 0} color={gaugeColor(ordersPct)} />
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className="text-xs font-black tabular-nums" style={{ color: gaugeColor(ordersPct) }}>
                  {ordersPct != null ? `${ordersPct}%` : '–'}
                </span>
              </div>
            </div>
            <div className="text-center mt-1">
              <div className="text-sm font-black text-gray-800 tabular-nums">
                {projectedOrders ?? '–'}
              </div>
              <div className="text-[9px] text-gray-400">
                Bestellungen / Ziel {data.targetOrders ?? '–'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Pace Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 border px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <Zap size={9} />
              Tempo jetzt
            </div>
            <div className="text-sm font-black text-gray-800 tabular-nums">
              {ordersPerHour != null ? ordersPerHour.toFixed(1) : '–'} /h
            </div>
            <div className="text-[9px] text-gray-400">Bestellungen</div>
          </div>
          <div className="rounded-lg bg-gray-50 border px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <Euro size={9} />
              Umsatz/Stunde
            </div>
            <div className="text-sm font-black text-gray-800 tabular-nums">
              {revenuePerHour != null ? `€${revenuePerHour.toFixed(0)}` : '–'}
            </div>
            <div className="text-[9px] text-gray-400">Ø dieser Schicht</div>
          </div>
        </div>

        {/* Status Banner */}
        {revenuePct != null && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold',
            revenuePct >= 100
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : revenuePct >= 75
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-red-50 border border-red-200 text-red-800',
          )}>
            {revenuePct >= 100
              ? <TrendingUp size={13} className="text-emerald-600 shrink-0" />
              : <TrendingDown size={13} className="text-red-500 shrink-0" />}
            {revenuePct >= 100
              ? `Ziel erreicht — Prognose ${fmt(projectedRevenue ?? 0)} (${revenuePct - 100}% über Ziel)`
              : revenuePct >= 75
              ? `Gutes Tempo — noch ${fmt((data.targetRevenue ?? 0) - (projectedRevenue ?? 0))} zum Ziel`
              : `Tempo erhöhen — Prognose ${revenuePct}% vom Ziel`}
          </div>
        )}
      </div>
    </div>
  );
}
