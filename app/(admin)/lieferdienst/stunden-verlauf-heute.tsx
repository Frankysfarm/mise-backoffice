'use client';

/**
 * StundenVerlaufHeute — Phase 403
 *
 * Stündlicher Umsatz- und Bestellungsverlauf für den heutigen Tag.
 * Zeigt abgeschlossene Stunden als Balken + aktuell laufende Stunde als pulsierender Balken.
 * Datenquelle: Supabase customer_orders (bestellt_am, gesamtbetrag, status).
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { euro } from '@/lib/utils';

interface HourBucket {
  hour: number;
  label: string;
  orders: number;
  revenue: number;
  isCurrent: boolean;
}

interface Props {
  locationId?: string | null;
}

function buildHourBuckets(
  orders: { bestellt_am: string | null; gesamtbetrag: number; status: string }[],
): HourBucket[] {
  const now = new Date();
  const currentHour = now.getHours();
  const startHour = Math.max(0, currentHour - 11);

  const buckets: HourBucket[] = [];
  for (let h = startHour; h <= currentHour; h++) {
    buckets.push({ hour: h, label: `${String(h).padStart(2, '0')}:00`, orders: 0, revenue: 0, isCurrent: h === currentHour });
  }

  for (const o of orders) {
    if (!o.bestellt_am) continue;
    const h = new Date(o.bestellt_am).getHours();
    const bucket = buckets.find(b => b.hour === h);
    if (bucket) {
      bucket.orders += 1;
      if (['geliefert', 'unterwegs', 'fertig'].includes(o.status)) {
        bucket.revenue += o.gesamtbetrag;
      }
    }
  }
  return buckets;
}

function trendIcon(buckets: HourBucket[]) {
  if (buckets.length < 3) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const last = buckets[buckets.length - 1];
  const prev = buckets[buckets.length - 2];
  if (!prev || prev.orders === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const ratio = last.orders / prev.orders;
  if (ratio >= 1.15) return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (ratio <= 0.85) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow text-xs">
      <div className="font-bold text-foreground mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="text-muted-foreground">
          {p.name === 'orders' ? `${p.value} Bestellungen` : euro(p.value)}
        </div>
      ))}
    </div>
  );
};

export function StundenVerlaufHeute({ locationId }: Props) {
  const supabase = createClient();
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from('customer_orders')
        .select('bestellt_am, gesamtbetrag, status')
        .gte('bestellt_am', today.toISOString())
        .not('bestellt_am', 'is', null);

      if (locationId) query = query.eq('location_id', locationId);

      const { data, error } = await query;
      if (cancelled) return;
      if (!error && data) {
        setBuckets(buildHourBuckets(data as { bestellt_am: string | null; gesamtbetrag: number; status: string }[]));
      }
      setLoading(false);
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) return null;
  if (buckets.length === 0) return null;

  const totalOrders = buckets.reduce((s, b) => s + b.orders, 0);
  const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const currentBucket = buckets.find(b => b.isCurrent);
  const maxOrders = Math.max(...buckets.map(b => b.orders), 1);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Stundenverlauf · Heute</span>
        {trendIcon(buckets)}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span><span className="font-bold text-foreground">{totalOrders}</span> Bestellungen</span>
          <span><span className="font-bold text-foreground">{euro(totalRevenue)}</span></span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pt-3 pb-1" style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 0, right: 4, left: 4, bottom: 0 }} barSize={18}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(buckets.length / 8) - 1)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="orders" name="orders" radius={[3, 3, 0, 0]}>
              {buckets.map((b) => (
                <Cell
                  key={b.hour}
                  fill={b.isCurrent ? '#5c7a4e' : b.orders >= maxOrders * 0.7 ? '#84a873' : '#c8dbbf'}
                  opacity={b.isCurrent ? 1 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Current hour callout */}
      {currentBucket && (
        <div className="px-4 py-2 border-t bg-matcha-50 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse shrink-0" />
          <span className="text-[11px] text-matcha-700 font-bold">
            Aktuelle Stunde ({currentBucket.label})
          </span>
          <span className="text-[11px] text-muted-foreground">
            {currentBucket.orders} Bestellungen · {euro(currentBucket.revenue)}
          </span>
        </div>
      )}
    </div>
  );
}
