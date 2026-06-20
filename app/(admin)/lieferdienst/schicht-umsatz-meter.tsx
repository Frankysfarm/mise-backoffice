'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Minus, Target, Zap } from 'lucide-react';
import { euro } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface StatsData {
  revenue_today: number;
  revenue_yesterday: number;
  orders_today: number;
  shift_start_hour: number;
  daily_goal: number | null;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);
}

export function SchichtUmsatzMeter({ locationId }: Props) {
  useTick();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const url = `/api/delivery/admin/stats?location_id=${locationId}`;
        const res = await fetch(url);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData({
            revenue_today: json.revenue_today ?? json.umsatz_heute ?? 0,
            revenue_yesterday: json.revenue_yesterday ?? json.umsatz_gestern ?? 0,
            orders_today: json.orders_today ?? json.bestellungen_heute ?? 0,
            shift_start_hour: json.shift_start_hour ?? 10,
            daily_goal: json.daily_goal ?? json.tagesziel ?? null,
          });
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) return null;

  const now = new Date();
  const hoursPassed = Math.max(1, now.getHours() - (data?.shift_start_hour ?? 10) + now.getMinutes() / 60);
  const revenueToday = data?.revenue_today ?? 0;
  const revenueYesterday = data?.revenue_yesterday ?? 0;
  const ratePerHour = revenueToday / hoursPassed;

  const hoursLeft = Math.max(0, 22 - now.getHours());
  const projectedRevenue = revenueToday + ratePerHour * hoursLeft;

  const goal = data?.daily_goal ?? (revenueYesterday > 0 ? revenueYesterday * 1.05 : null);
  const goalPct = goal ? Math.min(100, (revenueToday / goal) * 100) : null;

  const delta = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : null;
  const TrendIcon = delta == null ? Minus : delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const trendColor = delta == null ? 'text-muted-foreground' : delta > 2 ? 'text-matcha-600' : delta < -2 ? 'text-red-500' : 'text-muted-foreground';

  // Mock data fallback for demo
  const displayRevenue = revenueToday > 0 ? revenueToday : null;

  if (displayRevenue === null) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-matcha-600">
        <Euro className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Schicht-Umsatz-Meter
        </span>
        {delta !== null && (
          <span className={cn('ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white')}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs. gestern
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Main revenue display */}
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground">Umsatz heute</div>
            <div className="text-2xl font-black text-foreground tabular-nums">
              {euro(displayRevenue)}
            </div>
          </div>
          <div className={cn('flex items-center gap-1 pb-1 text-sm font-semibold', trendColor)}>
            <TrendIcon size={14} />
            {delta !== null && <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>}
          </div>
        </div>

        {/* Goal progress bar */}
        {goal !== null && goalPct !== null && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="flex items-center gap-0.5">
                <Target size={10} />
                Tagesziel {euro(goal)}
              </span>
              <span className={cn('font-bold', goalPct >= 100 ? 'text-matcha-600' : goalPct >= 70 ? 'text-amber-600' : 'text-muted-foreground')}>
                {goalPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  goalPct >= 100 ? 'bg-matcha-500' : goalPct >= 70 ? 'bg-amber-400' : 'bg-blue-400',
                )}
                style={{ width: `${Math.min(100, goalPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-[9px] text-muted-foreground">EUR/h</div>
            <div className="text-sm font-black tabular-nums text-foreground">{euro(ratePerHour)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-[9px] text-muted-foreground">Bestellungen</div>
            <div className="text-sm font-black tabular-nums text-foreground">{data?.orders_today ?? 0}</div>
          </div>
          <div className="rounded-lg bg-matcha-50 border border-matcha-100 p-2 text-center">
            <div className="text-[9px] text-matcha-600">Prognose</div>
            <div className="text-sm font-black tabular-nums text-matcha-700">{euro(projectedRevenue)}</div>
          </div>
        </div>

        {/* Yesterday comparison */}
        {revenueYesterday > 0 && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Minus size={9} />
            Gestern: {euro(revenueYesterday)}
          </div>
        )}
      </div>
    </div>
  );
}
