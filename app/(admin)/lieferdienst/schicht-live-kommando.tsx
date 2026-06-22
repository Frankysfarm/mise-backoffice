'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Euro, Clock, Target, Bike, XCircle, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStats {
  orders_count: number;
  revenue_eur: number;
  avg_delivery_min: number;
  on_time_pct: number;
  active_drivers: number;
  cancellation_rate_pct: number;
  orders_per_hour: number;
  top_zone: string | null;
}

const FALLBACK: ShiftStats = {
  orders_count: 0,
  revenue_eur: 0,
  avg_delivery_min: 0,
  on_time_pct: 0,
  active_drivers: 0,
  cancellation_rate_pct: 0,
  orders_per_hour: 0,
  top_zone: null,
};

export interface SchichtLiveKommandoProps {
  locationId: string | null;
}

type Status = 'green' | 'amber' | 'red';

const statusColor: Record<Status, string> = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

function ordersStatus(v: number): Status { return v > 20 ? 'green' : 'amber'; }
function deliveryStatus(v: number): Status { return v <= 30 ? 'green' : v <= 45 ? 'amber' : 'red'; }
function punctualityStatus(v: number): Status { return v >= 90 ? 'green' : v >= 75 ? 'amber' : 'red'; }
function driversStatus(v: number): Status { return v === 0 ? 'red' : 'green'; }
function cancelStatus(v: number): Status { return v <= 5 ? 'green' : v <= 10 ? 'amber' : 'red'; }

function Tile({
  icon: Icon,
  value,
  label,
  status,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  status: Status;
}) {
  return (
    <div className="rounded-xl bg-matcha-900 border border-matcha-800 p-3 flex flex-col gap-1">
      <Icon className={cn('w-4 h-4', statusColor[status])} />
      <span className={cn('font-black text-xl tabular-nums leading-none', statusColor[status])}>
        {value}
      </span>
      <span className="text-xs text-matcha-400 leading-none">{label}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-xl bg-matcha-900 border border-matcha-800 p-3 flex flex-col gap-2">
      <div className="w-4 h-4 rounded bg-matcha-800 animate-pulse" />
      <div className="w-12 h-5 rounded bg-matcha-800 animate-pulse" />
      <div className="w-16 h-3 rounded bg-matcha-800 animate-pulse" />
    </div>
  );
}

export function SchichtLiveKommando({ locationId }: SchichtLiveKommandoProps) {
  const [data, setData] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/stats?scope=shift&location_id=${locationId}`);
      if (!res.ok) throw new Error('Non-OK response');
      const json: ShiftStats = await res.json();
      setData(json);
      setOffline(false);
      setLastUpdate(new Date());
    } catch {
      setOffline(true);
      if (!data) setData(FALLBACK);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const stats = data ?? FALLBACK;
  const isFirstLoad = loading && data === null;

  const tiles = [
    {
      icon: TrendingUp,
      value: String(stats.orders_count),
      label: 'Bestellungen',
      status: ordersStatus(stats.orders_count),
    },
    {
      icon: Euro,
      value: `€${stats.revenue_eur.toFixed(2)}`,
      label: 'Umsatz',
      status: 'green' as Status,
    },
    {
      icon: Clock,
      value: `${stats.avg_delivery_min} Min`,
      label: 'Lieferzeit',
      status: deliveryStatus(stats.avg_delivery_min),
    },
    {
      icon: Target,
      value: `${stats.on_time_pct}%`,
      label: 'Pünktlichkeit',
      status: punctualityStatus(stats.on_time_pct),
    },
    {
      icon: Bike,
      value: String(stats.active_drivers),
      label: 'Fahrer aktiv',
      status: driversStatus(stats.active_drivers),
    },
    {
      icon: XCircle,
      value: `${stats.cancellation_rate_pct}%`,
      label: 'Storno-Rate',
      status: cancelStatus(stats.cancellation_rate_pct),
    },
  ];

  return (
    <div className="rounded-2xl border border-matcha-700/50 bg-matcha-900/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-800">
        <span className="font-semibold text-sm text-matcha-100">Schicht-Kommando</span>
        <div className="flex items-center gap-2 text-matcha-400">
          {lastUpdate && (
            <span className="text-xs">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {offline && <WifiOff className="w-3.5 h-3.5 text-red-400" />}
          <RefreshCw
            className={cn('w-3.5 h-3.5 cursor-pointer hover:text-matcha-100 transition-colors', loading && 'animate-spin')}
            onClick={fetchStats}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3">
        {isFirstLoad
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
          : tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>
    </div>
  );
}
