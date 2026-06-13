'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, CheckCircle2, Clock, Flame, TrendingUp, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ShiftPerf {
  ordersPerHour: number;
  avgPrepMin: number;
  onTimePct: number;
  completedLast30min: number;
  trend: 'up' | 'flat' | 'down';
}

function useShiftPerf(locationId?: string | null): ShiftPerf | null {
  const supabase = createClient();
  const [data, setData] = useState<ShiftPerf | null>(null);

  useEffect(() => {
    const load = async () => {
      const shiftStart = new Date();
      shiftStart.setHours(shiftStart.getHours() >= 11 ? 11 : 0, 0, 0, 0);
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
      const sixtyMinAgo = new Date(Date.now() - 60 * 60_000);

      let q = supabase.from('customer_orders')
        .select('bestellt_am, fertig_am')
        .in('status', ['fertig', 'unterwegs', 'geliefert', 'abgeholt'])
        .gte('bestellt_am', shiftStart.toISOString())
        .not('fertig_am', 'is', null);
      if (locationId) q = q.eq('location_id', locationId);

      const { data: orders } = await q;
      if (!orders) return;

      const rows = orders as { bestellt_am: string | null; fertig_am: string | null }[];
      const shiftMinutes = Math.max(1, (Date.now() - shiftStart.getTime()) / 60_000);
      const ordersPerHour = (rows.length / shiftMinutes) * 60;

      const prepTimes = rows
        .filter((o) => o.bestellt_am && o.fertig_am)
        .map((o) => (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);

      const avgPrepMin = prepTimes.length > 0
        ? prepTimes.reduce((s, v) => s + v, 0) / prepTimes.length
        : 0;

      const onTimeCount = prepTimes.filter((t) => t <= 20).length;
      const onTimePct = prepTimes.length > 0 ? (onTimeCount / prepTimes.length) * 100 : 100;

      const completedLast30min = rows.filter(
        (o) => o.fertig_am && new Date(o.fertig_am) >= thirtyMinAgo
      ).length;

      // Trend: compare last-30min rate to prior 30min (30–60 min ago)
      const prevWindow = rows.filter(
        (o) => o.fertig_am && new Date(o.fertig_am) >= sixtyMinAgo && new Date(o.fertig_am) < thirtyMinAgo
      ).length;
      const trend: 'up' | 'flat' | 'down' =
        completedLast30min > prevWindow + 1 ? 'up'
        : completedLast30min < prevWindow - 1 ? 'down'
        : 'flat';

      setData({
        ordersPerHour: Math.round(ordersPerHour * 10) / 10,
        avgPrepMin: Math.round(avgPrepMin),
        onTimePct: Math.round(onTimePct),
        completedLast30min,
        trend,
      });
    };

    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}

export function KitchenShiftPerformanceBadge({ locationId }: { locationId?: string | null }) {
  const perf = useShiftPerf(locationId);
  if (!perf) return null;

  const onTimeColor =
    perf.onTimePct >= 85 ? 'text-matcha-700'
    : perf.onTimePct >= 68 ? 'text-amber-700'
    : 'text-red-600';

  const avgPrepColor =
    perf.avgPrepMin <= 16 ? 'text-matcha-700'
    : perf.avgPrepMin <= 23 ? 'text-amber-700'
    : 'text-red-600';

  const trendIcon =
    perf.trend === 'up' ? '↑'
    : perf.trend === 'down' ? '↓'
    : '→';
  const trendColor =
    perf.trend === 'up' ? 'text-matcha-600'
    : perf.trend === 'down' ? 'text-red-500'
    : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap rounded-xl border border-matcha-200 bg-gradient-to-r from-matcha-50 to-white px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-matcha-600 shrink-0">
        <Activity className="h-3.5 w-3.5" />
        <span className="text-[10px] font-black uppercase tracking-wider">Schicht-Tempo</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Orders per hour */}
      <div className="flex items-center gap-1" title="Bestellungen pro Stunde (Schichtdurchschnitt)">
        <Zap className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="font-black tabular-nums">{perf.ordersPerHour.toFixed(1)}</span>
        <span className="text-[9px] text-muted-foreground">/h</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Avg prep time */}
      <div className="flex items-center gap-1" title="Durchschnittliche Zubereitungszeit heute">
        <Clock className="h-3 w-3 text-blue-500 shrink-0" />
        <span className={cn('font-black tabular-nums', avgPrepColor)}>{perf.avgPrepMin}</span>
        <span className="text-[9px] text-muted-foreground">Min Ø</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* On-time rate */}
      <div className="flex items-center gap-1" title="Anteil pünktlicher Bestellungen (≤20 Min)">
        <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
        <span className={cn('font-black tabular-nums', onTimeColor)}>{perf.onTimePct}%</span>
        <span className="text-[9px] text-muted-foreground">pünktlich</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Last 30 min throughput + trend */}
      <div className="flex items-center gap-1" title="Abgeschlossene Bestellungen in letzten 30 Minuten">
        <Flame className="h-3 w-3 text-orange-500 shrink-0" />
        <span className="font-black tabular-nums">{perf.completedLast30min}</span>
        <span className="text-[9px] text-muted-foreground">letzten 30 Min</span>
        <span className={cn('text-[10px] font-black ml-0.5', trendColor)}>{trendIcon}</span>
      </div>

      {perf.onTimePct >= 92 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-matcha-500 shrink-0" />
            <span className="text-[9px] font-bold text-matcha-600">Spitzenleistung!</span>
          </div>
        </>
      )}
    </div>
  );
}
