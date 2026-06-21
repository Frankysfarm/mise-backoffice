'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Clock,
  Euro,
  Package,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsResponse {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  revenue: number;
  avg_delivery_min: number | null;
  on_time_rate: number | null;
  avg_rating: number | null;
  active_drivers: number;
  orders_per_hour: number | null;
  revenue_prev: number | null;
  orders_prev: number | null;
  pending_orders?: number;
}

type QualityLevel = 'good' | 'warn' | 'bad' | null;

function tileColors(q: QualityLevel) {
  switch (q) {
    case 'good': return {
      border: 'border-matcha-200',
      bg: 'bg-matcha-50',
      value: 'text-matcha-700',
      icon: 'text-matcha-500',
      sub: 'text-matcha-500/70',
    };
    case 'warn': return {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      value: 'text-amber-700',
      icon: 'text-amber-500',
      sub: 'text-amber-500/70',
    };
    case 'bad': return {
      border: 'border-red-200',
      bg: 'bg-red-50',
      value: 'text-red-700',
      icon: 'text-red-400',
      sub: 'text-red-400/70',
    };
    default: return {
      border: 'border-stone-200',
      bg: 'bg-white',
      value: 'text-stone-800',
      icon: 'text-stone-400',
      sub: 'text-stone-400',
    };
  }
}

function TrendBadge({
  now,
  prev,
  invert = false,
}: {
  now: number;
  prev: number | null;
  invert?: boolean;
}) {
  if (prev == null || prev === 0) return null;
  const delta = ((now - prev) / prev) * 100;
  if (Math.abs(delta) < 0.5) {
    return <span className="text-[9px] text-stone-400 mt-1 block">= Vortag</span>;
  }
  const positive = delta > 0;
  const good = invert ? !positive : positive;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[9px] font-bold mt-1',
        good ? 'text-matcha-500' : 'text-red-400',
      )}
    >
      {positive ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {positive ? '+' : ''}
      {delta.toFixed(1)}% vs. Vortag
    </span>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-2.5 w-2.5',
            i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-stone-200 fill-stone-200',
          )}
        />
      ))}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  quality,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  quality?: QualityLevel;
  children?: React.ReactNode;
}) {
  const c = tileColors(quality ?? null);
  return (
    <div className={cn('rounded-xl border px-3 py-3 flex flex-col', c.border, c.bg)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.icon)} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">
          {label}
        </span>
      </div>
      <div className={cn('text-2xl font-black tabular-nums leading-none', c.value)}>{value}</div>
      {sub && (
        <div className={cn('text-[10px] mt-0.5 leading-snug', c.sub)}>{sub}</div>
      )}
      {children}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded bg-stone-100" />
        <div className="h-3 w-20 rounded bg-stone-100" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-stone-50" />
        ))}
      </div>
    </div>
  );
}

interface Props {
  locationId: string | null;
}

export function LieferdienstEchtzeitBestellKpiGrid({ locationId }: Props) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/stats?location_id=${locationId}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: StatsResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setLastUpdated(new Date());
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [locationId]);

  if (!locationId) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 flex flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-stone-300" />
        <p className="text-sm font-semibold text-stone-400">Bitte Filiale auswählen</p>
        <p className="text-xs text-stone-300">Die KPIs werden nach Auswahl einer Filiale angezeigt.</p>
      </div>
    );
  }

  if (loading) return <SkeletonGrid />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
        <p className="text-sm font-semibold text-red-600">Daten konnten nicht geladen werden.</p>
      </div>
    );
  }

  const deliveredPct = data.total_orders > 0
    ? (data.delivered_orders / data.total_orders) * 100
    : 0;
  const cancelledPct = data.total_orders > 0
    ? (data.cancelled_orders / data.total_orders) * 100
    : 0;

  const deliveredQ: QualityLevel = deliveredPct > 80 ? 'good' : deliveredPct > 50 ? 'warn' : 'bad';
  const cancelledQ: QualityLevel = cancelledPct > 10 ? 'bad' : cancelledPct > 5 ? 'warn' : null;

  const delivTimeQ: QualityLevel =
    data.avg_delivery_min == null ? null :
    data.avg_delivery_min <= 35 ? 'good' :
    data.avg_delivery_min <= 50 ? 'warn' : 'bad';

  const onTimeQ: QualityLevel =
    data.on_time_rate == null ? null :
    data.on_time_rate >= 85 ? 'good' :
    data.on_time_rate >= 70 ? 'warn' : 'bad';

  const ratingQ: QualityLevel =
    data.avg_rating == null ? null :
    data.avg_rating >= 4.5 ? 'good' :
    data.avg_rating >= 3.5 ? 'warn' : 'bad';

  const driversQ: QualityLevel =
    data.active_drivers === 0 ? 'bad' :
    data.active_drivers >= 3 ? 'good' : 'warn';

  const revenueFormatted = data.revenue.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-matcha-100 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-matcha-600" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">
            Echtzeit-KPI
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 animate-pulse inline-block" />
        </div>
        {lastUpdated && (
          <span className="text-[9px] text-stone-400 tabular-nums">
            Stand{' '}
            {lastUpdated.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile
          icon={Package}
          label="Bestellungen heute"
          value={data.total_orders}
          sub={
            data.orders_per_hour != null
              ? `${data.orders_per_hour.toFixed(1)} / Std.`
              : undefined
          }
        >
          <TrendBadge now={data.total_orders} prev={data.orders_prev ?? null} />
        </Tile>

        <Tile
          icon={Target}
          label="Geliefert"
          value={data.delivered_orders}
          sub={`${deliveredPct.toFixed(0)}% der Bestellungen`}
          quality={data.total_orders > 0 ? deliveredQ : null}
        />

        <Tile
          icon={AlertTriangle}
          label="Stornos"
          value={data.cancelled_orders}
          sub={data.total_orders > 0 ? `${cancelledPct.toFixed(1)}% Quote` : undefined}
          quality={cancelledQ}
        />

        <Tile
          icon={Euro}
          label="Umsatz"
          value={revenueFormatted}
          quality={data.revenue > 0 ? 'good' : null}
        >
          <TrendBadge now={data.revenue} prev={data.revenue_prev ?? null} />
        </Tile>

        <Tile
          icon={Clock}
          label="Ø Lieferzeit"
          value={data.avg_delivery_min != null ? `${Math.round(data.avg_delivery_min)} Min` : '—'}
          sub={
            data.avg_delivery_min != null && data.avg_delivery_min > 35
              ? 'Über Zielwert (35 Min)'
              : data.avg_delivery_min != null
              ? 'Im Zielbereich'
              : 'Keine Daten'
          }
          quality={delivTimeQ}
        />

        <Tile
          icon={Target}
          label="Pünktlichkeit"
          value={data.on_time_rate != null ? `${Math.round(data.on_time_rate)}%` : '—'}
          sub={
            data.on_time_rate != null
              ? data.on_time_rate >= 85
                ? 'Sehr gut'
                : data.on_time_rate >= 70
                ? 'Verbesserungsbedarf'
                : 'Kritisch'
              : 'Keine Daten'
          }
          quality={onTimeQ}
        />

        <Tile
          icon={Star}
          label="Ø Bewertung"
          value={data.avg_rating != null ? data.avg_rating.toFixed(1) : '—'}
          sub={
            data.avg_rating != null
              ? data.avg_rating >= 4.5
                ? 'Ausgezeichnet'
                : data.avg_rating >= 3.5
                ? 'Gut'
                : 'Verbesserungsbedarf'
              : 'Keine Bewertungen'
          }
          quality={ratingQ}
        >
          {data.avg_rating != null && <StarRow rating={data.avg_rating} />}
        </Tile>

        <Tile
          icon={Bike}
          label="Aktive Fahrer"
          value={data.active_drivers}
          sub={
            data.active_drivers === 0
              ? 'Kein Fahrer online'
              : data.active_drivers === 1
              ? 'Fahrer im Einsatz'
              : 'Fahrer im Einsatz'
          }
          quality={driversQ}
        />
      </div>

      {data.active_drivers === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-[11px] font-bold text-red-700">
            Kein Fahrer online — Lieferungen können nicht ausgeführt werden!
          </span>
        </div>
      )}

      {data.avg_delivery_min != null && data.avg_delivery_min > 50 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-[11px] font-bold text-amber-700">
            Lieferzeiten kritisch ({Math.round(data.avg_delivery_min)} Min Ø) — Kapazität prüfen
          </span>
        </div>
      )}
    </div>
  );
}
