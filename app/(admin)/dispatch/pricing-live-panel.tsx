'use client';

import { useEffect, useState, useCallback } from 'react';
import { Percent, TrendingUp, Euro, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayStats {
  eventsToday:      number;
  surgeEvents:      number;
  offPeakEvents:    number;
  avgMultiplier:    number | null;
  extraRevenueEur:  number;
  discountGivenEur: number;
}

interface Config {
  isEnabled:           boolean;
  customerBannerEnabled: boolean;
}

interface DashboardRes {
  config:     Config;
  todayStats: TodayStats;
}

function StatCell({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('p-1.5 rounded-lg', color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[10px] text-stone-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-char leading-none">{value}</p>
      </div>
    </div>
  );
}

export function DispatchPricingLivePanel({ locationId }: { locationId: string | null }) {
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
    const iv = setInterval(() => void load(), 90_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!data?.config.isEnabled) return null;

  const { todayStats } = data;
  const avgMult = todayStats.avgMultiplier;

  const multColor =
    avgMult && avgMult >= 1.5 ? 'text-red-600 bg-red-50' :
    avgMult && avgMult >= 1.2 ? 'text-amber-600 bg-amber-50' :
    'text-emerald-700 bg-emerald-50';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-char">Dynamic Pricing</span>
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', multColor)}>
          {avgMult != null ? `×${avgMult.toFixed(2)} Ø heute` : 'Kein Surge'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCell
          label="Events"
          value={String(todayStats.eventsToday)}
          icon={Percent}
          color="bg-stone-100 text-stone-500"
        />
        <StatCell
          label="Surge"
          value={String(todayStats.surgeEvents)}
          icon={TrendingUp}
          color="bg-amber-100 text-amber-600"
        />
        <StatCell
          label="Mehrumsatz"
          value={`€${todayStats.extraRevenueEur.toFixed(2)}`}
          icon={Euro}
          color="bg-blue-100 text-blue-600"
        />
        <StatCell
          label="Off-Peak"
          value={String(todayStats.offPeakEvents)}
          icon={Clock}
          color="bg-violet-100 text-violet-600"
        />
      </div>
    </div>
  );
}
