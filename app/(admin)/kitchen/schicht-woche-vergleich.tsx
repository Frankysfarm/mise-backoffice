'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KpiRow = {
  label: string;
  thisWeek: number | null;
  lastWeek: number | null;
  unit: string;
  higherIsBetter: boolean;
};

type AnalyticsDashboard = {
  slaRate?: number;
  avgDeliveryMin?: number;
  deliveryRate?: number;
  cancellationRate?: number;
  comparison?: {
    slaRateLastWeek?: number;
    avgDeliveryMinLastWeek?: number;
    deliveryRateLastWeek?: number;
  };
};

function deltaPct(now: number | null, prev: number | null): number | null {
  if (now == null || prev == null || prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function TrendPill({ now, prev, higherIsBetter }: { now: number | null; prev: number | null; higherIsBetter: boolean }) {
  const d = deltaPct(now, prev);
  if (d == null) return <span className="text-[10px] text-stone-400">—</span>;
  const positive = higherIsBetter ? d > 0 : d < 0;
  const neutral = Math.abs(d) < 1;
  if (neutral) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-stone-500">
      <Minus className="h-3 w-3" />0%
    </span>
  );
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold',
      positive ? 'text-matcha-600' : 'text-red-500',
    )}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}

export function KitchenSchichtWocheVergleich({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      try {
        const url = `/api/delivery/admin/analytics?action=dashboard${locationId ? `&location_id=${encodeURIComponent(locationId)}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* noop */ }
    }

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) return null;

  const rows: KpiRow[] = [
    {
      label: 'SLA-Rate',
      thisWeek: data.slaRate ?? null,
      lastWeek: data.comparison?.slaRateLastWeek ?? null,
      unit: '%',
      higherIsBetter: true,
    },
    {
      label: 'Ø Lieferzeit',
      thisWeek: data.avgDeliveryMin ?? null,
      lastWeek: data.comparison?.avgDeliveryMinLastWeek ?? null,
      unit: ' min',
      higherIsBetter: false,
    },
    {
      label: 'Lieferrate',
      thisWeek: data.deliveryRate ?? null,
      lastWeek: null,
      unit: '%',
      higherIsBetter: true,
    },
  ].filter(r => r.thisWeek != null);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Wochenvergleich Küche</span>
        <span className="ml-auto text-[10px] text-stone-400">Diese Woche vs. Vorwoche</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-stone-100">
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-3 text-center">
            <div className="text-[10px] font-semibold text-stone-500 mb-1">{row.label}</div>
            <div className="text-lg font-black tabular-nums text-stone-800">
              {row.thisWeek != null ? `${row.thisWeek.toFixed(1)}${row.unit}` : '—'}
            </div>
            <div className="mt-1">
              <TrendPill now={row.thisWeek} prev={row.lastWeek} higherIsBetter={row.higherIsBetter} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
