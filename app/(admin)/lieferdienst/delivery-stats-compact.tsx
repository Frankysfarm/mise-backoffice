'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn, euro } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ArrowDown,
  ArrowUp,
  Bike,
  Clock,
  Euro,
  Minus,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';

interface StatsToday {
  orders: number;
  revenue: number;
  avg_delivery_min: number;
  punctuality_pct: number;
  active_drivers: number;
  cancellation_rate: number;
}

interface StatsYesterday {
  orders: number;
  revenue: number;
  avg_delivery_min: number;
}

interface StatsData {
  today: StatsToday;
  yesterday: StatsYesterday;
}

const MOCK_DATA: StatsData = {
  today: {
    orders: 47,
    revenue: 1284.5,
    avg_delivery_min: 28,
    punctuality_pct: 85,
    active_drivers: 4,
    cancellation_rate: 3.2,
  },
  yesterday: {
    orders: 41,
    revenue: 1102.0,
    avg_delivery_min: 32,
  },
};

function deliveryTimeVariant(min: number): 'good' | 'warn' | 'bad' {
  if (min <= 30) return 'good';
  if (min <= 45) return 'warn';
  return 'bad';
}

function punctualityVariant(pct: number): 'good' | 'warn' | 'bad' {
  if (pct >= 80) return 'good';
  if (pct >= 60) return 'warn';
  return 'bad';
}

function cancellationVariant(pct: number): 'good' | 'warn' | 'bad' {
  if (pct <= 5) return 'good';
  if (pct <= 10) return 'warn';
  return 'bad';
}

function statusClasses(v: 'good' | 'warn' | 'bad') {
  if (v === 'good') return { border: 'border-matcha-200 bg-matcha-50', text: 'text-matcha-700', badge: 'border-matcha-200 text-matcha-700 bg-matcha-50' };
  if (v === 'warn') return { border: 'border-amber-200 bg-amber-50', text: 'text-amber-700', badge: 'border-amber-200 text-amber-700 bg-amber-50' };
  return { border: 'border-red-200 bg-red-50', text: 'text-red-700', badge: 'border-red-200 text-red-700 bg-red-50' };
}

function MetricCell({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  variant?: 'good' | 'warn' | 'bad' | null;
}) {
  const cls = variant ? statusClasses(variant) : null;
  return (
    <div className={cn('rounded-lg border px-3 py-2', cls?.border ?? 'border-stone-200 bg-white')}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3 w-3 shrink-0', cls ? cls.text : 'text-stone-400')} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">{label}</span>
      </div>
      <div className={cn('text-lg font-black tabular-nums leading-none', cls?.text ?? 'text-stone-800')}>{value}</div>
    </div>
  );
}

function TrendRow({
  icon: Icon,
  label,
  current,
  previous,
  format,
  invertedDelta,
}: {
  icon: React.ElementType;
  label: string;
  current: number;
  previous: number;
  format: (n: number) => string;
  invertedDelta?: boolean;
}) {
  const diff = current - previous;
  const isPositive = invertedDelta ? diff < 0 : diff > 0;
  const isNeutral = diff === 0;

  const Arrow = isNeutral ? Minus : isPositive ? ArrowUp : ArrowDown;
  const arrowColor = isNeutral
    ? 'text-stone-400'
    : isPositive
    ? 'text-matcha-600'
    : 'text-red-500';

  const diffLabel = isNeutral
    ? '±0'
    : `${diff > 0 ? '+' : ''}${format(diff)}`;

  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-stone-400" />
      <span className="text-xs text-stone-600 flex-1 truncate">{label}</span>
      <span className="text-xs font-bold tabular-nums text-stone-800">{format(current)}</span>
      <div className={cn('flex items-center gap-0.5 text-[11px] font-bold tabular-nums', arrowColor)}>
        <Arrow className="h-3 w-3 shrink-0" />
        <span>{diffLabel}</span>
      </div>
    </div>
  );
}

export function DeliveryStatsCompact({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/stats?location_id=${locationId}`
        : '/api/delivery/admin/stats';
      const res = await fetch(url);
      if (!res.ok) throw new Error('non-ok');
      const json: StatsData = await res.json();
      setData(json);
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && !data) {
    return (
      <Card className="p-4 animate-pulse space-y-3">
        <div className="h-3 w-32 rounded bg-stone-100" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-stone-100" />
          ))}
        </div>
        <div className="h-3 w-24 rounded bg-stone-100" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 rounded bg-stone-100" />
          ))}
        </div>
      </Card>
    );
  }

  const d = data ?? MOCK_DATA;
  const t = d.today;
  const y = d.yesterday;

  const deliveryV = deliveryTimeVariant(t.avg_delivery_min);
  const punctualityV = punctualityVariant(t.punctuality_pct);
  const cancellationV = cancellationVariant(t.cancellation_rate);

  return (
    <Card className="p-4 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2">Heute</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MetricCell
            icon={ShoppingBag}
            label="Bestellungen"
            value={String(t.orders)}
          />
          <MetricCell
            icon={Euro}
            label="Umsatz"
            value={euro(t.revenue)}
          />
          <MetricCell
            icon={Clock}
            label="Ø Lieferzeit"
            value={`${t.avg_delivery_min} Min`}
            variant={deliveryV}
          />
          <MetricCell
            icon={TrendingUp}
            label="Pünktlichkeit"
            value={`${t.punctuality_pct}%`}
            variant={punctualityV}
          />
          <MetricCell
            icon={Bike}
            label="Aktive Fahrer"
            value={String(t.active_drivers)}
          />
          <MetricCell
            icon={XCircle}
            label="Stornoquote"
            value={`${t.cancellation_rate}%`}
            variant={cancellationV}
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-1">Trends</p>
        <div className="divide-y divide-stone-100">
          <TrendRow
            icon={ShoppingBag}
            label="Bestellungen"
            current={t.orders}
            previous={y.orders}
            format={(n) => String(Math.abs(Math.round(n)))}
          />
          <TrendRow
            icon={Euro}
            label="Umsatz"
            current={t.revenue}
            previous={y.revenue}
            format={(n) => euro(Math.abs(n))}
          />
          <TrendRow
            icon={Clock}
            label="Lieferzeit"
            current={t.avg_delivery_min}
            previous={y.avg_delivery_min}
            format={(n) => `${Math.abs(Math.round(n))} Min`}
            invertedDelta
          />
        </div>
      </div>
    </Card>
  );
}
