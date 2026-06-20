'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, BarChart2, RefreshCw } from 'lucide-react';

interface Props {
  locationId: string | null;
}

type DeltaData = {
  hour: number;
  today: {
    orders: number;
    revenueEur: number;
    slaRate: number;
    avgDeliveryMin: number;
  };
  yesterday: {
    orders: number | null;
    revenueEur: number | null;
    slaRate: number | null;
    avgDeliveryMin: number | null;
  };
};

type DeltaMetric = {
  label: string;
  todayVal: string;
  yesterdayVal: string | null;
  delta: number | null;
  deltaLabel: string | null;
  unit: string;
  lowerIsBetter?: boolean;
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function SchichtDeltaVergleich({ locationId }: Props) {
  const [data, setData] = useState<DeltaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/overview?location_id=${encodeURIComponent(locationId)}&period=today`,
        );
        if (!res.ok) throw new Error('fetch failed');
        const d = await res.json();

        const currentHour = new Date().getHours();

        // Build delta from today vs yesterday same-hour data
        const today = {
          orders: d.totalOrders ?? d.orderCount ?? 0,
          revenueEur: d.totalRevenue ?? d.revenue ?? 0,
          slaRate: d.slaRate ?? d.onTimeRate ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? d.avgTime ?? 0,
        };
        const yesterday = {
          orders: typeof d.yesterdayOrders === 'number' ? d.yesterdayOrders : null,
          revenueEur: typeof d.yesterdayRevenue === 'number' ? d.yesterdayRevenue : null,
          slaRate: typeof d.yesterdaySlaRate === 'number' ? d.yesterdaySlaRate : null,
          avgDeliveryMin: typeof d.yesterdayAvgDeliveryMin === 'number' ? d.yesterdayAvgDeliveryMin : null,
        };

        setData({ hour: currentHour, today, yesterday });
        setLastFetch(Date.now());
      } catch {
        const currentHour = new Date().getHours();
        setData({
          hour: currentHour,
          today: { orders: 0, revenueEur: 0, slaRate: 0, avgDeliveryMin: 0 },
          yesterday: { orders: null, revenueEur: null, slaRate: null, avgDeliveryMin: null },
        });
        setLastFetch(Date.now());
      } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;
  if (!data && !loading) return null;

  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-card p-3 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const yest = data.yesterday;
  const metrics: DeltaMetric[] = [
    {
      label: 'Bestellungen',
      todayVal: data.today.orders.toString(),
      yesterdayVal: yest.orders !== null ? yest.orders.toString() : null,
      delta: yest.orders !== null ? data.today.orders - yest.orders : null,
      deltaLabel: yest.orders !== null
        ? `${data.today.orders >= yest.orders ? '+' : ''}${data.today.orders - yest.orders}`
        : null,
      unit: 'Bst.',
    },
    {
      label: 'Umsatz',
      todayVal: fmtEur(data.today.revenueEur),
      yesterdayVal: yest.revenueEur !== null ? fmtEur(yest.revenueEur) : null,
      delta: yest.revenueEur !== null ? data.today.revenueEur - yest.revenueEur : null,
      deltaLabel: yest.revenueEur !== null
        ? `${data.today.revenueEur >= yest.revenueEur ? '+' : ''}${Math.round(((data.today.revenueEur - yest.revenueEur) / Math.max(1, yest.revenueEur)) * 100)}%`
        : null,
      unit: '%',
    },
    {
      label: 'SLA-Rate',
      todayVal: `${Math.round(data.today.slaRate)}%`,
      yesterdayVal: yest.slaRate !== null ? `${Math.round(yest.slaRate)}%` : null,
      delta: yest.slaRate !== null ? data.today.slaRate - yest.slaRate : null,
      deltaLabel: yest.slaRate !== null
        ? `${data.today.slaRate >= yest.slaRate ? '+' : ''}${(data.today.slaRate - yest.slaRate).toFixed(1)}pp`
        : null,
      unit: 'pp',
    },
    {
      label: 'Ø Lieferzeit',
      todayVal: `${Math.round(data.today.avgDeliveryMin)} Min`,
      yesterdayVal: yest.avgDeliveryMin !== null ? `${Math.round(yest.avgDeliveryMin)} Min` : null,
      delta: yest.avgDeliveryMin !== null ? data.today.avgDeliveryMin - yest.avgDeliveryMin : null,
      deltaLabel: yest.avgDeliveryMin !== null
        ? `${data.today.avgDeliveryMin <= yest.avgDeliveryMin ? '' : '+'}${(data.today.avgDeliveryMin - yest.avgDeliveryMin).toFixed(1)} Min`
        : null,
      unit: 'Min',
      lowerIsBetter: true,
    },
  ];

  const hourLabel = `bis ${data.hour}:00 Uhr`;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Heute vs. Gestern</span>
        <span className="text-[10px] text-muted-foreground ml-1">{hourLabel}</span>
        {loading && <RefreshCw className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {metrics.map((m) => {
          const hasYesterday = m.delta !== null;
          const better = hasYesterday && (m.lowerIsBetter ? m.delta! < 0 : m.delta! > 0);
          const worse = hasYesterday && (m.lowerIsBetter ? m.delta! > 0 : m.delta! < 0);

          const deltaColor = !hasYesterday ? 'text-muted-foreground' : better ? 'text-matcha-600' : worse ? 'text-red-600' : 'text-muted-foreground';
          const deltaBg = !hasYesterday ? 'bg-muted/20' : better ? 'bg-matcha-50' : worse ? 'bg-red-50' : 'bg-muted/30';
          const DeltaIcon = better ? TrendingUp : worse ? TrendingDown : Minus;

          return (
            <div key={m.label} className={cn('rounded-xl p-3 border', deltaBg)}>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {m.label}
              </div>
              <div className="text-base font-black tabular-nums text-foreground">
                {m.todayVal}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                Vortag: {m.yesterdayVal ?? '—'}
              </div>
              <div className={cn('flex items-center gap-1 mt-1.5', deltaColor)}>
                <DeltaIcon size={10} />
                <span className="text-[10px] font-bold tabular-nums">{m.deltaLabel ?? '—'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {lastFetch && (
        <div className="px-4 pb-2 text-[9px] text-muted-foreground">
          Aktualisiert {new Date(lastFetch).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 5 Min
        </div>
      )}
    </div>
  );
}
