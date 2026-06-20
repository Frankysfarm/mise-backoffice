'use client';

import { useEffect, useState, useCallback } from 'react';
import { Percent, TrendingUp, TrendingDown, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayStats {
  eventsToday:      number;
  surgeEvents:      number;
  offPeakEvents:    number;
  avgMultiplier:    number | null;
  extraRevenueEur:  number;
  discountGivenEur: number;
}

interface DashboardRes {
  config:     { isEnabled: boolean };
  todayStats: TodayStats;
}

export function LieferdienstPricingKompakt({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DashboardRes | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing?action=dashboard');
      if (res.ok) setData(await res.json() as DashboardRes);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!data?.config.isEnabled) return null;

  const s = data.todayStats;
  const netImpact = Math.round((s.extraRevenueEur - s.discountGivenEur) * 100) / 100;
  const avgMult = s.avgMultiplier;

  const netColor = netImpact >= 0 ? 'text-emerald-700' : 'text-red-600';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-char">Dynamic Pricing — Heute</span>
        {avgMult && (
          <span className={cn(
            'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold',
            avgMult >= 1.5 ? 'bg-red-50 text-red-700' :
            avgMult >= 1.2 ? 'bg-amber-50 text-amber-700' :
            'bg-stone-100 text-stone-600',
          )}>
            Ø ×{avgMult.toFixed(2)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          <div>
            <p className="text-[10px] text-steel uppercase tracking-wide">Surge-Events</p>
            <p className="text-base font-bold text-char">{s.surgeEvents}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-violet-500" />
          <div>
            <p className="text-[10px] text-steel uppercase tracking-wide">Off-Peak</p>
            <p className="text-base font-bold text-char">{s.offPeakEvents}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Euro className="h-3.5 w-3.5 text-blue-500" />
          <div>
            <p className="text-[10px] text-steel uppercase tracking-wide">Surge-Mehreinnahmen</p>
            <p className="text-base font-bold text-char">€{s.extraRevenueEur.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Euro className="h-3.5 w-3.5 text-emerald-500" />
          <div>
            <p className="text-[10px] text-steel uppercase tracking-wide">Netto-Impact</p>
            <p className={cn('text-base font-bold', netColor)}>
              {netImpact >= 0 ? '+' : ''}{netImpact.toFixed(2)} €
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
