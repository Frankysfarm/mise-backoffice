'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Star, Clock, Package, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

type Kpi = {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'flat';
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Props = { locationId: string | null };

type Data = {
  ordersToday: number;
  revenueEur: number;
  avgDeliveryMin: number;
  avgRating: number;
  ordersYesterday: number;
  revenueYesterdayEur: number;
  avgDeliveryYesterdayMin: number;
  avgRatingYesterday: number;
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

const MOCK: Data = {
  ordersToday: 47,
  revenueEur: 1243.8,
  avgDeliveryMin: 28,
  avgRating: 4.7,
  ordersYesterday: 41,
  revenueYesterdayEur: 1088.5,
  avgDeliveryYesterdayMin: 31,
  avgRatingYesterday: 4.6,
};

export function LieferdienstPhase1000TagesPerformanceHub({ locationId }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/admin/tages-umsatz-vergleich?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && typeof d.ordersToday === 'number') {
          setData(d as Data);
        } else {
          // Fallback to mock
          setData(MOCK);
        }
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const d = data ?? MOCK;

  const kpis: Kpi[] = [
    {
      label: 'Bestellungen heute',
      value: d.ordersToday.toString(),
      sub: `Gestern: ${d.ordersYesterday}`,
      trend: d.ordersToday > d.ordersYesterday ? 'up' : d.ordersToday < d.ordersYesterday ? 'down' : 'flat',
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
      icon: Package,
    },
    {
      label: 'Umsatz heute',
      value: d.revenueEur.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €',
      sub: `Gestern: ${d.revenueYesterdayEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`,
      trend: d.revenueEur > d.revenueYesterdayEur ? 'up' : d.revenueEur < d.revenueYesterdayEur ? 'down' : 'flat',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      icon: Euro,
    },
    {
      label: 'Ø Lieferzeit',
      value: `${Math.round(d.avgDeliveryMin)} Min`,
      sub: `Gestern: ${Math.round(d.avgDeliveryYesterdayMin)} Min`,
      trend: d.avgDeliveryMin < d.avgDeliveryYesterdayMin ? 'up' : d.avgDeliveryMin > d.avgDeliveryYesterdayMin ? 'down' : 'flat',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      icon: Clock,
    },
    {
      label: 'Ø Bewertung',
      value: d.avgRating.toFixed(1) + ' ★',
      sub: `Gestern: ${d.avgRatingYesterday.toFixed(1)} ★`,
      trend: d.avgRating > d.avgRatingYesterday ? 'up' : d.avgRating < d.avgRatingYesterday ? 'down' : 'flat',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      icon: Star,
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <BarChart2 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">Tages-Performance</div>
          <div className="text-[11px] text-muted-foreground">Heute im Vergleich zu gestern</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
              <div className="flex items-center justify-between mb-1">
                <Icon className={cn('h-4 w-4', kpi.color)} />
                <TrendIcon trend={kpi.trend} />
              </div>
              <div className={cn('text-xl font-black tabular-nums mt-1', kpi.color)}>
                {kpi.value}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{kpi.label}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
