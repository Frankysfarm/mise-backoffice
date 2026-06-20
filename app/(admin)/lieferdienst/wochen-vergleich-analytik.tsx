'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus, Loader2, Package, Euro, Bike, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekData {
  orders: number;
  revenue: number;
  deliveries: number;
  avgMin: number;
}

const MOCK_CURRENT: WeekData = { orders: 287, revenue: 8640, deliveries: 243, avgMin: 31 };
const MOCK_PREV: WeekData = { orders: 261, revenue: 7890, deliveries: 218, avgMin: 34 };

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function seedOrders(base: number, seed: number): number {
  // Deterministic-ish spread around base
  const offsets = [0.7, 0.8, 1.0, 1.1, 1.4, 1.6, 1.2];
  return Math.round(base * offsets[seed % offsets.length]);
}

function buildDailyData(currentWeek: WeekData, prevWeek: WeekData) {
  const avgCurrent = Math.round(currentWeek.orders / 7);
  const avgPrev = Math.round(prevWeek.orders / 7);
  return DAYS.map((day, i) => ({
    tag: day,
    dieseWoche: seedOrders(avgCurrent, i),
    vorwoche: seedOrders(avgPrev, i + 3),
  }));
}

function deltaPct(current: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function DeltaBadge({ current, prev, invertColors = false }: { current: number; prev: number; invertColors?: boolean }) {
  const delta = deltaPct(current, prev);
  const positive = delta >= 0;
  const good = invertColors ? !positive : positive;
  const tiny = Math.abs(delta) < 0.5;
  const Icon = tiny ? Minus : positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums',
        tiny
          ? 'bg-gray-100 text-gray-600'
          : good
          ? 'bg-matcha-100 text-matcha-700'
          : 'bg-red-100 text-red-700',
      )}
    >
      <Icon className="h-3 w-3" />
      {positive && !tiny ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
}

interface CompareCardProps {
  icon: React.ElementType;
  label: string;
  currentValue: string;
  prevValue: string;
  current: number;
  prev: number;
  invertColors?: boolean;
  highlight?: string;
}

function CompareCard({
  icon: Icon,
  label,
  currentValue,
  prevValue,
  current,
  prev,
  invertColors,
  highlight,
}: CompareCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 text-matcha-500" />
        {label}
      </div>
      <div className={cn('text-xl font-black tabular-nums', highlight ?? 'text-foreground')}>
        {currentValue}
      </div>
      <div className="flex items-center gap-2 justify-between">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          Vorwoche: {prevValue}
        </span>
        <DeltaBadge current={current} prev={prev} invertColors={invertColors} />
      </div>
    </div>
  );
}

function euroStr(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function WochenVergleichAnalytik() {
  const [current, setCurrent] = useState<WeekData>(MOCK_CURRENT);
  const [prev, setPrev] = useState<WeekData>(MOCK_PREV);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/delivery/admin/analytics?period=week&compare=prev_week')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.currentWeek) setCurrent(json.currentWeek as WeekData);
        if (json?.prevWeek) setPrev(json.prevWeek as WeekData);
        setLastUpdated(new Date());
      })
      .catch(() => {
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const dailyData = buildDailyData(current, prev);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-matcha-50">
        <Calendar className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-black text-matcha-800">Wochen-Vergleich</span>
        <div className="ml-auto flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {lastUpdated && !loading && (
            <span className="text-[9px] text-muted-foreground">
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Column headers */}
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">
          <span>Kennzahl</span>
          <div className="flex gap-4">
            <span className="text-matcha-600">Diese Woche</span>
            <span>Vorwoche</span>
            <span>Δ</span>
          </div>
        </div>

        {/* Comparison cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CompareCard
            icon={Package}
            label="Bestellungen"
            currentValue={current.orders.toString()}
            prevValue={prev.orders.toString()}
            current={current.orders}
            prev={prev.orders}
          />
          <CompareCard
            icon={Euro}
            label="Umsatz"
            currentValue={euroStr(current.revenue)}
            prevValue={euroStr(prev.revenue)}
            current={current.revenue}
            prev={prev.revenue}
            highlight="text-matcha-700"
          />
          <CompareCard
            icon={Bike}
            label="Lieferungen"
            currentValue={current.deliveries.toString()}
            prevValue={prev.deliveries.toString()}
            current={current.deliveries}
            prev={prev.deliveries}
          />
          <CompareCard
            icon={Clock}
            label="Ø Lieferzeit"
            currentValue={`${current.avgMin} Min`}
            prevValue={`${prev.avgMin} Min`}
            current={current.avgMin}
            prev={prev.avgMin}
            invertColors
            highlight={current.avgMin <= prev.avgMin ? 'text-matcha-700' : 'text-red-600'}
          />
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Bar chart: daily orders comparison */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-2">
            Bestellungen pro Tag (Mo–So)
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barCategoryGap="25%" barGap={2}>
                <XAxis
                  dataKey="tag"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(val: number, name: string) => [
                    `${val} Bestellungen`,
                    name === 'dieseWoche' ? 'Diese Woche' : 'Vorwoche',
                  ]}
                />
                <Legend
                  formatter={(value) => (value === 'dieseWoche' ? 'Diese Woche' : 'Vorwoche')}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10 }}
                />
                <Bar dataKey="vorwoche" fill="#b7ddc7" radius={[3, 3, 0, 0]} name="vorwoche" />
                <Bar dataKey="dieseWoche" fill="#2d6b45" radius={[3, 3, 0, 0]} name="dieseWoche" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary line */}
        <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 text-xs text-matcha-700 font-semibold">
          {deltaPct(current.orders, prev.orders) >= 0
            ? `Diese Woche ${Math.abs(deltaPct(current.orders, prev.orders)).toFixed(1)}% mehr Bestellungen als letzte Woche`
            : `Diese Woche ${Math.abs(deltaPct(current.orders, prev.orders)).toFixed(1)}% weniger Bestellungen als letzte Woche`}
        </div>
      </div>
    </div>
  );
}
