'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Route, Trophy, TrendingUp, Zap } from 'lucide-react';

type TourRow = {
  batchId: string;
  driverName: string;
  score: number;
  totalStops: number;
  completedStops: number;
  elapsedMin: number;
  remainMin: number | null;
  onTime: boolean;
  avgStopMin: number | null;
};

function scoreColor(s: number) {
  if (s >= 85) return { text: 'text-accent',   bg: 'bg-accent/15',   ring: 'ring-accent/30' };
  if (s >= 65) return { text: 'text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-amber-400/30' };
  return { text: 'text-red-400', bg: 'bg-red-400/10', ring: 'ring-red-400/30' };
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  return (
    <div className={cn('relative h-10 w-10 flex items-center justify-center rounded-full ring-1', c.bg, c.ring)}>
      <svg className="absolute inset-0 -rotate-90" width={40} height={40}>
        <circle cx={20} cy={20} r={r} fill="none" stroke="currentColor" strokeWidth={2.5}
          className="text-white/5" />
        <circle cx={20} cy={20} r={r} fill="none" stroke="currentColor" strokeWidth={2.5}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={cn('transition-all duration-1000', c.text)} />
      </svg>
      <span className={cn('relative text-[11px] font-black tabular-nums', c.text)}>
        {score}
      </span>
    </div>
  );
}

export function DispatchPhase1470TourLiveScoreBoard({
  batches,
  stops,
  drivers,
}: {
  batches: { id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }[];
  stops: { id: string; batch_id: string; order_id: string; reihenfolge: number; angekommen_am: string | null; geliefert_am: string | null }[];
  drivers: { id: string; vorname: string; nachname: string; status: { aktueller_batch_id: string | null } | null }[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const activeBatches = batches.filter(b =>
    ['pickup', 'aktiv', 'unterwegs', 'on_route', 'assigned', 'at_restaurant'].includes(b.status),
  );

  const rows: TourRow[] = activeBatches
    .map(b => {
      const driver = drivers.find(d => d.id === b.driver_id);
      const driverName = driver ? `${driver.vorname} ${driver.nachname}` : 'Unbekannt';
      const bStops = stops.filter(s => s.batch_id === b.id);
      const totalStops = bStops.length;
      const completedStops = bStops.filter(s => !!s.geliefert_am).length;

      const elapsedMin = b.started_at
        ? Math.max(0, Math.floor((now - new Date(b.started_at).getTime()) / 60_000))
        : 0;
      const etaMin = b.total_eta_min ?? null;
      const remainMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;

      const completedWithTimes = bStops.filter(s => s.angekommen_am && s.geliefert_am);
      const avgStopMin = completedWithTimes.length > 0
        ? completedWithTimes.reduce((acc, s) => {
            const t = (new Date(s.geliefert_am!).getTime() - new Date(s.angekommen_am!).getTime()) / 60_000;
            return acc + t;
          }, 0) / completedWithTimes.length
        : null;

      const progressRatio = totalStops > 0 ? completedStops / totalStops : 0;
      const timeRatio = etaMin && etaMin > 0 ? Math.min(1, elapsedMin / etaMin) : 0;
      const onTime = timeRatio <= progressRatio + 0.1;

      // Score: 100 base, penalize time overruns and avg stop time > 3min
      let score = 100;
      if (etaMin && elapsedMin > etaMin) score -= Math.min(40, Math.round(((elapsedMin - etaMin) / etaMin) * 60));
      if (!onTime) score -= 15;
      if (avgStopMin !== null && avgStopMin > 4) score -= Math.min(20, Math.round((avgStopMin - 4) * 5));
      score = Math.max(0, Math.min(100, score));

      return { batchId: b.id, driverName, score, totalStops, completedStops, elapsedMin, remainMin, onTime, avgStopMin };
    })
    .sort((a, b) => b.score - a.score);

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Tour-Score Live-Board
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {rows.length} aktiv
        </Badge>
      </div>

      <div className="divide-y">
        {rows.map((row, idx) => {
          const c = scoreColor(row.score);
          return (
            <div key={row.batchId} className="flex items-center gap-3 px-4 py-3">
              {/* Rank */}
              <div className={cn(
                'shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black',
                idx === 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-muted text-muted-foreground',
              )}>
                {idx + 1}
              </div>

              {/* Score ring */}
              <ScoreRing score={row.score} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.onTime && (
                    <span className="text-[9px] text-accent font-bold flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" />Pünktlich
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        row.score >= 85 ? 'bg-accent' : row.score >= 65 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${row.totalStops > 0 ? (row.completedStops / row.totalStops) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-black tabular-nums">
                  {row.elapsedMin}m
                </div>
                {row.remainMin !== null && (
                  <div className="text-[9px] text-muted-foreground">
                    ~{row.remainMin}m left
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
