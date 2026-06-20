'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicPricingConfig {
  isEnabled:          boolean;
  multiplierNormal:   number;
  multiplierSurgeLow: number;
  offPeakEnabled:     boolean;
  offPeakDiscountPct: number;
}

interface TodayStats {
  eventsToday:     number;
  surgeEvents:     number;
  offPeakEvents:   number;
  avgMultiplier:   number | null;
  extraRevenueEur: number;
}

interface DashboardRes {
  config:    DynamicPricingConfig;
  todayStats: TodayStats;
}

export function KitchenPreisSignalStreifen({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardRes | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing?action=dashboard');
      if (res.ok) setData(await res.json() as DashboardRes);
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!data?.config.isEnabled) return null;

  const { config, todayStats } = data;
  const hasSurge      = todayStats.surgeEvents > 0;
  const hasOffPeak    = todayStats.offPeakEvents > 0;
  const avgMult       = todayStats.avgMultiplier;
  const extraRevenue  = todayStats.extraRevenueEur;

  const statusColor =
    hasSurge && avgMult && avgMult >= 1.5 ? 'bg-red-50 border-red-200 text-red-800' :
    hasSurge                               ? 'bg-amber-50 border-amber-200 text-amber-800' :
    hasOffPeak                             ? 'bg-violet-50 border-violet-200 text-violet-800' :
    'bg-stone-50 border-stone-200 text-stone-600';

  const Icon = hasSurge ? TrendingUp : hasOffPeak ? TrendingDown : Minus;

  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm', statusColor)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex gap-4 flex-wrap">
        {hasSurge && (
          <span>
            <span className="font-semibold">Surge aktiv</span>
            {avgMult && <span className="ml-1 opacity-80">×{avgMult.toFixed(2)} Ø</span>}
            {extraRevenue > 0 && (
              <span className="ml-1 opacity-70">
                (+€{extraRevenue.toFixed(2)} Mehreinnahmen heute)
              </span>
            )}
          </span>
        )}
        {hasOffPeak && (
          <span>
            <span className="font-semibold">Off-Peak-Rabatt</span>
            <span className="ml-1 opacity-80">
              -{config.offPeakDiscountPct.toFixed(0)}% · {todayStats.offPeakEvents} Rabatt-Events
            </span>
          </span>
        )}
        {!hasSurge && !hasOffPeak && (
          <span>Dynamic Pricing aktiv · Normaltarif</span>
        )}
      </div>
    </div>
  );
}
