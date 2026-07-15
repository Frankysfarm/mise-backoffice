'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Package, Euro, Clock, Target, Loader2 } from 'lucide-react';

/**
 * Phase 1722 — Schicht-Statistiken-Echtzeit-Dashboard (Lieferdienst)
 *
 * 4 KPI-Kacheln: Bestellungen / Umsatz / Lieferzeit / Pünktlichkeit
 * Delta-Badges vs. Vortag. 10-Min-Polling. Mock-Fallback.
 */

interface Props {
  locationId: string | null;
}

interface KpiData {
  orders: number;
  ordersDelta: number;
  revenue: number;
  revenueDelta: number;
  avgDeliveryMin: number;
  avgDeliveryDelta: number;
  punctualityPct: number;
  punctualityDelta: number;
}

function MOCK(): KpiData {
  return {
    orders: 47,
    ordersDelta: 12,
    revenue: 1284.50,
    revenueDelta: 8.3,
    avgDeliveryMin: 28,
    avgDeliveryDelta: -3,
    punctualityPct: 84,
    punctualityDelta: 5,
  };
}

function DeltaBadge({ delta, unit = '' }: { delta: number; unit?: string }) {
  if (delta === 0) return (
    <span className="flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
      <Minus className="h-2.5 w-2.5" />±0{unit}
    </span>
  );
  const up = delta > 0;
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[9px] font-bold',
      up ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-500',
    )}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{delta}{unit}
    </span>
  );
}

interface KpiTile {
  label: string;
  value: string;
  delta: number;
  unit: string;
  Icon: React.FC<{ className?: string }>;
  good: boolean;
}

export function LieferdienstPhase1722SchichtStatistikenEchtzeitDashboard({ locationId }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/stats?locationId=${locationId}&scope=today`);
        if (res.ok) {
          const d = await res.json();
          setData({
            orders: d.orders ?? MOCK().orders,
            ordersDelta: d.orders_delta ?? MOCK().ordersDelta,
            revenue: d.revenue ?? MOCK().revenue,
            revenueDelta: d.revenue_delta ?? MOCK().revenueDelta,
            avgDeliveryMin: d.avg_delivery_min ?? MOCK().avgDeliveryMin,
            avgDeliveryDelta: d.avg_delivery_delta ?? MOCK().avgDeliveryDelta,
            punctualityPct: d.punctuality_pct ?? MOCK().punctualityPct,
            punctualityDelta: d.punctuality_delta ?? MOCK().punctualityDelta,
          });
        } else {
          setData(MOCK());
        }
      } catch {
        setData(MOCK());
      } finally {
        setLoading(false);
      }
    }

    load();
    pollRef.current = setInterval(load, 10 * 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [locationId]);

  if (!locationId) return null;

  const tiles: KpiTile[] = data ? [
    {
      label: 'Bestellungen',
      value: data.orders.toString(),
      delta: data.ordersDelta,
      unit: '',
      Icon: ({ className }) => <Package className={className} />,
      good: data.ordersDelta >= 0,
    },
    {
      label: 'Umsatz',
      value: `€${data.revenue.toFixed(0)}`,
      delta: Math.round(data.revenueDelta * 10) / 10,
      unit: '%',
      Icon: ({ className }) => <Euro className={className} />,
      good: data.revenueDelta >= 0,
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avgDeliveryMin} Min`,
      delta: data.avgDeliveryDelta,
      unit: ' Min',
      Icon: ({ className }) => <Clock className={className} />,
      good: data.avgDeliveryDelta <= 0,
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.punctualityPct}%`,
      delta: data.punctualityDelta,
      unit: '%',
      Icon: ({ className }) => <Target className={className} />,
      good: data.punctualityDelta >= 0,
    },
  ] : [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-500" />
          Schicht-Statistiken
        </h3>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-[9px] text-muted-foreground">vs. Vortag</span>
      </div>

      {data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(tile => (
            <div key={tile.label} className={cn(
              'rounded-lg border p-3',
              tile.good
                ? 'border-matcha-100 dark:border-matcha-900/50 bg-matcha-50/50 dark:bg-matcha-950/10'
                : 'border-red-100 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10',
            )}>
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg mb-2',
                tile.good
                  ? 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-600 dark:text-matcha-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
              )}>
                <tile.Icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-black tabular-nums leading-none">{tile.value}</div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-[9px] text-muted-foreground">{tile.label}</span>
                <DeltaBadge delta={tile.delta} unit={tile.unit} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground text-right">
        Aktualisiert alle 10 Min · Heute vs. Vortag
      </p>
    </div>
  );
}
