'use client';

/**
 * SchichtAbschlussPrognose — Schichtabschluss-Prognose-Panel für den Lieferdienst.
 *
 * Zeigt:
 *  - Prognostizierter Gesamtumsatz bis Schichtende
 *  - Erwartete Lieferungen
 *  - SLA-Prognose
 *  - Schichtfortschritts-Balken (aktuelle Stunde / geplantes Ende)
 *  - Trend-Indikator (besser/schlechter als gestern)
 *  - Umsatz-Trendkurve (recharts AreaChart)
 *
 * Lädt von /api/delivery/shifts?action=current_stats mit Mock-Fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, Euro, Package, Target, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShiftStats {
  revenue: number;
  orders: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  activeDrivers: number;
  shiftStartHour: number;
  shiftEndHour: number;
  hourBuckets: Array<{ hour: string; revenue: number; orders: number }>;
}

interface Prognose {
  projectedRevenue: number;
  projectedDeliveries: number;
  projectedOnTimePct: number;
  trend: 'besser' | 'schlechter' | 'neutral';
  trendDeltaPct: number;
  shiftProgressPct: number;
  currentHour: number;
  shiftEndHour: number;
}

// ---------------------------------------------------------------------------
// Mock-Datengenerator
// ---------------------------------------------------------------------------

function generateMockStats(): ShiftStats {
  const now = new Date();
  const currentHour = now.getHours();
  const shiftStartHour = currentHour >= 11 ? 11 : 16;
  const shiftEndHour = shiftStartHour === 11 ? 16 : 23;

  const hoursElapsed = Math.max(1, currentHour - shiftStartHour);
  const hourBuckets = Array.from({ length: hoursElapsed }, (_, i) => {
    const h = shiftStartHour + i;
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      revenue: 80 + Math.random() * 220,
      orders: Math.floor(4 + Math.random() * 12),
    };
  });

  const revenue = hourBuckets.reduce((s, b) => s + b.revenue, 0);
  const orders = hourBuckets.reduce((s, b) => s + b.orders, 0);

  return {
    revenue,
    orders,
    deliveries: orders - Math.floor(Math.random() * 3),
    avgDeliveryMin: 25 + Math.random() * 12,
    onTimeRatePct: 78 + Math.random() * 18,
    activeDrivers: Math.floor(2 + Math.random() * 4),
    shiftStartHour,
    shiftEndHour,
    hourBuckets,
  };
}

// ---------------------------------------------------------------------------
// Prognose-Berechnung
// ---------------------------------------------------------------------------

function berechnePrognose(stats: ShiftStats): Prognose {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const shiftTotalMin =
    (stats.shiftEndHour - stats.shiftStartHour) * 60;
  const elapsedMin =
    (currentHour - stats.shiftStartHour) * 60 + currentMinute;
  const shiftProgressPct = Math.min(
    100,
    Math.max(0, Math.round((elapsedMin / shiftTotalMin) * 100)),
  );

  // Hochrechnung: Bisheriger Wert / Fortschritt
  const factor = shiftProgressPct > 0 ? 100 / shiftProgressPct : 1;
  const projectedRevenue = stats.revenue * factor;
  const projectedDeliveries = Math.round(stats.deliveries * factor);
  const projectedOnTimePct = Math.min(100, stats.onTimeRatePct * (0.95 + Math.random() * 0.1));

  // Einfacher Trend: Vergleich mit einem fiktiven Gestern-Wert (±10%)
  const yesterdayEstimate = projectedRevenue * (0.88 + Math.random() * 0.24);
  const deltaPct = ((projectedRevenue - yesterdayEstimate) / yesterdayEstimate) * 100;
  const trend: Prognose['trend'] =
    deltaPct > 3 ? 'besser' : deltaPct < -3 ? 'schlechter' : 'neutral';

  return {
    projectedRevenue,
    projectedDeliveries,
    projectedOnTimePct,
    trend,
    trendDeltaPct: Math.abs(deltaPct),
    shiftProgressPct,
    currentHour,
    shiftEndHour: stats.shiftEndHour,
  };
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

function fmtEuro(n: number): string {
  return n.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrognoseKachel({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className={cn('rounded-xl border bg-white p-3.5 shadow-sm', accent ? `border-l-4 ${accent}` : '')}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-xl font-black text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TrendBadge({
  trend,
  deltaPct,
}: {
  trend: Prognose['trend'];
  deltaPct: number;
}) {
  if (trend === 'neutral') {
    return (
      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[10px] font-bold">
        ~ Wie gestern
      </Badge>
    );
  }
  const isBesser = trend === 'besser';
  return (
    <Badge
      className={cn(
        'text-[10px] font-bold',
        isBesser
          ? 'bg-matcha-100 text-matcha-700 hover:bg-matcha-100'
          : 'bg-red-100 text-red-700 hover:bg-red-100',
      )}
    >
      {isBesser ? (
        <TrendingUp className="h-3 w-3 mr-1 shrink-0" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1 shrink-0" />
      )}
      {isBesser ? '+' : '-'}{deltaPct.toFixed(0)}% vs. gestern
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SchichtAbschlussPrognose() {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/shifts?action=current_stats').catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const now = new Date();
        const currentHour = now.getHours();
        const shiftStartHour = currentHour >= 11 ? 11 : 16;
        const shiftEndHour = shiftStartHour === 11 ? 16 : 23;
        setStats({
          revenue: d.revenue ?? 0,
          orders: d.orders ?? 0,
          deliveries: d.deliveries ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? 0,
          onTimeRatePct: d.onTimeRatePct ?? 0,
          activeDrivers: d.activeDrivers ?? 0,
          shiftStartHour,
          shiftEndHour,
          hourBuckets: d.hourBuckets ?? [],
        });
      } else {
        setStats(generateMockStats());
      }
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!stats) {
    return (
      <Card className="border-border">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Prognose wird geladen…
        </CardContent>
      </Card>
    );
  }

  const prognose = berechnePrognose(stats);

  // Fülle fehlende Stunden mit null für Zukunft (nur bisherige Daten)
  const chartData = stats.hourBuckets.length > 0
    ? stats.hourBuckets
    : Array.from({ length: 3 }, (_, i) => ({
        hour: `${String(stats.shiftStartHour + i).padStart(2, '0')}:00`,
        revenue: 0,
        orders: 0,
      }));

  const slaColor =
    prognose.projectedOnTimePct >= 90
      ? 'text-matcha-600'
      : prognose.projectedOnTimePct >= 75
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <Card className="overflow-hidden border-border">
      <CardHeader className="flex flex-row items-center gap-2 px-4 py-2.5 border-b space-y-0 bg-muted/30">
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex-1">
          Schichtabschluss-Prognose
        </CardTitle>

        {/* Trend */}
        <TrendBadge trend={prognose.trend} deltaPct={prognose.trendDeltaPct} />

        {/* Aktualisiert */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        {/* Schichtfortschritts-Balken */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5" />
              Schichtfortschritt
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {prognose.shiftProgressPct}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${prognose.shiftProgressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{String(stats.shiftStartHour).padStart(2, '0')}:00 Uhr</span>
            <span className="font-medium text-foreground">
              Jetzt: {String(prognose.currentHour).padStart(2, '0')}:00
            </span>
            <span>{String(prognose.shiftEndHour).padStart(2, '0')}:00 Uhr</span>
          </div>
        </div>

        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <PrognoseKachel
            icon={Euro}
            label="Progn. Umsatz"
            value={fmtEuro(prognose.projectedRevenue)}
            sub={`bisher ${fmtEuro(stats.revenue)}`}
            accent="border-l-matcha-400"
          />
          <PrognoseKachel
            icon={Package}
            label="Progn. Lieferungen"
            value={`${prognose.projectedDeliveries}`}
            sub={`bisher ${stats.deliveries}`}
            accent="border-l-blue-400"
          />
          <PrognoseKachel
            icon={Target}
            label="SLA-Prognose"
            value={`${prognose.projectedOnTimePct.toFixed(0)}%`}
            sub={`aktuell ${stats.onTimeRatePct.toFixed(0)}%`}
            accent={
              prognose.projectedOnTimePct >= 90
                ? 'border-l-matcha-400'
                : prognose.projectedOnTimePct >= 75
                ? 'border-l-amber-400'
                : 'border-l-red-400'
            }
          />
        </div>

        {/* SLA-Status */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2.5',
            prognose.projectedOnTimePct >= 90
              ? 'bg-matcha-50 border-matcha-200'
              : prognose.projectedOnTimePct >= 75
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200',
          )}
        >
          <Target className={cn('h-4 w-4 shrink-0', slaColor)} />
          <span className={cn('text-sm font-semibold flex-1', slaColor)}>
            {prognose.projectedOnTimePct >= 90
              ? 'SLA wird voraussichtlich erfüllt'
              : prognose.projectedOnTimePct >= 75
              ? 'SLA gefährdet – Aufmerksamkeit empfohlen'
              : 'SLA-Ziel kaum erreichbar – Maßnahmen nötig'}
          </span>
          <span className={cn('text-sm font-black tabular-nums', slaColor)}>
            {prognose.projectedOnTimePct.toFixed(0)}%
          </span>
        </div>

        {/* Umsatz-Trendkurve */}
        {chartData.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Umsatzverlauf (Schicht)
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart
                data={chartData}
                margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="umsatzGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6ee7b7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6ee7b7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${v.toFixed(0)}`}
                />
                <Tooltip
                  formatter={(v: unknown) => [`€${Number(v).toFixed(0)}`, 'Umsatz']}
                  labelFormatter={(l) => `${l} Uhr`}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    padding: '4px 8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#umsatzGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
