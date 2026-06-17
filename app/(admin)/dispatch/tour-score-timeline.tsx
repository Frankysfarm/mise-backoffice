'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, Clock, MapPin, Route as RouteIcon,
  TrendingUp, TrendingDown, Minus, Zap, Star,
} from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
  dispatch_score?: number | null;
};

interface Props {
  batches: Batch[];
}

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function secsToTarget(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-matcha-600 bg-matcha-50 border-matcha-300' :
    score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-300' :
    'text-red-600 bg-red-50 border-red-300';
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-black text-sm tabular-nums', color)}>
      {score}
    </div>
  );
}

function StopDot({ stop, isNext }: { stop: BatchStop; isNext: boolean }) {
  const done = stop.geliefert_am != null;
  const secs = done ? null : secsToTarget(stop.order?.eta_latest);
  const overdue = secs != null && secs < 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        'h-3 w-3 rounded-full shrink-0 border',
        done ? 'bg-matcha-500 border-matcha-600' :
        isNext && overdue ? 'bg-red-500 border-red-600 animate-pulse' :
        isNext ? 'bg-amber-400 border-amber-500 animate-pulse' :
        'bg-muted border-border',
      )} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold truncate max-w-[90px]">
          {stop.order?.kunde_name ?? `Stopp ${stop.reihenfolge}`}
        </div>
        {!done && secs != null && (
          <div className={cn(
            'text-[9px] font-mono tabular-nums',
            overdue ? 'text-red-600 font-black' : secs < 300 ? 'text-amber-600 font-black' : 'text-muted-foreground',
          )}>
            {overdue ? `−${Math.abs(Math.floor(secs / 60))}m` : `${Math.floor(secs / 60)}m`}
          </div>
        )}
        {done && <div className="text-[9px] text-matcha-600">✓</div>}
      </div>
    </div>
  );
}

export function DispatchTourScoreTimeline({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter((b) =>
    ['unterwegs', 'on_route', 'aktiv', 'assigned'].includes(b.status),
  );

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <RouteIcon className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score-Timeline</span>
        <span className="ml-auto rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5">
          {active.length} Tour{active.length !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="divide-y">
        {active.map((batch) => {
          const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const completedCount = stops.filter((s) => s.geliefert_am != null).length;
          const nextStopIdx = stops.findIndex((s) => s.geliefert_am == null);
          const elapsed = elapsedMin(batch.startzeit);
          const etaTotal = batch.total_eta_min ?? null;
          const remainMin = etaTotal != null ? Math.max(0, etaTotal - elapsed) : null;
          const progressPct = stops.length > 0 ? (completedCount / stops.length) * 100 : 0;
          const isLate = etaTotal != null && elapsed > etaTotal * 1.15;
          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
            : 'Fahrer';
          const score = batch.dispatch_score ?? null;

          return (
            <div key={batch.id} className="px-4 py-3 space-y-2.5">
              {/* Row 1: Score + Driver + ETA */}
              <div className="flex items-center gap-3">
                {score != null && <ScoreRing score={Math.round(score)} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bike size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-bold truncate">{driverName}</span>
                    {batch.zone && (
                      <span className="text-[9px] rounded-full border border-border bg-muted/50 px-1.5 py-0.5 font-bold">
                        Zone {batch.zone}
                      </span>
                    )}
                    {isLate && (
                      <span className="text-[9px] rounded-full bg-red-500 text-white font-black px-1.5 py-0.5 animate-pulse">
                        Verspätet
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-mono tabular-nums">{elapsed}m vergangen</span>
                    {remainMin != null && (
                      <span className={cn('font-bold tabular-nums', isLate ? 'text-red-600' : 'text-matcha-600')}>
                        ~{remainMin}m verbleibend
                      </span>
                    )}
                    {batch.total_distance_km != null && (
                      <span>{batch.total_distance_km.toFixed(1)} km</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-bold text-muted-foreground tabular-nums">
                    {completedCount}/{stops.length}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Stopps</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    isLate ? 'bg-red-500' : progressPct > 60 ? 'bg-matcha-500' : 'bg-amber-400',
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Stop dots */}
              <div className="flex items-start gap-3 flex-wrap">
                {stops.map((stop, idx) => (
                  <StopDot key={stop.id} stop={stop} isNext={idx === nextStopIdx} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
