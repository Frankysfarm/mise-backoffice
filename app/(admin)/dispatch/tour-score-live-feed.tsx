'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertTriangle, Zap, Truck } from 'lucide-react';

type BatchStop = { id: string; order_id: string; reihenfolge: number; geliefert_am: string | null };
type Batch = {
  id: string; status: string; fahrer_id: string | null;
  startzeit?: string | null; total_eta_min: number | null;
  total_distance_km: number | null; zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};
interface Props { batches: Batch[]; }

function computeTourScore(batch: Batch, now: number) {
  const elapsed = batch.startzeit ? (now - new Date(batch.startzeit).getTime()) / 60_000 : 0;
  const eta = batch.total_eta_min ?? 0;
  const stops = batch.stops.length;
  const done = batch.stops.filter(s => s.geliefert_am).length;
  const pct = stops > 0 ? done / stops : 0;

  // Time efficiency: expected done% vs actual done%
  const expectedPct = eta > 0 ? Math.min(1, elapsed / eta) : 0;
  const efficiency = expectedPct > 0 ? pct / expectedPct : 1;

  // Simple score 0-100
  const score = Math.max(0, Math.min(100, Math.round(efficiency * 100)));
  const isOnTime = elapsed <= eta * 1.05;
  const isLate = elapsed > eta * 1.15;

  return { score, efficiency, pct, elapsed, eta, done, stops, isOnTime, isLate };
}

export function DispatchTourScoreLiveFeed({ batches }: Props) {
  const [, setTick] = useState(0);
  const [prevScores, setPrevScores] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const iv = setInterval(() => {
      setTick(n => n + 1);
    }, 10_000);
    return () => clearInterval(iv);
  }, []);

  const ACTIVE = new Set(['unterwegs', 'on_route', 'assigned', 'pickup']);
  const now = Date.now();
  const activeBatches = batches
    .filter(b => ACTIVE.has(b.status))
    .map(b => ({ batch: b, ...computeTourScore(b, now) }))
    .sort((a, b) => {
      // Most behind first
      if (a.isLate && !b.isLate) return -1;
      if (!a.isLate && b.isLate) return 1;
      return a.efficiency - b.efficiency;
    });

  useEffect(() => {
    const m = new Map<string, number>();
    for (const { batch, score } of activeBatches) m.set(batch.id, score);
    setPrevScores(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  if (activeBatches.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700">
        <Zap className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Tour-Score Live · {activeBatches.length} aktiv
        </span>
        <span className="ml-auto text-[10px] font-bold text-white/80">
          Ø {Math.round(activeBatches.reduce((s, a) => s + a.score, 0) / activeBatches.length)}
        </span>
      </div>
      <div className="divide-y divide-border">
        {activeBatches.map(({ batch, score, pct, elapsed, eta, done, stops, isOnTime, isLate }) => {
          const prev = prevScores.get(batch.id);
          const trend = prev == null ? 'neutral' : score > prev ? 'up' : score < prev ? 'down' : 'neutral';
          const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
          const driverName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.` : 'Fahrer';
          const remainMin = Math.max(0, Math.round(eta - elapsed));

          return (
            <div key={batch.id} className={cn(
              'flex items-center gap-3 px-3 py-2.5',
              isLate ? 'bg-red-50' : isOnTime ? 'bg-matcha-50/40' : 'bg-amber-50/40',
            )}>
              {/* Score Badge */}
              <div className={cn(
                'h-11 w-11 rounded-xl flex flex-col items-center justify-center text-white shrink-0',
                score >= 80 ? 'bg-matcha-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500',
              )}>
                <span className="text-sm font-black leading-none">{score}</span>
                <TrendIcon size={9} className="mt-0.5 opacity-80" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">{driverName}</span>
                  {batch.zone && (
                    <span className="text-[10px] font-bold rounded bg-muted px-1.5 py-0.5">{batch.zone}</span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isLate ? 'bg-red-500' : score >= 80 ? 'bg-matcha-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums shrink-0 text-muted-foreground">
                    {done}/{stops}
                  </span>
                </div>
              </div>

              {/* ETA */}
              <div className="shrink-0 text-right">
                <div className={cn(
                  'text-xs font-black tabular-nums',
                  isLate ? 'text-red-600' : 'text-foreground',
                )}>
                  {isLate ? (
                    <span className="flex items-center gap-0.5">
                      <AlertTriangle size={10} className="text-red-500" />
                      {Math.round(elapsed - eta)}m+
                    </span>
                  ) : done === stops ? (
                    <span className="flex items-center gap-0.5">
                      <CheckCircle2 size={10} className="text-matcha-500" />
                      Fertig
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} />
                      {remainMin}m
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {Math.round(elapsed)}m/{eta}m
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
