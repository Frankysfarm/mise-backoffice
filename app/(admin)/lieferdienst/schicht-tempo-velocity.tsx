'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  locationId: string | null | undefined;
}

interface HourBucket {
  label: string;
  count: number;
  isCurrent: boolean;
}

function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

export function SchichtTempoVelocity({ locationId }: Props) {
  const supabase = createClient();
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [ordersPerHour, setOrdersPerHour] = useState<number | null>(null);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { data: rows } = await supabase
        .from('customer_orders')
        .select('bestellt_am,typ')
        .eq('location_id', locationId)
        .eq('typ', 'lieferung')
        .gte('bestellt_am', since.toISOString());

      if (!mountedRef.current || !rows) return;

      const nowH = new Date().getHours();
      const bucketMap = new Map<number, number>();
      for (const row of rows) {
        const h = new Date(row.bestellt_am).getHours();
        bucketMap.set(h, (bucketMap.get(h) ?? 0) + 1);
      }

      const result: HourBucket[] = [];
      for (let h = Math.max(0, nowH - 5); h <= Math.min(23, nowH); h++) {
        result.push({ label: getHourLabel(h), count: bucketMap.get(h) ?? 0, isCurrent: h === nowH });
      }
      setBuckets(result);

      const curCount = bucketMap.get(nowH) ?? 0;
      const prevCount = bucketMap.get(nowH - 1) ?? 0;
      const prevPrevCount = bucketMap.get(nowH - 2) ?? 0;

      setOrdersPerHour(curCount);
      const diff = curCount - prevCount;
      const prevDiff = prevCount - prevPrevCount;
      setTrend(Math.abs(diff) < 2 ? 'stable' : diff > 0 ? 'up' : 'down');
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || buckets.length === 0) return null;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Tempo · Bestellungen/Stunde</span>
        <span className="ml-auto rounded-full bg-matcha-50 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {total} heute gesamt
        </span>
      </div>

      <div className="px-4 pt-3 pb-1 flex items-center gap-4">
        <div>
          <div className="text-3xl font-black tabular-nums text-foreground leading-none">
            {ordersPerHour ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Bestellungen diese Stunde</div>
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-5 w-5', trendColor)} />
          <span className={cn('text-xs font-bold', trendColor)}>
            {trend === 'up' ? 'steigend' : trend === 'down' ? 'fallend' : 'stabil'}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} barSize={20} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
              labelStyle={{ fontWeight: 700 }}
              formatter={(val: number) => [`${val} Bestellungen`, 'Lieferungen']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={b.isCurrent ? '#4a7c59' : '#d1fae5'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
