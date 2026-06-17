'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Euro, Bike, Clock, Target, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle, Star, Zap, RefreshCw,
} from 'lucide-react';

interface ShiftBilanz {
  revenue: number;
  orders: number;
  deliveries: number;
  activeDrivers: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  avgOrderValue: number;
  pendingOrders: number;
  cancelledOrders: number;
  topZone: string | null;
  peakHour: number | null;
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function TrendIcon({ value, inverse = false }: { value: number; inverse?: boolean }) {
  if (value === 0) return <Minus size={12} className="text-gray-400" />;
  const up = value > 0;
  const good = inverse ? !up : up;
  if (good) return <TrendingUp size={12} className="text-emerald-500" />;
  return <TrendingDown size={12} className="text-red-500" />;
}

function KpiCard({
  label, value, sub, icon: Icon, accent, trend,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ElementType; accent?: string; trend?: number; inverse?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl p-3.5 border shadow-sm ${accent ? `border-l-4 ${accent}` : 'border-stone-200'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={11} className="text-stone-400 shrink-0" />}
        <span className="text-[11px] text-stone-500 leading-tight">{label}</span>
        {trend != null && <TrendIcon value={trend} />}
      </div>
      <div className="text-xl font-black text-stone-900 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SlaBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-[11px] text-stone-500 text-right shrink-0">{label}</div>
      <div className="flex-1 h-4 rounded-full bg-stone-100 overflow-hidden relative">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-stone-700">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

const MOCK_DATA: ShiftBilanz = {
  revenue: 1240.50,
  orders: 48,
  deliveries: 44,
  activeDrivers: 5,
  avgDeliveryMin: 27,
  onTimeRatePct: 82,
  avgOrderValue: 25.85,
  pendingOrders: 4,
  cancelledOrders: 2,
  topZone: 'Mitte',
  peakHour: 19,
};

export function SchichtEchtzeitBilanz({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<ShiftBilanz | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      if (locationId) {
        const res = await fetch(
          `/api/delivery/admin/stats?location_id=${encodeURIComponent(locationId)}&period=today`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const d = await res.json();
          if (d && typeof d.revenue === 'number') {
            setData({
              revenue: d.revenue ?? 0,
              orders: d.orders ?? 0,
              deliveries: d.deliveries ?? d.orders ?? 0,
              activeDrivers: d.activeDrivers ?? 0,
              avgDeliveryMin: d.avgDeliveryMin ?? 0,
              onTimeRatePct: d.onTimeRatePct ?? 0,
              avgOrderValue: d.avgOrderValue ?? (d.orders > 0 ? d.revenue / d.orders : 0),
              pendingOrders: d.pendingOrders ?? 0,
              cancelledOrders: d.cancelledOrders ?? 0,
              topZone: d.topZone ?? null,
              peakHour: d.peakHour ?? null,
            });
            setLastUpdated(new Date());
            return;
          }
        }
      }
      // Fallback: mock data
      setData(MOCK_DATA);
      setLastUpdated(new Date());
    } catch {
      setData(MOCK_DATA);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const onTimePct = data.onTimeRatePct;
  const onTimeColor = onTimePct >= 85 ? 'bg-emerald-500' : onTimePct >= 70 ? 'bg-amber-400' : 'bg-red-500';
  const onTimeLabel = onTimePct >= 85 ? 'Sehr gut' : onTimePct >= 70 ? 'Ok' : 'Verbesserung nötig';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100">
        <Zap size={14} className="text-amber-500 shrink-0" />
        <span className="text-sm font-bold text-stone-800">Schicht-Echtzeit-Bilanz</span>
        {lastUpdated && (
          <span className="ml-auto text-[10px] text-stone-400">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={load}
          className="text-stone-400 hover:text-stone-600 transition"
          title="Aktualisieren"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            label="Umsatz heute"
            value={fmtEur(data.revenue)}
            icon={Euro}
            accent="border-emerald-500"
          />
          <KpiCard
            label="Bestellungen"
            value={String(data.orders)}
            sub={`${data.pendingOrders} ausstehend`}
            icon={Target}
            accent="border-blue-500"
          />
          <KpiCard
            label="Lieferungen"
            value={String(data.deliveries)}
            sub={data.cancelledOrders > 0 ? `${data.cancelledOrders} storniert` : undefined}
            icon={Bike}
            accent="border-matcha-500"
          />
          <KpiCard
            label="Ø Bestellwert"
            value={fmtEur(data.avgOrderValue)}
            icon={TrendingUp}
            accent="border-purple-500"
          />
          <KpiCard
            label="Ø Lieferzeit"
            value={`${data.avgDeliveryMin} Min`}
            sub={data.avgDeliveryMin <= 30 ? 'Im Ziel' : 'Über Ziel'}
            icon={Clock}
            accent={data.avgDeliveryMin <= 30 ? 'border-emerald-500' : 'border-amber-500'}
          />
          <KpiCard
            label="Aktive Fahrer"
            value={String(data.activeDrivers)}
            icon={Bike}
            accent="border-stone-400"
          />
        </div>

        {/* Pünktlichkeits-Ampel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Pünktlichkeitsrate</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${onTimeColor}`}>
              {onTimeLabel}
            </span>
          </div>
          <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${onTimeColor}`}
              style={{ width: `${onTimePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-stone-400">0%</span>
            <span className="text-[11px] font-black text-stone-700 tabular-nums">{Math.round(onTimePct)}%</span>
            <span className="text-[10px] text-stone-400">100%</span>
          </div>
        </div>

        {/* Extra insights */}
        {(data.topZone || data.peakHour != null) && (
          <div className="grid grid-cols-2 gap-2">
            {data.topZone && (
              <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Top-Zone</div>
                <div className="font-bold text-stone-800">{data.topZone}</div>
              </div>
            )}
            {data.peakHour != null && (
              <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Stoßzeit</div>
                <div className="font-bold text-stone-800">{data.peakHour}:00 Uhr</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
