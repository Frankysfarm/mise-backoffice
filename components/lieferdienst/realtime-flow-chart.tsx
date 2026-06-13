'use client';

/**
 * RealtimeFlowChart
 *
 * Echtzeit-Bestellfluss für das Lieferdienst-Statistik-Dashboard.
 * Zeigt Bestellungen pro Stunde (heute) als Balkendiagramm.
 * Hebt die aktuelle Stunde hervor.
 * Aktualisiert sich alle 30s.
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Order } from '@/lib/lieferdienst/orders';

interface Props {
  orders: Order[];
  completedOrders: Order[];
}

type HourBucket = {
  label: string;
  h: number;
  count: number;
  completed: number;
  revenue: number;
  isCurrent: boolean;
};

function buildHourlyData(
  orders: Order[],
  completedOrders: Order[],
): HourBucket[] {
  const now = new Date();
  const currentH = now.getHours();

  const allOrders = [...orders, ...completedOrders];

  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    h,
    label: `${String(h).padStart(2, '0')}:00`,
    count: 0,
    completed: 0,
    revenue: 0,
    isCurrent: h === currentH,
  }));

  for (const order of allOrders) {
    const ts = (order as any).bestellt_am ?? (order as any).created_at;
    if (!ts) continue;
    const d = new Date(ts);
    const h = d.getHours();
    if (h < 0 || h > 23) continue;
    buckets[h].count += 1;
    buckets[h].revenue += (order as any).gesamtbetrag ?? 0;
    const isDone = (order as any).status === 'geliefert' || (order as any).status === 'abgeholt';
    if (isDone) buckets[h].completed += 1;
  }

  // Show only the relevant time window: 10:00 to currentH+2 (or max 23)
  const startH = 10;
  const endH = Math.min(23, currentH + 2);
  return buckets.slice(startH, endH + 1);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: HourBucket }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as HourBucket;
  return (
    <div className="rounded-xl border bg-white px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-foreground mb-1">{d.label} Uhr</div>
      <div className="text-muted-foreground">{d.count} Bestellung{d.count !== 1 ? 'en' : ''}</div>
      {d.completed > 0 && (
        <div className="text-matcha-700">{d.completed} geliefert</div>
      )}
      {d.revenue > 0 && (
        <div className="font-bold text-matcha-900">
          {d.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </div>
      )}
    </div>
  );
}

export function RealtimeFlowChart({ orders, completedOrders }: Props) {
  const [tick, setTick] = useState(0);

  // Re-build every 30s so current-hour highlight stays accurate
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const data = React.useMemo(
    () => buildHourlyData(orders, completedOrders),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, completedOrders, tick],
  );

  const totalToday = data.reduce((s, d) => s + d.count, 0);
  const peakBucket = data.reduce((max, d) => (d.count > max.count ? d : max), { count: 0, label: '' } as HourBucket);
  const currentH = new Date().getHours();
  const prevH = currentH > 0 ? currentH - 1 : null;

  const currentBucket = data.find((d) => d.h === currentH);
  const prevBucket = prevH != null ? data.find((d) => d.h === prevH) : null;

  const trend = currentBucket && prevBucket
    ? currentBucket.count - prevBucket.count
    : null;

  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend == null ? 'text-muted-foreground' : trend > 0 ? 'text-matcha-700' : trend < 0 ? 'text-red-600' : 'text-muted-foreground';

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 text-sm text-muted-foreground">
        <Activity className="inline h-4 w-4 mr-1" /> Noch keine Daten für heute.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-matcha-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-700" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-800">
            Bestellfluss heute
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {trend != null && (
            <span className={cn('flex items-center gap-0.5 font-bold', trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trend > 0 ? `+${trend}` : trend}
            </span>
          )}
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 font-bold text-matcha-800">
            {totalToday} gesamt
          </span>
          {peakBucket.count > 0 && (
            <span className="text-muted-foreground">
              Peak: {peakBucket.label} ({peakBucket.count}×)
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          {peakBucket.count > 0 && (
            <ReferenceLine
              y={peakBucket.count}
              stroke="#d1fae5"
              strokeDasharray="3 3"
            />
          )}
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.h}
                fill={
                  d.isCurrent
                    ? '#16a34a'
                    : d.count >= peakBucket.count * 0.8
                    ? '#4ade80'
                    : '#bbf7d0'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t pt-2">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-600 inline-block" />
          Aktuelle Stunde
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-400 inline-block" />
          Spitzenstunde
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-200 inline-block" />
          Übrige Stunden
        </span>
      </div>
    </div>
  );
}
