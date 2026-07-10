'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Package, Clock, Truck, Euro, Star, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  locationId?: string | null;
}

interface Stats {
  orders_total: number;
  orders_delivered: number;
  orders_cancelled: number;
  revenue: number;
  avg_delivery_min: number | null;
  on_time_pct: number | null;
  drivers_online: number;
  avg_driver_score: number | null;
  peak_hour?: number | null;
  customer_rating?: number | null;
}

function StatCard({
  icon: Icon, label, value, sub, color, alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-white px-3 py-2.5 flex items-start gap-2.5',
      alert ? 'border-red-200 bg-red-50' : 'border-stone-200',
    )}>
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', color ?? 'bg-stone-100')}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 truncate">{label}</div>
        <div className={cn('text-lg font-black tabular-nums leading-none', alert ? 'text-red-700' : 'text-stone-900')}>{value}</div>
        {sub && <div className="text-[9px] text-stone-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function LieferdienstPhase1090StatistikHeuteHub({ locationId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/stats?location_id=${locationId}&scope=shift`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) { setStats(d); setLastUpdated(new Date()); }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Mock data for display when no API data yet
  const s: Stats = stats ?? {
    orders_total: 0,
    orders_delivered: 0,
    orders_cancelled: 0,
    revenue: 0,
    avg_delivery_min: null,
    on_time_pct: null,
    drivers_online: 0,
    avg_driver_score: null,
  };

  const cancelRate = s.orders_total > 0
    ? Math.round((s.orders_cancelled / s.orders_total) * 100)
    : 0;

  const deliveryRate = s.orders_total > 0
    ? Math.round((s.orders_delivered / s.orders_total) * 100)
    : 0;

  return (
    <div className="mx-4 my-2 rounded-2xl border border-stone-200 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-stone-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-matcha-600" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">Heute — Statistik Übersicht</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          {lastUpdated && (
            <span className="text-[9px] text-stone-400">
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!locationId && <span className="text-[9px] text-amber-500">Standort wählen</span>}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
        <StatCard
          icon={Package} label="Bestellungen Heute" color="bg-blue-500"
          value={s.orders_total.toString()}
          sub={`${s.orders_delivered} geliefert`}
        />
        <StatCard
          icon={Euro} label="Umsatz" color="bg-matcha-600"
          value={s.revenue > 0
            ? s.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
            : '—'
          }
          sub={s.orders_delivered > 0
            ? `Ø ${(s.revenue / s.orders_delivered).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} / Lieferung`
            : undefined}
        />
        <StatCard
          icon={Clock} label="Ø Lieferzeit" color="bg-amber-500"
          value={s.avg_delivery_min != null ? `${Math.round(s.avg_delivery_min)} min` : '—'}
          sub={s.avg_delivery_min != null
            ? s.avg_delivery_min <= 30 ? 'Im Ziel' : s.avg_delivery_min <= 40 ? 'Grenzwertig' : 'Zu langsam'
            : undefined}
        />
        <StatCard
          icon={CheckCircle2} label="Pünktlichkeit" color="bg-indigo-500"
          value={s.on_time_pct != null ? `${Math.round(s.on_time_pct)}%` : '—'}
          sub={s.on_time_pct != null
            ? s.on_time_pct >= 80 ? 'Sehr gut' : s.on_time_pct >= 65 ? 'OK' : 'Verbesserungsbedarf'
            : undefined}
          alert={s.on_time_pct != null && s.on_time_pct < 60}
        />
        <StatCard
          icon={Truck} label="Fahrer Online" color="bg-sky-500"
          value={s.drivers_online.toString()}
          sub={`${deliveryRate}% Lieferrate`}
        />
        <StatCard
          icon={AlertTriangle} label="Stornoquote" color={cancelRate >= 10 ? 'bg-red-500' : 'bg-stone-400'}
          value={`${cancelRate}%`}
          sub={`${s.orders_cancelled} storniert`}
          alert={cancelRate >= 10}
        />
      </div>

      {/* Driver Score Strip */}
      {s.avg_driver_score != null && (
        <div className="mx-3 mb-3 rounded-xl border border-stone-200 bg-white px-3 py-2 flex items-center gap-3">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <div className="text-[9px] font-black uppercase tracking-wider text-stone-400">Durchschnittlicher Fahrer-Score</div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', s.avg_driver_score >= 80 ? 'bg-matcha-500' : s.avg_driver_score >= 65 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${Math.min(100, s.avg_driver_score)}%` }}
                />
              </div>
              <span className={cn('text-sm font-black tabular-nums', s.avg_driver_score >= 80 ? 'text-matcha-700' : s.avg_driver_score >= 65 ? 'text-amber-600' : 'text-red-600')}>
                {Math.round(s.avg_driver_score)}
              </span>
            </div>
          </div>
          {s.customer_rating != null && (
            <div className="shrink-0 text-right">
              <div className="text-[9px] text-stone-400">Kundenbewertung</div>
              <div className="text-sm font-black text-amber-600 tabular-nums">{s.customer_rating.toFixed(1)} ★</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
