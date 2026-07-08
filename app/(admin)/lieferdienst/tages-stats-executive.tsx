'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Euro,
  Clock,
  Target,
  Users,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type HourlyBucket = { hour: number; orders: number };

type StatsData = {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeitsquote: number;
  aktive_fahrer: number;
  storno_rate: number;
  trend_bestellungen: number;
  trend_umsatz: number;
  trend_lieferzeit: number;
  trend_puenktlichkeit: number;
  trend_fahrer: number;
  trend_storno: number;
  hourly: HourlyBucket[];
};

const MOCK: StatsData = {
  bestellungen_heute: 87,
  umsatz_heute: 2341.5,
  avg_lieferzeit_min: 28,
  puenktlichkeitsquote: 91.4,
  aktive_fahrer: 6,
  storno_rate: 3.2,
  trend_bestellungen: 12.4,
  trend_umsatz: 8.7,
  trend_lieferzeit: -4.1,
  trend_puenktlichkeit: 2.3,
  trend_fahrer: 0,
  trend_storno: -1.1,
  hourly: [
    { hour: 8, orders: 4 },
    { hour: 9, orders: 7 },
    { hour: 10, orders: 9 },
    { hour: 11, orders: 12 },
    { hour: 12, orders: 18 },
    { hour: 13, orders: 14 },
    { hour: 14, orders: 8 },
    { hour: 15, orders: 6 },
    { hour: 16, orders: 5 },
    { hour: 17, orders: 11 },
    { hour: 18, orders: 15 },
    { hour: 19, orders: 9 },
    { hour: 20, orders: 7 },
    { hour: 21, orders: 3 },
  ],
};

function isUsefulData(data: unknown): data is StatsData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.bestellungen_heute === 'number' &&
    typeof d.umsatz_heute === 'number'
  );
}

function TrendBadge({ value, invertGood = false }: { value: number; invertGood?: boolean }) {
  if (value === 0) {
    return <span className="text-neutral-500 text-xs">–</span>;
  }
  const isPositive = value > 0;
  const isGood = invertGood ? !isPositive : isPositive;

  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        isGood ? 'text-[#8fcca0]' : 'text-red-400'
      )}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: number;
  invertGood?: boolean;
};

function KpiCard({ icon, label, value, trend, invertGood }: KpiCardProps) {
  return (
    <div className="bg-neutral-800 rounded-2xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <div className="text-[#8fcca0]">{icon}</div>
        <TrendBadge value={trend} invertGood={invertGood} />
      </div>
      <p className="text-white font-bold text-xl leading-tight truncate">{value}</p>
      <p className="text-neutral-400 text-xs leading-tight">{label}</p>
    </div>
  );
}

function HourlyChart({ data }: { data: HourlyBucket[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.orders), 1);
  const currentHour = new Date().getHours();

  return (
    <div className="bg-neutral-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-[#8fcca0]" />
        <h3 className="text-neutral-200 text-sm font-semibold">Bestellungen nach Stunde</h3>
      </div>
      <div className="flex items-end gap-1 h-20 w-full">
        {data.map(({ hour, orders }) => {
          const heightPct = (orders / max) * 100;
          const isCurrent = hour === currentHour;
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end justify-center" style={{ height: '64px' }}>
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-500',
                    isCurrent ? 'bg-[#6aab7c]' : 'bg-[#4a7c59]/60'
                  )}
                  style={{ height: `${heightPct}%`, minHeight: orders > 0 ? '3px' : '0' }}
                />
              </div>
              <span className="text-neutral-600 text-[9px] font-mono">{hour}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TagesStatsExecutive({ locationId }: { locationId: string }) {
  const [data, setData] = useState<StatsData>(MOCK);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/stats?location_id=${locationId}&period=today`);
      if (!res.ok) throw new Error('bad response');
      const json = await res.json();
      if (isUsefulData(json)) {
        setData(json);
      }
    } catch {
      // keep existing data (mock or last fetch)
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [locationId, fetchData]);

  if (!locationId) return null;

  return (
    <div className="bg-neutral-900 min-h-screen p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">Tages-Executive-Dashboard</h1>
        {loading && <Loader2 className="w-4 h-4 text-[#8fcca0] animate-spin" />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label="Bestellungen heute"
          value={String(data.bestellungen_heute)}
          trend={data.trend_bestellungen}
        />
        <KpiCard
          icon={<Euro className="w-4 h-4" />}
          label="Umsatz heute"
          value={euro(data.umsatz_heute)}
          trend={data.trend_umsatz}
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="Ø Lieferzeit"
          value={`${data.avg_lieferzeit_min} min`}
          trend={data.trend_lieferzeit}
          invertGood
        />
        <KpiCard
          icon={<Target className="w-4 h-4" />}
          label="Pünktlichkeitsquote"
          value={`${data.puenktlichkeitsquote.toFixed(1)} %`}
          trend={data.trend_puenktlichkeit}
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Aktive Fahrer"
          value={String(data.aktive_fahrer)}
          trend={data.trend_fahrer}
        />
        <KpiCard
          icon={<XCircle className="w-4 h-4" />}
          label="Storno-Rate"
          value={`${data.storno_rate.toFixed(1)} %`}
          trend={data.trend_storno}
          invertGood
        />
      </div>

      <HourlyChart data={data.hourly} />
    </div>
  );
}
