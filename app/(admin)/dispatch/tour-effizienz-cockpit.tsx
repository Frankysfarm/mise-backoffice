'use client';

import { useEffect, useState, useMemo } from 'react';
import { Gauge, Euro, Clock, MapPin } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    gesamtbetrag: number;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
}

interface Props {
  batches: Batch[];
}

const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'aktiv', 'assigned']);

type Trend = '🔥 Top' | '⚠️ Verzug' | '▶ Normal';

interface TourMetrics {
  batch: Batch;
  driverName: string;
  completedStops: number;
  totalStops: number;
  progressPct: number;
  elapsedMin: number;
  eurPerStop: number;
  efficiencyScore: number;
  trend: Trend;
}

function computeMetrics(batch: Batch, now: number): TourMetrics {
  const completedStops = batch.stops.filter((s) => s.geliefert_am !== null).length;
  const totalStops = batch.stops.length;
  const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  const elapsedMin = startMs ? Math.max(0, Math.floor((now - startMs) / 60_000)) : 0;

  const revenue = batch.stops
    .filter((s) => s.geliefert_am !== null)
    .reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0);
  const eurPerStop = completedStops > 0 ? revenue / completedStops : 0;

  const efficiencyScore =
    (completedStops / Math.max(1, totalStops)) * 60 +
    Math.min(40, (revenue / (elapsedMin || 1)) * 10);

  const totalEta = batch.total_eta_min ?? 0;
  const timePct = totalEta > 0 ? (elapsedMin / totalEta) * 100 : 0;

  let trend: Trend;
  if (progressPct > 75 && timePct < 80) {
    trend = '🔥 Top';
  } else if (progressPct < 40 && timePct > 50) {
    trend = '⚠️ Verzug';
  } else {
    trend = '▶ Normal';
  }

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
    : 'Fahrer';

  return {
    batch,
    driverName,
    completedStops,
    totalStops,
    progressPct,
    elapsedMin,
    eurPerStop,
    efficiencyScore,
    trend,
  };
}

function trendBadgeClass(trend: Trend): string {
  if (trend === '🔥 Top') return 'bg-matcha-50 text-matcha-700 border border-matcha-200';
  if (trend === '⚠️ Verzug') return 'bg-red-50 text-red-700 border border-red-200';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
}

function progressBarClass(progressPct: number): string {
  if (progressPct >= 75) return 'bg-matcha-500';
  if (progressPct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function elapsedLabel(elapsedMin: number): string {
  if (elapsedMin < 60) return `${elapsedMin} Min`;
  return `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`;
}

export function DispatchTourEffizienzCockpit({ batches }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = useMemo(
    () => batches.filter((b) => ACTIVE_STATUSES.has(b.status)),
    [batches],
  );

  const metrics = useMemo(
    () => activeBatches.map((b) => computeMetrics(b, now)),
    [activeBatches, now],
  );

  if (activeBatches.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 px-4 pt-4 bg-matcha-50 border-b border-matcha-100">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-matcha-600 shrink-0" />
          <CardTitle className="text-sm font-black uppercase tracking-wider text-matcha-800">
            Tour-Effizienz-Cockpit
          </CardTitle>
          <span
            className={cn(
              'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
              'bg-matcha-100 text-matcha-700',
            )}
          >
            {activeBatches.length} aktiv
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {metrics.map((m) => (
            <div
              key={m.batch.id}
              className="rounded-xl border bg-card p-3 flex flex-col gap-2 shadow-sm"
            >
              {/* Driver + Zone */}
              <div className="flex items-start justify-between gap-1 min-w-0">
                <span className="text-xs font-black text-foreground truncate leading-tight">
                  {m.driverName}
                </span>
                {m.batch.zone && (
                  <span className="shrink-0 rounded-full bg-matcha-50 text-matcha-700 border border-matcha-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                    {m.batch.zone}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {m.completedStops} / {m.totalStops} Stopps
                  </span>
                  <span className="tabular-nums font-bold">{Math.round(m.progressPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', progressBarClass(m.progressPct))}
                    style={{ width: `${m.progressPct}%` }}
                  />
                </div>
              </div>

              {/* EUR/Stop + Elapsed */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Euro className="h-3 w-3 shrink-0" />
                  <span className="font-black tabular-nums text-foreground">
                    {m.eurPerStop.toFixed(2)}
                  </span>
                  <span className="text-[9px]">/Stop</span>
                </div>
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="tabular-nums font-bold">{elapsedLabel(m.elapsedMin)}</span>
                </div>
              </div>

              {/* Trend badge */}
              <div
                className={cn(
                  'self-start rounded-full px-2 py-0.5 text-[10px] font-black',
                  trendBadgeClass(m.trend),
                )}
              >
                {m.trend}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
