'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  typ: string;
}

interface Props {
  orders: Order[];
  completedToday: number | null;
  shiftStartHour?: number;
}

export function KitchenSchichtBurndown({ orders, completedToday, shiftStartHour = 10 }: Props) {
  const now = new Date();
  const currentHour = now.getHours();
  const shiftEndHour = 23;
  const totalShiftHours = shiftEndHour - shiftStartHour;

  const data = useMemo(() => {
    const buckets: Record<number, { completed: number; incoming: number }> = {};

    // Count orders by hour of completion
    for (const o of orders) {
      const fertigAt = o.fertig_am ? new Date(o.fertig_am) : null;
      const bestelltAt = o.bestellt_am ? new Date(o.bestellt_am) : null;

      if (fertigAt) {
        const h = fertigAt.getHours();
        if (!buckets[h]) buckets[h] = { completed: 0, incoming: 0 };
        buckets[h].completed++;
      }
      if (bestelltAt) {
        const h = bestelltAt.getHours();
        if (!buckets[h]) buckets[h] = { completed: 0, incoming: 0 };
        buckets[h].incoming++;
      }
    }

    const result = [];
    for (let h = shiftStartHour; h <= Math.min(currentHour + 1, shiftEndHour); h++) {
      result.push({
        hour: h,
        label: `${h}:00`,
        completed: buckets[h]?.completed ?? 0,
        incoming: buckets[h]?.incoming ?? 0,
        isCurrent: h === currentHour,
        isFuture: h > currentHour,
      });
    }
    return result;
  }, [orders, currentHour, shiftStartHour]);

  const totalCompleted = completedToday ?? data.reduce((s, d) => s + d.completed, 0);
  const totalIncoming = data.reduce((s, d) => s + d.incoming, 0);

  // Estimate target per hour based on shift pace
  const hoursElapsed = Math.max(1, currentHour - shiftStartHour);
  const pacePerHour = totalCompleted / hoursElapsed;
  const projectedEnd = Math.round(pacePerHour * totalShiftHours);

  // "on track" threshold: at least 5 orders/hour
  const targetPerHour = 5;
  const isOnTrack = pacePerHour >= targetPerHour;
  const isBehind = pacePerHour < targetPerHour * 0.7;

  const trendIcon = isBehind ? TrendingDown : isOnTrack ? TrendingUp : Minus;
  const TrendIcon = trendIcon;
  const trendColor = isBehind ? 'text-red-600' : isOnTrack ? 'text-matcha-600' : 'text-amber-600';
  const trendBg = isBehind ? 'bg-red-50 border-red-200' : isOnTrack ? 'bg-matcha-50 border-matcha-200' : 'bg-amber-50 border-amber-200';
  const trendLabel = isBehind ? 'Rückstand' : isOnTrack ? 'Im Plan' : 'Knapp';

  if (data.length < 2) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider">Schicht-Burndown</span>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', trendBg)}>
          <TrendIcon className={cn('h-3 w-3', trendColor)} />
          <span className={trendColor}>{trendLabel}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-4 py-3 text-center">
          <div className="text-xl font-black tabular-nums text-foreground">{totalCompleted}</div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Abgeschlossen</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-xl font-black tabular-nums text-amber-600">{pacePerHour.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">pro Stunde</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-xl font-black tabular-nums text-blue-600">~{projectedEnd}</div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Prognose Schicht</div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-3">
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={12}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(val: number, name: string) => [val, name === 'completed' ? 'Fertig' : 'Eingegangen']}
            />
            <ReferenceLine y={targetPerHour} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
            <Bar dataKey="completed" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isCurrent
                      ? '#6d9a3d'
                      : entry.completed >= targetPerHour
                      ? '#86b856'
                      : entry.completed > 0
                      ? '#f59e0b'
                      : '#e5e7eb'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-matcha-500" />
            <span className="text-[9px] text-muted-foreground">Abgeschlossen</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 bg-emerald-400" style={{ borderTop: '2px dashed #10b981' }} />
            <span className="text-[9px] text-muted-foreground">Ziel ({targetPerHour}/h)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
