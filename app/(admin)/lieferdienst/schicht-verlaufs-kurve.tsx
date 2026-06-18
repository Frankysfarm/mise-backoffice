'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Clock, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HourlyBucket {
  label: string;       // "10:00"
  hour: number;        // 10
  orders: number;      // Bestellungen in dieser Stunde
  avgDelivery: number; // Ø Lieferzeit in Minuten
  isNow: boolean;
}

interface ApiResponse {
  data: HourlyBucket[];
}

// ---------------------------------------------------------------------------
// Mock data generator
// ---------------------------------------------------------------------------

function generateMockData(): HourlyBucket[] {
  const now = new Date();
  const currentHour = now.getHours();
  const startHour = 10;
  const endHour = Math.min(currentHour, 22);

  // Baseline throughput pattern: lunch peak ~12-13, dinner peak ~18-20
  const throughputShape: Record<number, number> = {
    10: 4,
    11: 7,
    12: 14,
    13: 12,
    14: 6,
    15: 5,
    16: 6,
    17: 9,
    18: 15,
    19: 17,
    20: 13,
    21: 8,
    22: 4,
  };

  // Delivery time pattern: gets worse during peaks
  const deliveryShape: Record<number, number> = {
    10: 22,
    11: 25,
    12: 34,
    13: 32,
    14: 24,
    15: 21,
    16: 22,
    17: 26,
    18: 35,
    19: 38,
    20: 31,
    21: 26,
    22: 22,
  };

  const buckets: HourlyBucket[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const baseOrders = throughputShape[h] ?? 5;
    const baseDelivery = deliveryShape[h] ?? 25;
    // Add slight random jitter
    const orders = Math.max(0, Math.round(baseOrders + (Math.random() - 0.5) * 3));
    const avgDelivery = Math.max(10, Math.round(baseDelivery + (Math.random() - 0.5) * 6));
    buckets.push({
      label: `${String(h).padStart(2, '0')}:00`,
      hour: h,
      orders,
      avgDelivery,
      isNow: h === currentHour,
    });
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Fetch helper with mock fallback
// ---------------------------------------------------------------------------

async function fetchHourlyPerformance(locationId: string): Promise<HourlyBucket[]> {
  try {
    const res = await fetch(
      `/api/delivery/shifts?action=hourly_performance&location_id=${encodeURIComponent(locationId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: ApiResponse = await res.json();
    if (!Array.isArray(json.data) || json.data.length === 0) throw new Error('empty');
    return json.data;
  } catch {
    return generateMockData();
  }
}

// ---------------------------------------------------------------------------
// Health score calculation
// ---------------------------------------------------------------------------

function calcHealthScore(buckets: HourlyBucket[]): number {
  if (buckets.length === 0) return 0;

  const TARGET_DELIVERY = 30; // minutes
  const TARGET_THROUGHPUT = 10; // orders/hour

  // 1) On-time rate (40 %): share of hours where avg delivery ≤ 30 min
  const onTimeHours = buckets.filter((b) => b.avgDelivery <= TARGET_DELIVERY).length;
  const onTimeRate = onTimeHours / buckets.length; // 0-1

  // 2) Throughput vs target (30 %): avg(orders) / target, capped at 1
  const avgOrders = buckets.reduce((s, b) => s + b.orders, 0) / buckets.length;
  const throughputRate = Math.min(1, avgOrders / TARGET_THROUGHPUT);

  // 3) Avg delivery time (30 %): score 1 if ≤20 min, 0 if ≥45 min, linear in between
  const avgDelivery = buckets.reduce((s, b) => s + b.avgDelivery, 0) / buckets.length;
  const deliveryScore = Math.max(0, Math.min(1, (45 - avgDelivery) / (45 - 20)));

  const score = onTimeRate * 40 + throughputRate * 30 + deliveryScore * 30;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const orders = payload.find((p) => p.name === 'orders');
  const delivery = payload.find((p) => p.name === 'avgDelivery');

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-[11px]">
      <div className="font-bold text-stone-700 mb-1">{label}</div>
      {orders && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-stone-500">Bestellungen:</span>
          <span className="font-black text-emerald-700">{orders.value}/h</span>
        </div>
      )}
      {delivery && (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: delivery.value > 30 ? '#ef4444' : '#f59e0b' }}
          />
          <span className="text-stone-500">Ø Lieferzeit:</span>
          <span
            className={cn('font-black', delivery.value > 30 ? 'text-red-600' : 'text-amber-600')}
          >
            {delivery.value} Min
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-3 w-36 rounded bg-stone-100" />
        <div className="h-6 w-16 rounded-lg bg-stone-100" />
      </div>
      {/* Chart placeholder */}
      <div className="h-[160px] rounded-lg bg-stone-50" />
      {/* KPI chips */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex-1 h-14 rounded-xl bg-stone-50" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot renderer: colour delivery-time dots red when above target
// ---------------------------------------------------------------------------

function DeliveryDot(props: {
  cx?: number;
  cy?: number;
  payload?: HourlyBucket;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const over = payload.avgDelivery > 30;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={over ? '#ef4444' : '#f59e0b'}
      stroke="white"
      strokeWidth={1}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SchichtVerlaufsKurve({ locationId }: { locationId: string }) {
  const [buckets, setBuckets] = useState<HourlyBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async () => {
    const data = await fetchHourlyPerformance(locationId);
    setBuckets(data);
    setLastUpdated(
      new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    );
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 2 * 60_000); // refresh every 2 minutes
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <Skeleton />;
  if (buckets.length === 0) return null;

  // Derived metrics
  const healthScore = calcHealthScore(buckets);
  const healthColor =
    healthScore >= 80
      ? 'text-emerald-600'
      : healthScore >= 60
      ? 'text-amber-500'
      : 'text-red-500';
  const healthBg =
    healthScore >= 80
      ? 'bg-emerald-50 border-emerald-200'
      : healthScore >= 60
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200';

  const peakBucket = buckets.reduce(
    (best, b) => (b.orders > best.orders ? b : best),
    buckets[0],
  );

  const currentBucket = buckets[buckets.length - 1];
  const avgDelivery =
    Math.round(buckets.reduce((s, b) => s + b.avgDelivery, 0) / buckets.length);

  const trendVsPrev =
    buckets.length >= 2
      ? currentBucket.orders - buckets[buckets.length - 2].orders
      : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-stone-400 shrink-0" />
          <span className="text-sm font-black text-stone-800">Schichtverlauf</span>
          <span className="text-[9px] text-stone-400 uppercase tracking-wider font-bold">
            · Bestellungen &amp; Lieferzeit
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-stone-400">
            Aktualisiert {lastUpdated}
          </span>
          {/* Schicht-Health-Score badge */}
          <div
            className={cn(
              'rounded-lg border px-2 py-0.5 flex items-center gap-1',
              healthBg,
            )}
          >
            <Target className="h-3 w-3 shrink-0" style={{ color: healthScore >= 80 ? '#059669' : healthScore >= 60 ? '#d97706' : '#dc2626' }} />
            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: healthScore >= 80 ? '#059669' : healthScore >= 60 ? '#d97706' : '#dc2626' }}>
              Health
            </span>
            <span className={cn('text-sm font-black tabular-nums', healthColor)}>
              {healthScore}
            </span>
          </div>
        </div>
      </div>

      {/* ── Dual-axis line chart ─────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={buckets} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />

          {/* Left Y-axis: orders/h */}
          <YAxis
            yAxisId="orders"
            orientation="left"
            tick={{ fontSize: 9, fill: '#10b981' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            allowDecimals={false}
            width={28}
          />

          {/* Right Y-axis: delivery time */}
          <YAxis
            yAxisId="delivery"
            orientation="right"
            tick={{ fontSize: 9, fill: '#f59e0b' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            unit=" m"
            width={32}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Target reference lines */}
          <ReferenceLine
            yAxisId="delivery"
            y={30}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: 'Ziel 30 Min',
              position: 'insideTopRight',
              fontSize: 8,
              fill: '#ef4444',
            }}
          />
          <ReferenceLine
            yAxisId="orders"
            y={10}
            stroke="#10b981"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: 'Ziel 10/h',
              position: 'insideTopLeft',
              fontSize: 8,
              fill: '#10b981',
            }}
          />

          {/* Orders per hour — emerald */}
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="orders"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 1 }}
            activeDot={{ r: 4, fill: '#10b981' }}
          />

          {/* Avg delivery time — amber/red (dot coloured per value) */}
          <Line
            yAxisId="delivery"
            type="monotone"
            dataKey="avgDelivery"
            name="avgDelivery"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={<DeliveryDot />}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* ── Legend row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[9px] text-stone-400 -mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-emerald-400" />
          Bestellungen/h (links)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-amber-400" />
          Ø Lieferzeit (rechts)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-red-400" />
          &gt; 30 Min
        </span>
      </div>

      {/* ── KPI chips ───────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {/* Aktuelles Tempo */}
        <div
          className={cn(
            'flex-1 min-w-[90px] rounded-xl border px-3 py-2.5',
            trendVsPrev > 0
              ? 'bg-emerald-50 border-emerald-100'
              : trendVsPrev < 0
              ? 'bg-red-50 border-red-100'
              : 'bg-stone-50 border-stone-100',
          )}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <Zap className="h-3 w-3 text-stone-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">
              Aktuelles Tempo
            </span>
          </div>
          <div
            className={cn(
              'text-xl font-black tabular-nums leading-none',
              trendVsPrev > 0
                ? 'text-emerald-700'
                : trendVsPrev < 0
                ? 'text-red-600'
                : 'text-stone-700',
            )}
          >
            {currentBucket.orders}
            <span className="text-xs font-semibold ml-0.5">/h</span>
          </div>
          <div className="text-[9px] text-stone-400 mt-0.5 flex items-center gap-0.5">
            {trendVsPrev > 0 ? (
              <>
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                +{trendVsPrev} vs. Vorst.
              </>
            ) : trendVsPrev < 0 ? (
              <>
                <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                {trendVsPrev} vs. Vorst.
              </>
            ) : (
              'gleich wie Vorst.'
            )}
          </div>
        </div>

        {/* Spitzenstunde */}
        <div className="flex-1 min-w-[90px] rounded-xl border bg-stone-50 border-stone-100 px-3 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="h-3 w-3 text-stone-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">
              Spitzenstunde
            </span>
          </div>
          <div className="text-xl font-black tabular-nums leading-none text-stone-800">
            {peakBucket.label}
          </div>
          <div className="text-[9px] text-stone-400 mt-0.5">
            {peakBucket.orders} Best. · {peakBucket.avgDelivery} Min Ø
          </div>
        </div>

        {/* Durchschnittslieferzeit */}
        <div
          className={cn(
            'flex-1 min-w-[90px] rounded-xl border px-3 py-2.5',
            avgDelivery <= 25
              ? 'bg-emerald-50 border-emerald-100'
              : avgDelivery <= 32
              ? 'bg-amber-50 border-amber-100'
              : 'bg-red-50 border-red-100',
          )}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <Clock className="h-3 w-3 text-stone-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">
              Ø Lieferzeit
            </span>
          </div>
          <div
            className={cn(
              'text-xl font-black tabular-nums leading-none',
              avgDelivery <= 25
                ? 'text-emerald-700'
                : avgDelivery <= 32
                ? 'text-amber-600'
                : 'text-red-600',
            )}
          >
            {avgDelivery}
            <span className="text-xs font-semibold ml-0.5">Min</span>
          </div>
          <div className="text-[9px] text-stone-400 mt-0.5">
            {avgDelivery <= 25 ? 'Sehr gut' : avgDelivery <= 32 ? 'Im Zielbereich' : 'Über Ziel'}
          </div>
        </div>
      </div>

      {/* ── Schicht-Health-Score detail bar ─────────────────────────── */}
      <div className={cn('rounded-xl border p-3 flex items-center gap-4', healthBg)}>
        <div className="shrink-0 text-center">
          <div className={cn('text-4xl font-black tabular-nums leading-none', healthColor)}>
            {healthScore}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">
            Schicht-Health-Score
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                healthScore >= 80
                  ? 'bg-emerald-500'
                  : healthScore >= 60
                  ? 'bg-amber-400'
                  : 'bg-red-500',
              )}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-stone-400">
            <span>0</span>
            <span className="font-bold">
              {healthScore >= 80 ? 'Exzellent' : healthScore >= 60 ? 'Gut' : 'Verbesserungsbedarf'}
            </span>
            <span>100</span>
          </div>
          <div className="text-[9px] text-stone-400 leading-relaxed">
            40% Pünktlichkeit · 30% Durchsatz · 30% Lieferzeit
          </div>
        </div>
      </div>
    </div>
  );
}
