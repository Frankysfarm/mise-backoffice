'use client';

/**
 * SchichtKpiTopBar — Kompakter Live-KPI-Streifen oben im Lieferdienst-View
 *
 * Zeigt die 5 wichtigsten Schicht-Metriken auf einen Blick:
 * Umsatz · Bestellungen · Lieferungen · Ø Lieferzeit · Pünktlichkeit
 *
 * Pollt /api/delivery/shifts?action=current_stats alle 60s.
 * Erscheint immer (auch mit Null-Werten).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Activity, Bike, Clock, Euro, Package, Target, TrendingUp } from 'lucide-react';

interface ShiftStats {
  revenue: number;
  orders: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  activeDrivers: number;
  pendingOrders: number;
}

function Dot({ className }: { className?: string }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full mx-1 opacity-40', className)} />;
}

function Metric({
  icon: Icon, label, value, valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground hidden sm:inline">{label}</span>
      <span className={cn('text-xs font-black tabular-nums', valueColor ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

export function SchichtKpiTopBar() {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/shifts?action=current_stats', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setStats({
            revenue: data.revenue ?? 0,
            orders: data.orders ?? 0,
            deliveries: data.deliveries ?? 0,
            avgDeliveryMin: data.avgDeliveryMin ?? 0,
            onTimeRatePct: data.onTimeRatePct ?? 0,
            activeDrivers: data.activeDrivers ?? 0,
            pendingOrders: data.pendingOrders ?? 0,
          });
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (loading) {
    return (
      <div className="h-10 rounded-xl bg-muted/40 border border-border animate-pulse" />
    );
  }

  if (!stats) return null;

  const onTimePct = Math.round(stats.onTimeRatePct);
  const onTimeColor =
    onTimePct >= 85 ? 'text-matcha-600' : onTimePct >= 65 ? 'text-amber-600' : 'text-red-600';

  const avgMin = Math.round(stats.avgDeliveryMin);
  const avgMinColor =
    avgMin === 0 ? 'text-muted-foreground' : avgMin <= 30 ? 'text-matcha-600' : avgMin <= 45 ? 'text-amber-600' : 'text-red-600';

  const driverColor = stats.activeDrivers === 0 ? 'text-red-600' : 'text-foreground';

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-wrap gap-y-2">
        {/* Live-Dot */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-500" />
          </span>
          <span className="text-[10px] font-bold text-matcha-600 uppercase tracking-wider">Live</span>
        </div>

        <Dot />

        <Metric icon={Euro} label="Umsatz" value={euro(stats.revenue)} />
        <Dot />
        <Metric icon={Package} label="Bestellungen" value={String(stats.orders)} />
        <Dot />
        <Metric icon={TrendingUp} label="Lieferungen" value={String(stats.deliveries)} />
        <Dot />
        <Metric icon={Clock} label="Ø Zeit" value={avgMin > 0 ? `${avgMin} Min` : '–'} valueColor={avgMinColor} />
        <Dot />
        <Metric icon={Target} label="Pünktlichkeit" value={`${onTimePct}%`} valueColor={onTimeColor} />
        <Dot />
        <Metric icon={Bike} label="Fahrer" value={String(stats.activeDrivers)} valueColor={driverColor} />

        {stats.pendingOrders > 0 && (
          <>
            <Dot />
            <div className="flex items-center gap-1.5 shrink-0">
              <Activity className="h-3 w-3 text-amber-500 shrink-0" />
              <span className={cn(
                'text-xs font-black tabular-nums',
                stats.pendingOrders > 3 ? 'text-red-600 animate-pulse' : 'text-amber-600',
              )}>
                {stats.pendingOrders} offen
              </span>
            </div>
          </>
        )}

        {lastUpdated && (
          <div className="ml-auto text-[9px] text-muted-foreground shrink-0 hidden sm:block">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}
