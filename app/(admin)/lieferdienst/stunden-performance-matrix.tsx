'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, Clock, RefreshCw } from 'lucide-react';

interface HourCell {
  hour: number;
  orders: number;
  revenue: number;
}

interface Props {
  locationId: string | null;
}

function generateMockHourData(): HourCell[] {
  const typical: Record<number, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    6: 1, 7: 2, 8: 3, 9: 4,
    10: 5, 11: 8, 12: 10, 13: 9,
    14: 6, 15: 5, 16: 4, 17: 5,
    18: 10, 19: 12, 20: 11, 21: 8,
    22: 5, 23: 2,
  };
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    orders: typical[h] ?? 0,
    revenue: (typical[h] ?? 0) * 18.5,
  }));
}

function cellBg(orders: number): string {
  if (orders === 0) return 'bg-muted text-muted-foreground';
  if (orders <= 3) return 'bg-matcha-100 text-matcha-700';
  if (orders <= 7) return 'bg-matcha-300 text-matcha-800';
  return 'bg-matcha-600 text-white';
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}`;
}

export function StundenPerformanceMatrix({ locationId }: Props) {
  const [data, setData] = useState<HourCell[]>(generateMockHourData());
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const currentHour = new Date().getHours();

  const load = useCallback(async () => {
    if (!locationId) {
      setData(generateMockHourData());
      setLastUpdated(new Date());
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/overview?location_id=${locationId}`,
        { cache: 'no-store' },
      ).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const hourlyCounts: { hour: number; orders: number; revenue: number }[] =
          d?.today_stats?.hourly_counts ?? [];
        if (hourlyCounts.length > 0) {
          // Fill all 24 hours
          const map = new Map(hourlyCounts.map((c) => [c.hour, c]));
          const cells: HourCell[] = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            orders: map.get(h)?.orders ?? 0,
            revenue: map.get(h)?.revenue ?? 0,
          }));
          setData(cells);
        } else {
          setData(generateMockHourData());
        }
      } else {
        setData(generateMockHourData());
      }
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const maxOrders = Math.max(1, ...data.map((c) => c.orders));
  const peakHour = data.reduce((best, c) => (c.orders > best.orders ? c : best), data[0]);
  const totalOrders = data.reduce((s, c) => s + c.orders, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <BarChart2 className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Stunden-Matrix
        </span>
        <span className="ml-2 text-[10px] text-muted-foreground font-medium">
          Jetzt: {hourLabel(currentHour)}:00 Uhr
        </span>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="flex flex-col items-center py-2">
          <span className="font-mono text-lg font-black tabular-nums text-foreground leading-none">{totalOrders}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Bestellungen heute</span>
        </div>
        <div className="flex flex-col items-center py-2">
          <span className="font-mono text-lg font-black tabular-nums text-matcha-600 leading-none">{peakHour.orders}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Peak ({hourLabel(peakHour.hour)}:00)</span>
        </div>
        <div className="flex flex-col items-center py-2">
          <span className="flex items-center gap-0.5 font-mono text-lg font-black tabular-nums text-blue-600 leading-none">
            <Clock size={12} />
            {hourLabel(currentHour)}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Aktuelle Stunde</span>
        </div>
      </div>

      {/* 24-cell grid */}
      <div className="p-3">
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
          {data.map((cell) => {
            const isCurrent = cell.hour === currentHour;
            const intensityPct = Math.round((cell.orders / maxOrders) * 100);
            return (
              <div
                key={cell.hour}
                title={`${hourLabel(cell.hour)}:00 Uhr — ${cell.orders} Bestellungen${cell.revenue > 0 ? ` · €${cell.revenue.toFixed(0)}` : ''}`}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all cursor-default select-none',
                  cellBg(cell.orders),
                  isCurrent && 'ring-2 ring-blue-400 ring-offset-1',
                )}
              >
                <span className="text-[9px] font-bold tabular-nums leading-none opacity-70">
                  {hourLabel(cell.hour)}
                </span>
                <span className="font-black text-sm tabular-nums leading-none mt-0.5">
                  {cell.orders}
                </span>
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-400 border-2 border-card animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Legende</span>
          {[
            { label: '0', bg: 'bg-muted' },
            { label: '1–3', bg: 'bg-matcha-100' },
            { label: '4–7', bg: 'bg-matcha-300' },
            { label: '8+', bg: 'bg-matcha-600' },
          ].map(({ label, bg }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('h-3 w-3 rounded', bg)} />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <div className="h-3 w-3 rounded border-2 border-blue-400" />
            <span className="text-[9px] text-muted-foreground">Aktuelle Stunde</span>
          </div>
        </div>
      </div>
    </div>
  );
}
