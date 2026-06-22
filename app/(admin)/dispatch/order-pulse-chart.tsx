'use client';

/**
 * OrderPulseChart — Phase 399 Frontend
 *
 * 15-Min-Bucket-Balkendiagramm mit Trend-Indikator, Farb-Kodierung (green/amber/red/neutral),
 * Range-Selektor (2h/4h/8h/heute), Metrik-Selektor (Bestellungen/Umsatz/Lieferungen).
 * API: GET /api/delivery/admin/order-pulse?action=chart&range=4h&metric=orders
 */

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChartRange = '2h' | '4h' | '8h' | 'today';
type ChartMetric = 'orders' | 'revenue' | 'deliveries';
type BucketColor = 'green' | 'amber' | 'red' | 'neutral';

interface ChartBucket {
  label:         string;
  orderCount:    number;
  revenueEur:    number;
  deliveryCount: number;
  movingAvg:     number;
  deltaFromPrev: number;
  color:         BucketColor;
  hourlyRate:    number;
}

interface OrderPulseChartData {
  buckets:          ChartBucket[];
  overallTrend:     string;
  avgRate:          number;
  peakBucketLabel:  string | null;
  currentRate:      number;
  nextHourForecast: number;
  totalInRange:     number;
}

interface Props {
  locationId: string | null;
}

const RANGE_LABELS: Record<ChartRange, string> = {
  '2h': '2 Std',
  '4h': '4 Std',
  '8h': '8 Std',
  today: 'Heute',
};

const METRIC_LABELS: Record<ChartMetric, string> = {
  orders:     'Bestellungen',
  revenue:    'Umsatz',
  deliveries: 'Lieferungen',
};

const BUCKET_COLORS: Record<BucketColor, string> = {
  green:   '#16a34a',
  amber:   '#d97706',
  red:     '#ef4444',
  neutral: '#a3a3a3',
};

function metricValue(b: ChartBucket, metric: ChartMetric): number {
  if (metric === 'revenue')    return b.revenueEur;
  if (metric === 'deliveries') return b.deliveryCount;
  return b.orderCount;
}

const CustomTooltip = ({
  active, payload, label, metric,
}: {
  active?: boolean;
  payload?: { value: number; payload: ChartBucket }[];
  label?: string;
  metric: ChartMetric;
}) => {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  const val = metricValue(b, metric);
  const formatted =
    metric === 'revenue'
      ? val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
      : val.toString();
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-xs space-y-1">
      <div className="font-bold text-foreground">{label}</div>
      <div className="text-muted-foreground">{METRIC_LABELS[metric]}: <span className="font-semibold text-foreground">{formatted}</span></div>
      {metric !== 'orders' && (
        <div className="text-muted-foreground">Bestellungen: {b.orderCount}</div>
      )}
      {b.deltaFromPrev !== 0 && (
        <div className={cn('font-medium', b.deltaFromPrev > 0 ? 'text-green-600' : 'text-red-500')}>
          {b.deltaFromPrev > 0 ? '+' : ''}{b.deltaFromPrev} vs. Vorgänger
        </div>
      )}
      <div className="text-muted-foreground">~{b.hourlyRate}/h</div>
    </div>
  );
};

export function OrderPulseChart({ locationId }: Props) {
  const [range, setRange]   = useState<ChartRange>('4h');
  const [metric, setMetric] = useState<ChartMetric>('orders');
  const [data, setData]     = useState<OrderPulseChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/order-pulse?action=chart&range=${range}&metric=${metric}&location_id=${locationId}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.chart ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId, range, metric]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;

  const trendIcon = () => {
    if (!data) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (data.overallTrend === 'beschleunigend') return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (data.overallTrend === 'abkühlend')     return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const chartBuckets = (data?.buckets ?? []).map(b => ({
    ...b,
    value: metricValue(b, metric),
  }));

  const avgRefLine = data
    ? (metric === 'orders' ? data.avgRate / 4 : undefined)
    : undefined;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-stone-100">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold text-foreground">Order-Pulse</span>
        <div className="flex items-center gap-1 ml-1">{trendIcon()}</div>
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.totalInRange} {METRIC_LABELS[metric]} · ~{data.nextHourForecast} nächste Std.
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Metric selector */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs">
            {(Object.keys(METRIC_LABELS) as ChartMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  'px-2 py-1 font-medium transition-colors',
                  metric === m
                    ? 'bg-matcha-600 text-white'
                    : 'bg-white text-muted-foreground hover:bg-stone-50',
                )}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          {/* Range selector */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs">
            {(Object.keys(RANGE_LABELS) as ChartRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-2 py-1 font-medium transition-colors',
                  range === r
                    ? 'bg-matcha-600 text-white'
                    : 'bg-white text-muted-foreground hover:bg-stone-50',
                )}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="h-36 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-matcha-400 border-t-transparent animate-spin" />
          </div>
        ) : !data || chartBuckets.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">
            Keine Daten für diesen Zeitraum
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartBuckets} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip metric={metric} />} />
              {avgRefLine !== undefined && (
                <ReferenceLine
                  y={avgRefLine}
                  stroke="#6b7280"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {chartBuckets.map((b, i) => (
                  <Cell key={i} fill={BUCKET_COLORS[b.color]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer KPIs */}
      {data && (
        <div className="grid grid-cols-3 divide-x border-t border-stone-100 text-center">
          <div className="px-3 py-2.5">
            <div className="text-xs font-black tabular-nums text-foreground">{data.currentRate}/h</div>
            <div className="text-[10px] text-muted-foreground">Aktuelle Rate</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-xs font-black tabular-nums text-foreground">{data.nextHourForecast}</div>
            <div className="text-[10px] text-muted-foreground">Prognose nächste Std.</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-xs font-black tabular-nums text-foreground">
              {data.peakBucketLabel ?? '–'}
            </div>
            <div className="text-[10px] text-muted-foreground">Peak-Bucket</div>
          </div>
        </div>
      )}
    </div>
  );
}
