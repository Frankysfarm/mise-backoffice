'use client';

/**
 * LieferdienstSchichtLiveMetriken — Phase 388
 * Kompakter Live-Schicht-Metrikenstreifen: Heute vs. Gestern, 4 Tiles in 2×2/4-Spalten-Layout.
 * Kein Collapsible — immer sichtbar.
 */

import { useCallback, useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

type MetricsData = {
  orders_today: number;
  orders_yesterday: number;
  revenue_today: number;
  revenue_yesterday: number;
  avg_delivery_min_today: number;
  avg_delivery_min_yesterday: number;
  punctuality_pct_today: number;
  punctuality_pct_yesterday: number;
};

type ApiResponse = {
  today?: {
    order_count?: number;
    revenue?: number;
    avg_delivery_min?: number;
    punctuality_pct?: number;
  };
  yesterday?: {
    order_count?: number;
    revenue?: number;
    avg_delivery_min?: number;
    punctuality_pct?: number;
  };
  metrics?: MetricsData;
};

const MOCK_METRICS: MetricsData = {
  orders_today: 47,
  orders_yesterday: 41,
  revenue_today: 892.5,
  revenue_yesterday: 773.0,
  avg_delivery_min_today: 28,
  avg_delivery_min_yesterday: 31,
  punctuality_pct_today: 87,
  punctuality_pct_yesterday: 82,
};

type DeltaDirection = 'up' | 'down' | 'flat';

function getDelta(
  today: number,
  yesterday: number,
  lowerIsBetter = false,
): { value: number; direction: DeltaDirection; good: boolean } {
  const value = today - yesterday;
  if (Math.abs(value) < 0.01) return { value: 0, direction: 'flat', good: true };
  const up = value > 0;
  const direction: DeltaDirection = up ? 'up' : 'down';
  const good = lowerIsBetter ? !up : up;
  return { value, direction, good };
}

function DeltaBadge({
  today,
  yesterday,
  lowerIsBetter = false,
  format,
}: {
  today: number;
  yesterday: number;
  lowerIsBetter?: boolean;
  format: (n: number) => string;
}) {
  const { value, direction, good } = getDelta(today, yesterday, lowerIsBetter);
  if (direction === 'flat') {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-stone-500">
        <Minus className="h-2.5 w-2.5" />
        ±0
      </span>
    );
  }
  const sign = value > 0 ? '+' : '';
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[10px] font-semibold',
        good ? 'text-matcha-600' : 'text-red-500',
      )}
    >
      {direction === 'up' ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {sign}{format(Math.abs(value))}
    </span>
  );
}

interface MetricTileProps {
  label: string;
  value: string;
  today: number;
  yesterday: number;
  lowerIsBetter?: boolean;
  format: (n: number) => string;
}

function MetricTile({ label, value, today, yesterday, lowerIsBetter = false, format }: MetricTileProps) {
  return (
    <div className="bg-white rounded-xl border border-matcha-100 px-3 py-3 flex flex-col gap-1">
      <span className="text-[10px] text-matcha-500 font-semibold uppercase tracking-wider">
        {label}
      </span>
      <span className="text-2xl font-black text-gray-900 leading-none">{value}</span>
      <div className="flex items-center gap-1">
        <DeltaBadge
          today={today}
          yesterday={yesterday}
          lowerIsBetter={lowerIsBetter}
          format={format}
        />
        <span className="text-[9px] text-stone-400">vs. Gestern</span>
      </div>
    </div>
  );
}

interface Props {
  locationId: string | null;
}

export function LieferdienstSchichtLiveMetriken({ locationId }: Props) {
  const [metrics, setMetrics] = useState<MetricsData>(MOCK_METRICS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) {
      setMetrics(MOCK_METRICS);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        period: 'today',
        location_id: locationId,
      });
      const res = await fetch(`/api/delivery/admin/stats?${params.toString()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: ApiResponse = await res.json();
      if (json.metrics) {
        setMetrics(json.metrics);
      } else if (json.today) {
        setMetrics({
          orders_today: json.today.order_count ?? MOCK_METRICS.orders_today,
          orders_yesterday: json.yesterday?.order_count ?? MOCK_METRICS.orders_yesterday,
          revenue_today: json.today.revenue ?? MOCK_METRICS.revenue_today,
          revenue_yesterday: json.yesterday?.revenue ?? MOCK_METRICS.revenue_yesterday,
          avg_delivery_min_today: json.today.avg_delivery_min ?? MOCK_METRICS.avg_delivery_min_today,
          avg_delivery_min_yesterday: json.yesterday?.avg_delivery_min ?? MOCK_METRICS.avg_delivery_min_yesterday,
          punctuality_pct_today: json.today.punctuality_pct ?? MOCK_METRICS.punctuality_pct_today,
          punctuality_pct_yesterday: json.yesterday?.punctuality_pct ?? MOCK_METRICS.punctuality_pct_yesterday,
        });
      }
    } catch {
      setMetrics(MOCK_METRICS);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 15 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-100 bg-white">
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          Schicht Live-Metriken · Heute vs. Gestern
        </span>
        {loading && (
          <span className="ml-auto text-[10px] text-matcha-400">Aktualisierung…</span>
        )}
      </div>

      {/* 2×2 on mobile, 4-column on desktop */}
      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile
          label="Bestellungen"
          value={String(metrics.orders_today)}
          today={metrics.orders_today}
          yesterday={metrics.orders_yesterday}
          format={(n) => `${Math.round(n)}`}
        />
        <MetricTile
          label="Umsatz"
          value={euro(metrics.revenue_today)}
          today={metrics.revenue_today}
          yesterday={metrics.revenue_yesterday}
          format={(n) => euro(n)}
        />
        <MetricTile
          label="Ø Lieferzeit"
          value={`${Math.round(metrics.avg_delivery_min_today)} Min`}
          today={metrics.avg_delivery_min_today}
          yesterday={metrics.avg_delivery_min_yesterday}
          lowerIsBetter
          format={(n) => `${Math.round(n)} Min`}
        />
        <MetricTile
          label="Pünktlichkeit"
          value={`${Math.round(metrics.punctuality_pct_today)} %`}
          today={metrics.punctuality_pct_today}
          yesterday={metrics.punctuality_pct_yesterday}
          format={(n) => `${Math.round(n)} %`}
        />
      </div>
    </div>
  );
}
