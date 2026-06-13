'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingDown, TrendingUp, Minus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type VelocityData = {
  currentHourCount: number;
  lastHourCount: number;
  yesterdayCount: number;
  ordersPerHourRate: number;
};

export function SchichtVelocity({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [data, setData] = useState<VelocityData | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0);

      const lastHourStart = new Date(currentHourStart);
      lastHourStart.setHours(lastHourStart.getHours() - 1);

      const yesterdayHourStart = new Date(currentHourStart);
      yesterdayHourStart.setDate(yesterdayHourStart.getDate() - 1);
      const yesterdayHourEnd = new Date(yesterdayHourStart);
      yesterdayHourEnd.setHours(yesterdayHourEnd.getHours() + 1);

      const DONE_STATUSES = ['in_zubereitung', 'fertig', 'unterwegs', 'geliefert', 'abgeholt', 'abgeschlossen'];

      const buildQuery = (from: Date, to?: Date) => {
        let q = supabase
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', DONE_STATUSES)
          .gte('bestellt_am', from.toISOString());
        if (to) q = q.lt('bestellt_am', to.toISOString());
        if (locationId) q = q.eq('location_id', locationId);
        return q;
      };

      const [{ count: curCount }, { count: lastCount }, { count: yestCount }] = await Promise.all([
        buildQuery(currentHourStart),
        buildQuery(lastHourStart, currentHourStart),
        buildQuery(yesterdayHourStart, yesterdayHourEnd),
      ]);

      const elapsedHours = Math.max(1 / 60, (now.getTime() - currentHourStart.getTime()) / 3_600_000);
      const ordersPerHourRate = Math.round((curCount ?? 0) / elapsedHours);

      setData({
        currentHourCount: curCount ?? 0,
        lastHourCount: lastCount ?? 0,
        yesterdayCount: yestCount ?? 0,
        ordersPerHourRate,
      });
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;
  if (data.currentHourCount === 0 && data.lastHourCount === 0) return null;

  const trendLast =
    data.lastHourCount > 0
      ? Math.round(((data.currentHourCount - data.lastHourCount) / data.lastHourCount) * 100)
      : data.currentHourCount > 0
      ? 100
      : 0;

  const trendYest =
    data.yesterdayCount > 0
      ? Math.round(((data.currentHourCount - data.yesterdayCount) / data.yesterdayCount) * 100)
      : null;

  const TrendIcon = trendLast > 10 ? TrendingUp : trendLast < -10 ? TrendingDown : Minus;
  const trendCls =
    trendLast > 10 ? 'text-matcha-600' : trendLast < -10 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Schicht-Tempo
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Orders per hour */}
        <div className="flex flex-col items-center">
          <div className="font-display font-black text-3xl tabular-nums leading-none">
            {data.ordersPerHourRate}
          </div>
          <div className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide text-center">
            Orders/h jetzt
          </div>
        </div>

        {/* Trend vs last hour */}
        <div className="flex flex-col items-center">
          <div className={cn('flex items-center gap-0.5 font-display font-black text-xl tabular-nums leading-none', trendCls)}>
            <TrendIcon className="h-3.5 w-3.5 shrink-0" />
            {trendLast >= 0 ? '+' : ''}{trendLast}%
          </div>
          <div className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide text-center">
            vs. letzte Std
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
            {data.lastHourCount}→{data.currentHourCount}
          </div>
        </div>

        {/* Trend vs yesterday */}
        {trendYest !== null ? (
          <div className="flex flex-col items-center">
            <div className={cn(
              'font-display font-black text-xl tabular-nums leading-none',
              trendYest > 10 ? 'text-matcha-600' : trendYest < -10 ? 'text-amber-600' : 'text-muted-foreground',
            )}>
              {trendYest >= 0 ? '+' : ''}{trendYest}%
            </div>
            <div className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide text-center">
              vs. gestern
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
              gestern: {data.yesterdayCount}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="text-[9px] text-muted-foreground text-center">
              Kein Vortag-Vergleich
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
