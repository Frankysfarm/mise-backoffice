'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface HourBucket {
  label: string;
  hour: number;
  umsatz: number;
  orders: number;
  isNow: boolean;
}

function euro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function SchichtUmsatzChart({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [vsYesterday, setVsYesterday] = useState<number | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60_000);

      const [{ data: todayOrders }, { data: yesterdayOrders }] = await Promise.all([
        supabase.from('customer_orders')
          .select('bestellt_am, gesamtbetrag')
          .eq('location_id', locationId)
          .gte('bestellt_am', today.toISOString())
          .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert', 'abgeholt', 'abgeschlossen']),
        supabase.from('customer_orders')
          .select('bestellt_am, gesamtbetrag')
          .eq('location_id', locationId)
          .gte('bestellt_am', yesterday.toISOString())
          .lt('bestellt_am', today.toISOString())
          .in('status', ['fertig', 'unterwegs', 'geliefert', 'abgeholt', 'abgeschlossen']),
      ]);

      if (!todayOrders) return;

      // Build hourly buckets from 10:00 to now+1
      const nowH = new Date().getHours();
      const startH = 10;
      const endH = Math.max(nowH, 22);
      const newBuckets: HourBucket[] = [];

      for (let h = startH; h <= endH; h++) {
        const inBucket = (todayOrders as { bestellt_am: string | null; gesamtbetrag: number }[]).filter((o) => {
          if (!o.bestellt_am) return false;
          return new Date(o.bestellt_am).getHours() === h;
        });
        newBuckets.push({
          hour: h,
          label: `${h}:00`,
          umsatz: inBucket.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0),
          orders: inBucket.length,
          isNow: h === nowH,
        });
      }

      setBuckets(newBuckets);

      const total = (todayOrders as { gesamtbetrag: number }[]).reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      setTotalToday(total);

      if (yesterdayOrders) {
        const yTotal = (yesterdayOrders as { gesamtbetrag: number }[]).reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
        setVsYesterday(yTotal > 0 ? ((total - yTotal) / yTotal) * 100 : null);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (buckets.length === 0) return null;

  const maxUmsatz = Math.max(1, ...buckets.map((b) => b.umsatz));
  const trendUp = vsYesterday != null && vsYesterday > 5;
  const trendDown = vsYesterday != null && vsYesterday < -5;

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-black text-stone-800">Schicht-Umsatz</span>
        </div>
        <div className="flex items-center gap-2">
          {vsYesterday != null && (
            <div className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              trendUp ? 'bg-matcha-100 text-matcha-700'
              : trendDown ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600',
            )}>
              {trendUp ? <TrendingUp className="h-3 w-3" />
              : trendDown ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
              {vsYesterday > 0 ? '+' : ''}{vsYesterday.toFixed(1)}% vs. gestern
            </div>
          )}
          <span className="text-sm font-black text-matcha-700 tabular-nums">{euro(totalToday)}</span>
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={buckets} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={12} barGap={2}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as HourBucket;
              return (
                <div className="rounded-lg border bg-white px-2 py-1.5 text-[10px] shadow-lg">
                  <div className="font-bold text-stone-700">{d.label}</div>
                  <div className="text-matcha-600 font-black">{euro(d.umsatz)}</div>
                  <div className="text-stone-400">{d.orders} Best.</div>
                </div>
              );
            }}
          />
          <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell
                key={i}
                fill={b.isNow ? '#15803d' : b.umsatz >= maxUmsatz * 0.8 ? '#4ade80' : '#86efac'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="flex items-center gap-4 text-[10px] text-stone-500 border-t pt-2">
        <span>
          Spitzenstunde: <strong className="text-stone-700">
            {buckets.reduce((best, b) => b.umsatz > best.umsatz ? b : best, buckets[0]).label}
          </strong>
        </span>
        <span>
          Ø/Stunde: <strong className="text-stone-700">
            {euro(totalToday / Math.max(1, buckets.filter((b) => b.umsatz > 0).length))}
          </strong>
        </span>
        <span className="ml-auto">
          {buckets.reduce((s, b) => s + b.orders, 0)} Best. heute
        </span>
      </div>
    </div>
  );
}
