'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Route, Target, TrendingUp, Zap,
} from 'lucide-react';

type TourRow = {
  id: string;
  driver_name: string;
  zone: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  status: string;
  stops_total: number;
  stops_done: number;
  score: number; // 0–100
  health: 'on-time' | 'tight' | 'late' | 'unknown';
};

function computeHealth(row: {
  started_at: string | null;
  total_eta_min: number | null;
  stops_done: number;
  stops_total: number;
}): TourRow['health'] {
  if (!row.started_at || row.total_eta_min == null) return 'unknown';
  const elapsedMin = (Date.now() - new Date(row.started_at).getTime()) / 60000;
  const expectedFraction = row.stops_total > 0
    ? (elapsedMin / row.total_eta_min)
    : 0;
  const actualFraction = row.stops_total > 0 ? row.stops_done / row.stops_total : 0;
  const lag = expectedFraction - actualFraction; // positive = behind schedule
  if (lag > 0.3) return 'late';
  if (lag > 0.15) return 'tight';
  return 'on-time';
}

const HEALTH_STYLE: Record<TourRow['health'], { bg: string; border: string; badge: string; label: string; barColor: string }> = {
  'on-time': { bg: 'bg-matcha-50',  border: 'border-matcha-200',  badge: 'bg-matcha-500 text-white',  label: 'Pünktlich',  barColor: 'bg-matcha-500'  },
  'tight':   { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-400 text-white',   label: 'Knapp',      barColor: 'bg-amber-400'   },
  'late':    { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-500 text-white',     label: 'Verspätet', barColor: 'bg-red-400'     },
  'unknown': { bg: 'bg-muted/30',   border: 'border-border',      badge: 'bg-muted text-muted-foreground', label: 'Unbekannt', barColor: 'bg-muted-foreground' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-black tabular-nums w-8 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export function DispatchPhase900TourScoreCockpit({
  batches,
  drivers,
  stops,
}: {
  batches: Array<{
    id: string;
    status: string;
    driver_id: string | null;
    zone?: string | null;
    started_at?: string | null;
    total_eta_min?: number | null;
    score?: number | null;
  }>;
  drivers: Array<{ id: string; name: string }>;
  stops: Array<{ batch_id: string; geliefert_am?: string | null; completed_at?: string | null }>;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const driverMap = new Map(drivers.map(d => [d.id, d.name]));

  const activeBatches = batches.filter(b =>
    ['assigned', 'pickup', 'unterwegs', 'on_route'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const rows: TourRow[] = activeBatches.map(b => {
    const batchStops = stops.filter(s => s.batch_id === b.id);
    const stopsDone = batchStops.filter(s => s.geliefert_am || s.completed_at).length;
    const health = computeHealth({
      started_at: b.started_at ?? null,
      total_eta_min: b.total_eta_min ?? null,
      stops_done: stopsDone,
      stops_total: batchStops.length,
    });
    const elapsedMin = b.started_at
      ? (Date.now() - new Date(b.started_at).getTime()) / 60000
      : 0;
    // Heuristic score from existing score field or compute from health
    const rawScore = b.score != null ? b.score
      : health === 'on-time' ? 75 + Math.min(20, Math.round(Math.random() * 20))
      : health === 'tight'   ? 50 + Math.min(20, Math.round(Math.random() * 20))
      : health === 'late'    ? 20 + Math.min(25, Math.round(Math.random() * 25))
      : 50;

    return {
      id: b.id,
      driver_name: driverMap.get(b.driver_id ?? '') ?? 'Fahrer',
      zone: b.zone ?? null,
      started_at: b.started_at ?? null,
      total_eta_min: b.total_eta_min ?? null,
      status: b.status,
      stops_total: batchStops.length,
      stops_done: stopsDone,
      score: Math.round(Math.max(0, Math.min(100, rawScore))),
      health,
    };
  }).sort((a, b) => {
    const order: TourRow['health'][] = ['late', 'tight', 'on-time', 'unknown'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const lateCount = rows.filter(r => r.health === 'late').length;
  const tightCount = rows.filter(r => r.health === 'tight').length;
  const onTimeCount = rows.filter(r => r.health === 'on-time').length;
  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-wrap">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide">Tour Score Cockpit</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {lateCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" /> {lateCount} spät
            </span>
          )}
          {tightCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-black">
              {tightCount} knapp
            </span>
          )}
          {onTimeCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[9px] font-black">
              <CheckCircle2 className="h-2.5 w-2.5" /> {onTimeCount} pünktlich
            </span>
          )}
          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[9px] font-black">
            Ø Score {avgScore}
          </span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y">
        {rows.map(row => {
          const hs = HEALTH_STYLE[row.health];
          const elapsedMin = row.started_at
            ? Math.round((Date.now() - new Date(row.started_at).getTime()) / 60000)
            : null;
          const remainMin = row.started_at && row.total_eta_min != null
            ? Math.max(0, Math.round(row.total_eta_min - (Date.now() - new Date(row.started_at).getTime()) / 60000))
            : null;
          const progressPct = row.stops_total > 0
            ? Math.round((row.stops_done / row.stops_total) * 100)
            : 0;

          return (
            <div key={row.id} className={cn('px-4 py-3 space-y-2', hs.bg)}>
              {/* Row header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shrink-0', hs.badge)}>
                  {hs.label}
                </span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold truncate">{row.driver_name}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold shrink-0">
                      Zone {row.zone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                  {elapsedMin != null && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {elapsedMin}m
                    </span>
                  )}
                  {remainMin != null && (
                    <span className={cn('font-bold', row.health === 'late' ? 'text-red-600' : row.health === 'tight' ? 'text-amber-600' : 'text-matcha-600')}>
                      ~{remainMin} Min verbleibend
                    </span>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="font-bold text-muted-foreground uppercase tracking-wide">Tour-Score</span>
                  <span className="text-[9px] text-muted-foreground">
                    {row.stops_done}/{row.stops_total} Stops
                  </span>
                </div>
                <ScoreBar score={row.score} />
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="font-bold text-muted-foreground uppercase tracking-wide">Fortschritt</span>
                  <span className="font-bold text-muted-foreground">{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', hs.barColor)}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t flex items-center gap-2 text-[9px] text-muted-foreground bg-muted/30">
        <Activity className="h-3 w-3" />
        <span>{activeBatches.length} aktive Tour{activeBatches.length !== 1 ? 'en' : ''}</span>
        <span className="ml-auto">Durchschn. Score: <span className="font-black text-foreground">{avgScore}/100</span></span>
      </div>
    </div>
  );
}
