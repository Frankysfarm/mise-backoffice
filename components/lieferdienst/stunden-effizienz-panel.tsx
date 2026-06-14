'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  estimatedTime?: number;
  actualTime?: number;
  createdAt?: Date | null;
}

interface HourBucket {
  hour: string;
  orders: number;
  avg_min: number | null;
  onTime: number;
}

function bucketByHour(orders: Order[]): HourBucket[] {
  const buckets = new Map<number, { count: number; mins: number[]; onTime: number }>();

  for (const o of orders) {
    const ts = o.acceptedAt ?? o.createdAt;
    if (!ts) continue;
    const h = new Date(ts).getHours();
    const bucket = buckets.get(h) ?? { count: 0, mins: [], onTime: 0 };
    bucket.count++;
    if (o.estimatedTime && o.actualTime) {
      bucket.mins.push(o.actualTime);
      if (o.actualTime <= o.estimatedTime * 1.1) bucket.onTime++;
    }
    buckets.set(h, bucket);
  }

  const now = new Date().getHours();
  return Array.from({ length: 13 }, (_, i) => {
    const h = (now - 12 + i + 24) % 24;
    const b = buckets.get(h);
    const avg = b && b.mins.length > 0
      ? Math.round(b.mins.reduce((s, v) => s + v, 0) / b.mins.length)
      : null;
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      orders: b?.count ?? 0,
      avg_min: avg,
      onTime: b?.onTime ?? 0,
    };
  });
}

interface Props {
  orders: Order[];
}

export function StundenEffizienzPanel({ orders }: Props) {
  const [tab, setTab] = useState<'orders' | 'time'>('orders');
  const data = bucketByHour(orders);

  const maxOrders = Math.max(1, ...data.map(d => d.orders));
  const currentHour = new Date().getHours();
  const currentLabel = `${String(currentHour).padStart(2, '0')}:00`;

  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const peakBucket = data.reduce((best, d) => d.orders > best.orders ? d : best, data[0]);

  if (totalOrders === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Stündliche Effizienz
        </span>
        <div className="ml-auto flex rounded-lg overflow-hidden border border-border text-[10px] font-bold">
          <button
            onClick={() => setTab('orders')}
            className={cn(
              'px-2.5 py-1 transition-colors',
              tab === 'orders' ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            Bestellungen
          </button>
          <button
            onClick={() => setTab('time')}
            className={cn(
              'px-2.5 py-1 transition-colors',
              tab === 'time' ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            Ø Zeit
          </button>
        </div>
      </div>

      {/* KPI-Schnellinfo */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peak-Stunde</div>
          <div className="text-lg font-black text-foreground tabular-nums">{peakBucket.hour}</div>
          <div className="text-[10px] text-muted-foreground">{peakBucket.orders} Bestellungen</div>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gesamt heute</div>
          <div className="text-lg font-black text-foreground tabular-nums">{totalOrders}</div>
          <div className="text-[10px] text-muted-foreground">Bestellungen</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 8, fill: 'var(--muted-foreground)' }}
            tickFormatter={v => v.slice(0, 2)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val: unknown) => [
              tab === 'orders' ? `${val} Bestellungen` : val != null ? `${val} Min` : '—',
              tab === 'orders' ? 'Bestellungen' : 'Ø Zubereitungszeit',
            ]}
            labelFormatter={label => `${label} Uhr`}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Bar
            dataKey={tab === 'orders' ? 'orders' : 'avg_min'}
            radius={[3, 3, 0, 0]}
          >
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={
                  entry.hour === currentLabel
                    ? 'var(--matcha-600, #4a7c59)'
                    : entry.orders === 0
                    ? 'var(--muted, #e5e7eb)'
                    : 'var(--matcha-300, #a7c4b0)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <TrendingUp size={10} />
        Letzte 12 Stunden · aktualisiert jede Minute
      </div>
    </div>
  );
}
