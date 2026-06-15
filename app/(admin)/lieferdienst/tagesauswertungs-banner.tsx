'use client';

/**
 * TagesauswertungsBanner — Phase 201
 * Tagesabschluss-Banner: erscheint ab 20:00 Uhr mit automatischer
 * Zusammenfassung der Schicht (Umsatz, Lieferungen, Ø Zeit, Pünktlichkeit).
 * Zeigt Vergleich zu gestern und eine motivierende Bewertung.
 */

import { useEffect, useState } from 'react';
import { Award, Star, TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayStats {
  revenue: number;
  orders: number;
  deliveries: number;
  avgDeliveryMin: number | null;
  slaRate: number | null;
  yesterdayRevenue: number | null;
  yesterdayOrders: number | null;
}

interface Props {
  locationId: string;
}

function getTagesRating(stats: DayStats): { emoji: string; label: string; color: string } {
  const score =
    (stats.slaRate != null ? (stats.slaRate >= 90 ? 2 : stats.slaRate >= 75 ? 1 : 0) : 1) +
    (stats.avgDeliveryMin != null ? (stats.avgDeliveryMin <= 25 ? 2 : stats.avgDeliveryMin <= 35 ? 1 : 0) : 1) +
    (stats.orders >= 20 ? 2 : stats.orders >= 10 ? 1 : 0);

  if (score >= 5) return { emoji: '🏆', label: 'Ausgezeichneter Tag!', color: 'text-amber-700' };
  if (score >= 3) return { emoji: '⭐', label: 'Guter Tag!', color: 'text-emerald-700' };
  return { emoji: '📈', label: 'Solider Tag', color: 'text-blue-700' };
}

export function TagesauswertungsBanner({ locationId }: Props) {
  const [stats, setStats] = useState<DayStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentHour = new Date().getHours();
  const showAfterHour = currentHour >= 20;

  useEffect(() => {
    if (!showAfterHour) { setLoading(false); return; }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      fetch(`/api/delivery/admin/reporting?type=daily&location_id=${locationId}`).then((r) => r.json()),
    ])
      .then(([report]) => {
        const today = report?.today ?? report?.data ?? report;
        if (!today) return;
        setStats({
          revenue:         Number(today.revenue_eur ?? today.revenueEur ?? 0),
          orders:          Number(today.total_orders ?? today.totalOrders ?? 0),
          deliveries:      Number(today.delivered ?? today.deliveries ?? 0),
          avgDeliveryMin:  today.avg_delivery_min ?? today.avgDeliveryMin ?? null,
          slaRate:         today.sla_rate ?? today.slaRate ?? null,
          yesterdayRevenue: today.yesterday_revenue_eur ?? today.yesterdayRevenueEur ?? null,
          yesterdayOrders:  today.yesterday_orders ?? today.yesterdayOrders ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, showAfterHour]);

  // Don't render before 20:00, if dismissed, or while loading without data
  if (!showAfterHour || dismissed || (loading && !stats)) return null;
  if (!loading && !stats) return null;

  const rating = stats ? getTagesRating(stats) : null;
  const revenueGrowth =
    stats?.yesterdayRevenue && stats.yesterdayRevenue > 0
      ? ((stats.revenue - stats.yesterdayRevenue) / stats.yesterdayRevenue) * 100
      : null;
  const ordersGrowth =
    stats?.yesterdayOrders && stats.yesterdayOrders > 0
      ? ((stats.orders - stats.yesterdayOrders) / stats.yesterdayOrders) * 100
      : null;

  return (
    <div className="relative rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 p-5 overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute right-4 top-2 text-6xl opacity-10 select-none">
        {rating?.emoji ?? '📊'}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 hover:bg-amber-100 hover:text-zinc-600 transition"
      >
        <X size={12} />
      </button>

      <div className="mb-3 flex items-center gap-2">
        <Award size={16} className="text-amber-600" />
        <span className="text-sm font-black text-amber-800">Tagesauswertung</span>
        {rating && (
          <span className={cn('text-sm font-bold', rating.color)}>
            {rating.emoji} {rating.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-20 animate-pulse rounded-xl bg-amber-100" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Revenue */}
          <div className="rounded-xl bg-white/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Umsatz</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-zinc-800">
              {stats.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </div>
            {revenueGrowth !== null && (
              <div className={cn('flex items-center gap-0.5 text-[10px] font-bold mt-0.5', revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {revenueGrowth >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {revenueGrowth >= 0 ? '+' : ''}{Math.round(revenueGrowth)}% vs. gestern
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="rounded-xl bg-white/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Bestellungen</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-zinc-800">{stats.orders}</div>
            {ordersGrowth !== null && (
              <div className={cn('flex items-center gap-0.5 text-[10px] font-bold mt-0.5', ordersGrowth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {ordersGrowth >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {ordersGrowth >= 0 ? '+' : ''}{Math.round(ordersGrowth)}% vs. gestern
              </div>
            )}
          </div>

          {/* Avg delivery time */}
          <div className="rounded-xl bg-white/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Ø Lieferzeit</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-zinc-800">
              {stats.avgDeliveryMin !== null ? `${Math.round(stats.avgDeliveryMin)} Min` : '—'}
            </div>
            {stats.avgDeliveryMin !== null && (
              <div className={cn('text-[10px] font-bold mt-0.5', stats.avgDeliveryMin <= 25 ? 'text-emerald-600' : stats.avgDeliveryMin <= 35 ? 'text-amber-600' : 'text-red-500')}>
                {stats.avgDeliveryMin <= 25 ? '🚀 Sehr schnell' : stats.avgDeliveryMin <= 35 ? '✓ Im Ziel' : '⚠ Langsam'}
              </div>
            )}
          </div>

          {/* SLA rate */}
          <div className="rounded-xl bg-white/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Pünktlichkeit</div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="text-xl font-black tabular-nums text-zinc-800">
                {stats.slaRate !== null ? `${Math.round(stats.slaRate)}%` : '—'}
              </span>
              {stats.slaRate !== null && stats.slaRate >= 90 && (
                <Star size={14} className="fill-amber-400 text-amber-400" />
              )}
            </div>
            {stats.slaRate !== null && (
              <div className={cn('text-[10px] font-bold mt-0.5', stats.slaRate >= 90 ? 'text-emerald-600' : stats.slaRate >= 75 ? 'text-amber-600' : 'text-red-500')}>
                {stats.slaRate >= 90 ? '🎯 Ziel erreicht' : stats.slaRate >= 75 ? '~ Knapp verfehlt' : '✗ Unter Ziel'}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
