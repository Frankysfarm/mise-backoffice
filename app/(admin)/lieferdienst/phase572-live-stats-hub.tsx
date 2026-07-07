'use client';

/**
 * Phase 572 — Lieferdienst: Live-Stats-Hub
 *
 * Kompaktes Statistiken-Dashboard mit den wichtigsten KPIs
 * in einer übersichtlichen Kachel-Ansicht.
 *
 * Metriken:
 * - Heutige Lieferungen (gesamt / pünktlich / zu spät)
 * - Ø Lieferzeit (heute)
 * - Aktive Fahrer vs. geplante Fahrer
 * - Umsatz heute (live)
 * - Storno-Rate heute
 * - On-Time-Rate (%)
 *
 * Holt Daten via /api/delivery/admin/overview + /api/delivery/admin/reporting
 * Fallback: Mock-Daten mit Hinweis
 *
 * Auto-Refresh: alle 2 Minuten
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, Euro,
  Package, RefreshCw, Target, TrendingDown, TrendingUp, XCircle,
} from 'lucide-react';

interface StatsData {
  total_orders: number;
  delivered: number;
  on_time: number;
  late: number;
  cancelled: number;
  avg_delivery_min: number | null;
  drivers_online: number;
  revenue_today: number | null;
  on_time_rate: number | null;
  cancellation_rate: number | null;
  isMock?: boolean;
}

const MOCK_DATA: StatsData = {
  total_orders: 42,
  delivered: 38,
  on_time: 33,
  late: 5,
  cancelled: 2,
  avg_delivery_min: 28,
  drivers_online: 4,
  revenue_today: 1240.50,
  on_time_rate: 86.8,
  cancellation_rate: 4.8,
  isMock: true,
};

interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: 'up' | 'down' | null;
  trendGood?: boolean;
}

function euro(n: number | null): string {
  if (n == null) return '–';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

function pct(n: number | null): string {
  if (n == null) return '–';
  return `${n.toFixed(1)} %`;
}

interface Props {
  locationId?: string | null;
}

export function LieferdienstPhase572LiveStatsHub({ locationId }: Props) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const [overviewRes] = await Promise.all([
        fetch(`/api/delivery/admin/overview${params}`),
      ]);

      if (!overviewRes.ok) throw new Error('API error');
      const overview = await overviewRes.json();

      const today = overview?.today_stats ?? {};
      const health = overview?.health ?? {};

      setStats({
        total_orders: today.total_orders ?? 0,
        delivered: today.delivered ?? 0,
        on_time: Math.round((today.delivered ?? 0) * ((health.sla_on_time_pct ?? 85) / 100)),
        late: today.delivered - Math.round((today.delivered ?? 0) * ((health.sla_on_time_pct ?? 85) / 100)),
        cancelled: today.cancelled ?? 0,
        avg_delivery_min: health.avg_delivery_min ?? null,
        drivers_online: today.drivers_online ?? 0,
        revenue_today: overview?.revenue?.today_total ?? null,
        on_time_rate: health.sla_on_time_pct ?? null,
        cancellation_rate: today.total_orders > 0
          ? ((today.cancelled ?? 0) / today.total_orders * 100)
          : null,
        isMock: false,
      });
      setLastRefresh(new Date());
    } catch {
      setStats(MOCK_DATA);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  const onTimeRate = stats.on_time_rate;
  const tiles: KpiTile[] = [
    {
      label: 'Bestellungen heute',
      value: stats.total_orders.toString(),
      sub: `${stats.delivered} geliefert`,
      icon: Package,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
    },
    {
      label: 'On-Time-Rate',
      value: pct(onTimeRate),
      sub: onTimeRate != null
        ? onTimeRate >= 90 ? 'Exzellent' : onTimeRate >= 80 ? 'Gut' : 'Verbesserung nötig'
        : undefined,
      icon: onTimeRate != null && onTimeRate >= 85 ? CheckCircle2 : AlertTriangle,
      color: onTimeRate == null ? 'bg-muted/30 border-muted text-muted-foreground'
        : onTimeRate >= 90 ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
        : onTimeRate >= 80 ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-800',
    },
    {
      label: 'Ø Lieferzeit',
      value: stats.avg_delivery_min != null ? `${stats.avg_delivery_min} Min` : '–',
      sub: stats.avg_delivery_min != null
        ? stats.avg_delivery_min <= 25 ? 'Sehr gut' : stats.avg_delivery_min <= 35 ? 'OK' : 'Zu langsam'
        : undefined,
      icon: Clock,
      color: stats.avg_delivery_min == null ? 'bg-muted/30 border-muted text-muted-foreground'
        : stats.avg_delivery_min <= 25 ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
        : stats.avg_delivery_min <= 35 ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-800',
    },
    {
      label: 'Fahrer online',
      value: stats.drivers_online.toString(),
      sub: stats.drivers_online >= 3 ? 'Gut besetzt' : 'Wenig Fahrer',
      icon: Bike,
      color: stats.drivers_online >= 3
        ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
        : 'bg-amber-50 border-amber-200 text-amber-800',
    },
    {
      label: 'Umsatz heute',
      value: euro(stats.revenue_today),
      sub: undefined,
      icon: Euro,
      color: 'bg-purple-50 border-purple-200 text-purple-800',
    },
    {
      label: 'Storno-Rate',
      value: pct(stats.cancellation_rate),
      sub: stats.cancellation_rate != null
        ? stats.cancellation_rate <= 3 ? 'Niedrig' : stats.cancellation_rate <= 8 ? 'Mittel' : 'Hoch!'
        : undefined,
      icon: stats.cancellation_rate != null && stats.cancellation_rate > 8 ? XCircle : Target,
      color: stats.cancellation_rate == null ? 'bg-muted/30 border-muted text-muted-foreground'
        : stats.cancellation_rate <= 3 ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
        : stats.cancellation_rate <= 8 ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-800',
    },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Live-Stats-Hub</span>
        {stats.isMock && (
          <Badge variant="outline" className="text-[9px] h-4 ml-1 text-amber-600 border-amber-300">
            Demo
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground">
              {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className={cn('rounded-xl border p-3 space-y-1.5', tile.color)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-semibold truncate">{tile.label}</span>
              </div>
              <div className="text-2xl font-black tabular-nums leading-none">{tile.value}</div>
              {tile.sub && (
                <div className="text-[9px] font-semibold opacity-80">{tile.sub}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-4 px-4 pb-3 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-matcha-500" />
          {stats.on_time} pünktlich
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          {stats.late >= 0 ? stats.late : 0} verspätet
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-500" />
          {stats.cancelled} storniert
        </span>
        <Badge variant="outline" className="ml-auto text-[9px] h-4">
          2 Min · Auto-Refresh
        </Badge>
      </div>
    </Card>
  );
}
