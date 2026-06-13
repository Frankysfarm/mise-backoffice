'use client';

/**
 * SchichtZielePanel — Live Schicht-Leistungsziele für die Lieferdienst-App.
 * Zeigt Tages-Fortschritt für Bestellungen, Umsatz und Lieferzeit.
 * Pollt /api/delivery/stats alle 60s für aktuelle Daten.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Target, TrendingUp, Clock, CheckCircle2, Package,
  Euro, Zap, ChevronUp, ChevronDown,
} from 'lucide-react';

interface ShiftStats {
  orders: {
    total: number;
    delivered: number;
    held: number;
  };
  tours: {
    total: number;
    avg_eta_min: number | null;
  };
  scoring: {
    avg_score: number | null;
  };
}

interface Props {
  locationId: string;
  targetOrders?: number;
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide truncate">{label}</div>
        <div className="font-bold text-sm text-gray-900 tabular-nums">{value}</div>
      </div>
      {trend && (
        <div className={cn(
          'shrink-0 rounded-full p-1',
          trend === 'up' ? 'text-matcha-600' : 'text-red-400',
        )}>
          {trend === 'up' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      )}
      {sub && !trend && (
        <div className="text-[9px] text-gray-400 shrink-0">{sub}</div>
      )}
    </div>
  );
}

export function SchichtZielePanel({ locationId, targetOrders = 30 }: Props) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetch_ = () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      fetch(`/api/delivery/stats?location_id=${locationId}&from=${from.toISOString()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setStats(d);
            setLastUpdate(new Date());
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    fetch_();
    const iv = setInterval(fetch_, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="h-4 w-32 rounded bg-gray-100 animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const deliveryRate = stats.orders.total > 0
    ? Math.round((stats.orders.delivered / stats.orders.total) * 100)
    : 0;

  const orderProgress = Math.min(100, Math.round((stats.orders.total / targetOrders) * 100));
  const avgEta = stats.tours.avg_eta_min;
  const score = stats.scoring.avg_score;

  const etaTrend = avgEta != null ? (avgEta <= 35 ? 'up' : 'down') : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Schicht-Ziele
        </span>
        {lastUpdate && (
          <span className="ml-auto text-[9px] text-gray-400">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Tages-Bestellziel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold text-gray-600 uppercase tracking-wide">
              Bestellungen heute
            </span>
            <span className="font-black text-gray-900 tabular-nums">
              {stats.orders.total} / {targetOrders}
            </span>
          </div>
          <ProgressBar
            value={stats.orders.total}
            max={targetOrders}
            color={orderProgress >= 100 ? 'bg-matcha-500' : orderProgress >= 70 ? 'bg-amber-400' : 'bg-blue-400'}
          />
          <div className="flex items-center justify-between text-[9px] text-gray-400">
            <span>{orderProgress}% des Tagesziels</span>
            <span className={cn(
              'font-bold',
              orderProgress >= 100 ? 'text-matcha-600' : 'text-gray-500',
            )}>
              {orderProgress >= 100 ? '✓ Ziel erreicht!' : `${targetOrders - stats.orders.total} verbleibend`}
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            icon={CheckCircle2}
            label="Lieferquote"
            value={`${deliveryRate}%`}
            sub={`${stats.orders.delivered} geliefert`}
            color={deliveryRate >= 90 ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700'}
            trend={deliveryRate >= 85 ? 'up' : 'down'}
          />
          <KpiCard
            icon={Package}
            label="Touren"
            value={String(stats.tours.total)}
            sub="heute"
            color="bg-blue-100 text-blue-700"
          />
          <KpiCard
            icon={Clock}
            label="∅ Lieferzeit"
            value={avgEta != null ? `${avgEta} Min` : '—'}
            color={avgEta == null ? 'bg-gray-100 text-gray-500' : avgEta <= 35 ? 'bg-matcha-100 text-matcha-700' : avgEta <= 45 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}
            trend={etaTrend}
          />
          <KpiCard
            icon={Zap}
            label="Ø Dispatch-Score"
            value={score != null ? score.toFixed(1) : '—'}
            color={score == null ? 'bg-gray-100 text-gray-500' : score >= 70 ? 'bg-matcha-100 text-matcha-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}
            trend={score != null ? (score >= 70 ? 'up' : 'down') : null}
          />
        </div>

        {/* SLA Status */}
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold',
          deliveryRate >= 90 ? 'bg-matcha-50 text-matcha-700 border border-matcha-200' :
          deliveryRate >= 75 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          'bg-red-50 text-red-700 border border-red-200',
        )}>
          <TrendingUp className="h-3 w-3 shrink-0" />
          {deliveryRate >= 90
            ? 'SLA eingehalten — exzellente Lieferquote'
            : deliveryRate >= 75
            ? 'SLA knapp — Lieferquote prüfen'
            : 'SLA unterschritten — sofortige Maßnahmen nötig'}
        </div>
      </div>
    </div>
  );
}
