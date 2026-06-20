'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Star, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

type BatchStop = {
  id: string;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  driver_id: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  dispatch_score?: number | null;
  stops?: BatchStop[];
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  driver_score?: number | null;
  delivery_score?: number | null;
};

interface Props {
  drivers: Driver[];
  batches: Batch[];
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-matcha-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const [bg, text] = score >= 80
    ? ['bg-matcha-100 text-matcha-700', 'text-matcha-700']
    : score >= 60
    ? ['bg-amber-100 text-amber-700', 'text-amber-700']
    : ['bg-red-100 text-red-700', 'text-red-700'];
  const Icon = score >= 80 ? TrendingUp : score >= 60 ? Minus : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', bg)}>
      <Icon size={8} />
      {score}
    </span>
  );
}

export function DispatchDriverScorePanel({ drivers, batches }: Props) {
  useTick();
  const now = Date.now();

  const activeDriverIds = new Set(
    batches
      .filter((b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned')
      .map((b) => b.driver_id)
      .filter(Boolean) as string[],
  );

  const rows = drivers
    .filter((d) => activeDriverIds.has(d.id))
    .map((d) => {
      const driverBatches = batches.filter(
        (b) => b.driver_id === d.id && (b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned'),
      );
      const activeBatch = driverBatches[0] ?? null;
      const stops = activeBatch?.stops ?? [];
      const done = stops.filter((s) => s.geliefert_am).length;
      const total = stops.length;
      const score = d.driver_score ?? d.delivery_score ?? activeBatch?.dispatch_score ?? null;

      let remainMin: number | null = null;
      if (activeBatch?.started_at && activeBatch.total_eta_min != null) {
        const elapsed = (now - new Date(activeBatch.started_at).getTime()) / 60_000;
        remainMin = Math.max(0, Math.round(activeBatch.total_eta_min - elapsed));
      }

      return { driver: d, score, done, total, remainMin, batchCount: driverBatches.length };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (rows.length === 0) return null;

  const avgScore = rows.filter((r) => r.score !== null).reduce((s, r) => s + (r.score ?? 0), 0) / rows.filter((r) => r.score !== null).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-matcha-600">
        <Zap className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Fahrer-Score · {rows.length} aktiv
        </span>
        {!isNaN(avgScore) && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            Ø {Math.round(avgScore)}
          </span>
        )}
      </div>

      <div className="divide-y divide-border">
        {rows.map(({ driver, score, done, total, remainMin, batchCount }, i) => (
          <div key={driver.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
              i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground',
            )}>
              {i + 1}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Bike size={11} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-bold truncate">{driver.vorname} {driver.nachname[0]}.</span>
                {score !== null && <ScoreChip score={score} />}
                {batchCount > 1 && (
                  <span className="text-[9px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-bold">
                    {batchCount} Touren
                  </span>
                )}
              </div>
              {score !== null && <ScoreBar score={score} />}
            </div>

            <div className="shrink-0 text-right space-y-0.5">
              {total > 0 && (
                <div className="flex items-center gap-0.5 text-[10px]">
                  <CheckCircle2 size={9} className="text-matcha-500" />
                  <span className="font-mono font-bold">{done}/{total}</span>
                </div>
              )}
              {remainMin !== null && (
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock size={9} />
                  <span className="font-mono">{remainMin} Min</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
