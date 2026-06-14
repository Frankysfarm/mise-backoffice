'use client';

/**
 * SchichtSchnellBar
 * Kompakte horizontale KPI-Leiste oben im Lieferdienst-Dashboard.
 * Pollt /api/delivery/admin/ops-snapshot für Echtzeit-KPIs.
 * Phase 185.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Package, TrendingUp, Zap } from 'lucide-react';

type Snapshot = {
  drivers_online: number;
  active_tours: number;
  cooking_now: number;
  avg_eta_min: number | null;
  delivered_today: number;
  on_time_pct: number | null;
};

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

export function SchichtSchnellBar() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`/api/delivery/admin/ops-snapshot?location_id=${LOCATION_ID}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setSnap({
              drivers_online:  d.drivers_online  ?? d.driversOnline  ?? 0,
              active_tours:    d.active_tours    ?? d.activeTours    ?? 0,
              cooking_now:     d.cooking_now     ?? d.cookingNow     ?? 0,
              avg_eta_min:     d.avg_eta_min     ?? d.avgEtaMin      ?? null,
              delivered_today: d.delivered_today ?? d.deliveredToday ?? 0,
              on_time_pct:     d.on_time_pct     ?? d.onTimePct      ?? null,
            });
          }
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, []);

  if (!snap) return null;

  const kpis = [
    {
      icon: Bike,
      label: 'Fahrer online',
      value: snap.drivers_online.toString(),
      color: snap.drivers_online === 0 ? 'text-red-600' : snap.drivers_online >= 3 ? 'text-matcha-700' : 'text-amber-700',
      bg: snap.drivers_online === 0 ? 'bg-red-50' : 'bg-matcha-50',
    },
    {
      icon: TrendingUp,
      label: 'Aktive Touren',
      value: snap.active_tours.toString(),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: Package,
      label: 'In Zubereitung',
      value: snap.cooking_now.toString(),
      color: snap.cooking_now >= 6 ? 'text-red-600' : snap.cooking_now >= 3 ? 'text-orange-600' : 'text-matcha-700',
      bg: snap.cooking_now >= 6 ? 'bg-red-50' : 'bg-orange-50',
    },
    ...(snap.avg_eta_min !== null ? [{
      icon: Clock,
      label: 'Ø ETA',
      value: `${snap.avg_eta_min} Min`,
      color: snap.avg_eta_min > 50 ? 'text-red-600' : snap.avg_eta_min > 35 ? 'text-amber-700' : 'text-matcha-700',
      bg: 'bg-matcha-50',
    }] : []),
    {
      icon: CheckCircle2,
      label: 'Heute geliefert',
      value: snap.delivered_today.toString(),
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
    },
    ...(snap.on_time_pct !== null ? [{
      icon: Zap,
      label: 'Pünktlichkeit',
      value: `${Math.round(snap.on_time_pct)}%`,
      color: snap.on_time_pct >= 80 ? 'text-matcha-700' : snap.on_time_pct >= 60 ? 'text-amber-700' : 'text-red-600',
      bg: snap.on_time_pct >= 80 ? 'bg-matcha-50' : snap.on_time_pct >= 60 ? 'bg-amber-50' : 'bg-red-50',
    }] : []),
  ];

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <div
            key={i}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border px-4 py-3 shrink-0 min-w-[90px]',
              kpi.bg, 'border-black/5',
            )}
          >
            <Icon className={cn('h-4 w-4 mb-1', kpi.color)} />
            <div className={cn('font-display text-xl font-black tabular-nums leading-none', kpi.color)}>
              {kpi.value}
            </div>
            <div className="text-[9px] font-bold text-muted-foreground mt-0.5 text-center leading-tight">
              {kpi.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
