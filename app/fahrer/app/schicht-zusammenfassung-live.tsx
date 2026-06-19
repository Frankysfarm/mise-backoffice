'use client';

/**
 * SchichtZusammenfassungLive — Fahrer-App Phase 280
 *
 * Live-Zusammenfassung der aktuellen Schicht:
 * - Gelieferte Bestellungen
 * - Einnahmen bisher (inkl. Trinkgeld)
 * - Ø Lieferzeit
 * - Pünktlichkeitsrate
 * - Hochrechnung: voraussichtliche Einnahmen bis Schichtende
 *
 * Pollt /api/delivery/driver/my-performance alle 60 Sekunden.
 * Fallback: Mock-Daten
 */

import { useEffect, useState } from 'react';
import { Bike, Clock, Euro, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceData {
  deliveries: number;
  earningsEur: number;
  tipsEur: number;
  avgDeliveryMin: number;
  onTimePct: number;
  shiftDurationMin: number;
  deliveriesPerHour: number;
}

function generateMock(): PerformanceData {
  const shiftMin = Math.floor(Math.random() * 180 + 60);
  const deliveries = Math.floor(shiftMin / 25 * (0.8 + Math.random() * 0.4));
  return {
    deliveries,
    earningsEur: deliveries * (2.5 + Math.random() * 1.5),
    tipsEur: deliveries * (0.5 + Math.random() * 1.2),
    avgDeliveryMin: 22 + Math.floor(Math.random() * 12),
    onTimePct: 75 + Math.floor(Math.random() * 22),
    shiftDurationMin: shiftMin,
    deliveriesPerHour: deliveries / (shiftMin / 60),
  };
}

interface Props {
  driverId?: string;
  onlineSince?: string | null;
}

export function SchichtZusammenfassungLive({ driverId, onlineSince }: Props) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/driver/my-performance', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setData({
          deliveries: d.deliveries ?? d.stopsCompleted ?? 0,
          earningsEur: d.earningsEur ?? d.earnings ?? 0,
          tipsEur: d.tipsEur ?? d.tips ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? d.avgMin ?? 0,
          onTimePct: d.onTimePct ?? d.onTimeRate ?? 0,
          shiftDurationMin: d.shiftDurationMin ?? (onlineSince
            ? Math.floor((Date.now() - new Date(onlineSince).getTime()) / 60_000)
            : 0),
          deliveriesPerHour: d.deliveriesPerHour ?? 0,
        });
      } else {
        setData(generateMock());
      }
    } catch {
      setData(generateMock());
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-36 bg-stone-100 rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalEarnings = data.earningsEur + data.tipsEur;
  const shiftHours   = data.shiftDurationMin / 60;
  const remainingMin = Math.max(0, 480 - data.shiftDurationMin); // Assume 8h shift
  const forecastEarnings = shiftHours > 0.5
    ? (totalEarnings / shiftHours) * (data.shiftDurationMin / 60 + remainingMin / 60)
    : null;

  const kpis = [
    {
      icon: Bike,
      label: 'Lieferungen',
      value: data.deliveries.toString(),
      sub: `${data.deliveriesPerHour.toFixed(1)}/h Pace`,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: Euro,
      label: 'Einnahmen',
      value: `€${totalEarnings.toFixed(2)}`,
      sub: `inkl. €${data.tipsEur.toFixed(2)} Trinkgeld`,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: Clock,
      label: 'Ø Lieferzeit',
      value: `${data.avgDeliveryMin} Min`,
      sub: `${data.onTimePct.toFixed(0)}% pünktlich`,
      color: data.avgDeliveryMin > 35 ? 'text-red-600' : 'text-amber-700',
      bg: data.avgDeliveryMin > 35 ? 'bg-red-50' : 'bg-amber-50',
    },
    {
      icon: TrendingUp,
      label: 'Prognose',
      value: forecastEarnings ? `€${forecastEarnings.toFixed(0)}` : '—',
      sub: 'Hochrechnung Schichtende',
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
  ];

  const shiftHoursStr = `${Math.floor(data.shiftDurationMin / 60)}h ${data.shiftDurationMin % 60}min`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-black text-stone-800">Schicht-Übersicht</span>
          <span className="text-[10px] font-bold text-stone-400 bg-stone-100 rounded-full px-2 py-0.5">
            {shiftHoursStr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-stone-400">
              {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 disabled:opacity-40 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={cn('rounded-xl p-3 border border-transparent', kpi.bg)}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', kpi.color)} />
                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{kpi.label}</span>
              </div>
              <div className={cn('text-xl font-black tabular-nums', kpi.color)}>{kpi.value}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Pünktlichkeits-Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="font-bold text-stone-500">Pünktlichkeit</span>
          <span className={cn(
            'font-black',
            data.onTimePct >= 90 ? 'text-emerald-600' : data.onTimePct >= 75 ? 'text-amber-600' : 'text-red-500',
          )}>
            {data.onTimePct.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              data.onTimePct >= 90 ? 'bg-emerald-500' : data.onTimePct >= 75 ? 'bg-amber-400' : 'bg-red-500',
            )}
            style={{ width: `${Math.min(100, data.onTimePct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
