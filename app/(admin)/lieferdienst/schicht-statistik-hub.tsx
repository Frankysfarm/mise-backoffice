'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, Package, Clock, Bike,
  Euro, Target, Star, Zap, RefreshCw, Loader2, Activity,
} from 'lucide-react';
import { euro } from '@/lib/utils';

interface ShiftKpi {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  activeDrivers: number;
  pendingOrders: number;
  avgRating: number | null;
  tipsTotal: number;
}

interface Trend {
  dir: 'up' | 'down' | 'flat';
  pct: number;
}

interface Props {
  locationId: string;
}

function trendIcon(t: Trend | null, inverse = false) {
  if (!t) return null;
  const isGood = (t.dir === 'up' && !inverse) || (t.dir === 'down' && inverse);
  if (t.dir === 'flat') return <Minus size={11} className="text-stone-400" />;
  return t.dir === 'up'
    ? <TrendingUp size={11} className={isGood ? 'text-matcha-500' : 'text-red-500'} />
    : <TrendingDown size={11} className={isGood ? 'text-matcha-500' : 'text-red-500'} />;
}

function KpiKachel({
  label, value, sub, icon: Icon, trend, accent = false, inverse = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: Trend | null;
  accent?: boolean;
  inverse?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3 flex flex-col gap-1',
      accent ? 'bg-matcha-600 border-matcha-500 text-white' : 'bg-white border-stone-200',
    )}>
      <div className="flex items-center justify-between">
        <Icon size={14} className={accent ? 'text-white/70' : 'text-matcha-600'} />
        {trend && (
          <div className="flex items-center gap-0.5">
            {trendIcon(trend, inverse)}
            <span className={cn(
              'text-[9px] font-bold',
              trend.dir === 'flat' ? 'text-stone-400'
                : (trend.dir === 'up' && !inverse) || (trend.dir === 'down' && inverse)
                  ? (accent ? 'text-white/80' : 'text-matcha-600')
                  : (accent ? 'text-red-300' : 'text-red-500'),
            )}>
              {trend.pct > 0 ? '+' : ''}{trend.pct}%
            </span>
          </div>
        )}
      </div>
      <div className={cn('text-xl font-black leading-none', accent ? 'text-white' : 'text-stone-800')}>{value}</div>
      <div className={cn('text-[10px] font-bold', accent ? 'text-white/70' : 'text-stone-500')}>{label}</div>
      {sub && <div className={cn('text-[9px]', accent ? 'text-white/50' : 'text-stone-400')}>{sub}</div>}
    </div>
  );
}

export function SchichtStatistikHub({ locationId }: Props) {
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/stats?location_id=${locationId}&period=shift`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setKpi({
          revenue:        d.revenue        ?? d.total_revenue   ?? 0,
          orders:         d.orders         ?? d.order_count     ?? 0,
          avgOrderValue:  d.avgOrderValue  ?? d.avg_order_value ?? 0,
          deliveries:     d.deliveries     ?? d.delivery_count  ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? d.avg_delivery_min ?? 0,
          onTimeRatePct:  d.onTimeRatePct  ?? d.on_time_rate    ?? 0,
          activeDrivers:  d.activeDrivers  ?? d.active_drivers  ?? 0,
          pendingOrders:  d.pendingOrders  ?? d.pending_orders  ?? 0,
          avgRating:      d.avgRating      ?? d.avg_rating      ?? null,
          tipsTotal:      d.tipsTotal      ?? d.tips_total      ?? 0,
        });
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-black uppercase tracking-wider text-stone-800">
            Schicht-Statistik Hub
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-stone-400">
              {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg p-1.5 hover:bg-stone-100 transition disabled:opacity-50"
            title="Aktualisieren"
          >
            {loading ? <Loader2 size={13} className="animate-spin text-stone-400" /> : <RefreshCw size={13} className="text-stone-400" />}
          </button>
        </div>
      </div>

      {/* KPI-Raster */}
      <div className="p-3">
        {loading && !kpi && (
          <div className="flex items-center justify-center py-8 text-stone-400 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Statistiken…
          </div>
        )}

        {kpi && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KpiKachel
              label="Umsatz (Schicht)"
              value={euro(kpi.revenue)}
              icon={Euro}
              accent
            />
            <KpiKachel
              label="Bestellungen"
              value={String(kpi.orders)}
              sub={kpi.pendingOrders > 0 ? `${kpi.pendingOrders} ausstehend` : undefined}
              icon={Package}
            />
            <KpiKachel
              label="Ø Lieferzeit"
              value={`${Math.round(kpi.avgDeliveryMin)} Min`}
              sub={kpi.onTimeRatePct > 0 ? `${Math.round(kpi.onTimeRatePct)}% pünktlich` : undefined}
              icon={Clock}
              inverse
            />
            <KpiKachel
              label="Aktive Fahrer"
              value={String(kpi.activeDrivers)}
              sub={kpi.deliveries > 0 ? `${kpi.deliveries} Lieferungen` : undefined}
              icon={Bike}
            />
            <KpiKachel
              label="Ø Bestellwert"
              value={euro(kpi.avgOrderValue)}
              icon={Target}
            />
            {kpi.avgRating != null ? (
              <KpiKachel
                label="Kundenbewertung"
                value={kpi.avgRating.toFixed(1)}
                sub="Ø dieser Schicht"
                icon={Star}
              />
            ) : kpi.tipsTotal > 0 ? (
              <KpiKachel
                label="Trinkgeld gesamt"
                value={euro(kpi.tipsTotal)}
                icon={Zap}
              />
            ) : null}
          </div>
        )}

        {/* On-Time-Balken */}
        {kpi && kpi.onTimeRatePct > 0 && (
          <div className="mt-3 rounded-xl bg-white border border-stone-100 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Pünktlichkeitsrate</span>
              <span className={cn(
                'text-xs font-black',
                kpi.onTimeRatePct >= 90 ? 'text-matcha-600'
                : kpi.onTimeRatePct >= 75 ? 'text-amber-500'
                : 'text-red-500',
              )}>
                {Math.round(kpi.onTimeRatePct)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  kpi.onTimeRatePct >= 90 ? 'bg-matcha-500'
                  : kpi.onTimeRatePct >= 75 ? 'bg-amber-400'
                  : 'bg-red-400',
                )}
                style={{ width: `${Math.min(100, kpi.onTimeRatePct)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
