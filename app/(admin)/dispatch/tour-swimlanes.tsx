'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Star, AlertTriangle, Zap } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  driver_id: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  dispatch_score?: number | null;
  zone?: string | null;
  driver?: { vorname: string; nachname: string } | null;
  stops?: BatchStop[];
};

interface Props {
  batches: Batch[];
}

function useTick(ms = 5000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

type Health = 'on-track' | 'tight' | 'late' | 'unknown';

function getHealth(batch: Batch, now: number): { health: Health; elapsedMin: number; remainMin: number | null; progressPct: number } {
  if (!batch.started_at || !batch.total_eta_min) {
    return { health: 'unknown', elapsedMin: 0, remainMin: null, progressPct: 0 };
  }
  const startMs = new Date(batch.started_at).getTime();
  const elapsedMin = (now - startMs) / 60_000;
  const totalMin = batch.total_eta_min;
  const remainMin = Math.max(0, totalMin - elapsedMin);
  const progressPct = Math.min(100, (elapsedMin / totalMin) * 100);

  const stops = batch.stops ?? [];
  const done = stops.filter((s) => s.geliefert_am).length;
  const total = stops.length;
  const stopProgressPct = total > 0 ? (done / total) * 100 : 0;

  let health: Health;
  if (elapsedMin > totalMin * 1.15) health = 'late';
  else if (stopProgressPct < progressPct - 20) health = 'tight';
  else health = 'on-track';

  return { health, elapsedMin, remainMin, progressPct };
}

const HEALTH_CONFIG: Record<Health, { bg: string; border: string; bar: string; label: string; text: string }> = {
  'on-track': { bg: 'bg-matcha-50', border: 'border-matcha-200', bar: 'bg-matcha-500', label: 'Planmäßig', text: 'text-matcha-700' },
  'tight':    { bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-400',  label: 'Knapp',      text: 'text-amber-700'  },
  'late':     { bg: 'bg-red-50',    border: 'border-red-200',    bar: 'bg-red-500',    label: 'Verspätet',  text: 'text-red-700'    },
  'unknown':  { bg: 'bg-muted/40',  border: 'border-border',     bar: 'bg-muted',      label: 'Unbekannt',  text: 'text-muted-foreground' },
};

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-matcha-100 text-matcha-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', color)}>
      <Star size={8} className="inline" /> {score}
    </span>
  );
}

export function DispatchTourSwimlanes({ batches }: Props) {
  useTick();
  const now = Date.now();

  const activeBatches = batches.filter(
    (b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned',
  );

  if (activeBatches.length === 0) return null;

  const lateCount = activeBatches.filter((b) => getHealth(b, now).health === 'late').length;
  const tightCount = activeBatches.filter((b) => getHealth(b, now).health === 'tight').length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2',
        lateCount > 0 ? 'bg-red-600' : tightCount > 0 ? 'bg-amber-500' : 'bg-matcha-600',
      )}>
        <Zap className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Tour-Swimlanes · {activeBatches.length} aktiv
        </span>
        {lateCount > 0 && (
          <span className="ml-auto text-[10px] font-bold text-white bg-white/20 rounded-full px-2 py-0.5">
            {lateCount} verspätet
          </span>
        )}
      </div>

      {/* Lanes */}
      <div className="divide-y divide-border">
        {activeBatches.map((batch) => {
          const { health, elapsedMin, remainMin, progressPct } = getHealth(batch, now);
          const cfg = HEALTH_CONFIG[health];
          const stops = batch.stops ?? [];
          const doneCnt = stops.filter((s) => s.geliefert_am).length;
          const totalCnt = stops.length;
          const driverName = batch.driver
            ? `${batch.driver.vorname} ${batch.driver.nachname[0]}.`
            : 'Fahrer?';

          return (
            <div key={batch.id} className={cn('p-3 space-y-2', cfg.bg)}>
              {/* Top row: driver + score + health badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Bike size={13} className={cfg.text} />
                <span className="text-xs font-bold">{driverName}</span>
                {batch.zone && (
                  <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                    Zone {batch.zone}
                  </span>
                )}
                <ScoreBadge score={batch.dispatch_score} />
                <span className={cn('ml-auto text-[9px] font-bold rounded-full px-1.5 py-0.5 border', cfg.text, cfg.border, cfg.bg)}>
                  {cfg.label}
                </span>
              </div>

              {/* Progress bar — time */}
              <div>
                <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                  <span>
                    <Clock size={9} className="inline mr-0.5" />
                    {Math.round(elapsedMin)} Min
                  </span>
                  <span>
                    {remainMin !== null ? `~${Math.round(remainMin)} Min verbl.` : '—'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', cfg.bar)}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Stop dots */}
              {totalCnt > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MapPin size={10} className="text-muted-foreground shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {stops
                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                      .map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                            s.geliefert_am
                              ? 'bg-matcha-500 border-matcha-600'
                              : s.angekommen_am
                              ? 'bg-amber-400 border-amber-500'
                              : 'bg-white border-muted-foreground/30',
                          )}
                        >
                          {s.geliefert_am && <CheckCircle2 size={8} className="text-white" />}
                          {s.angekommen_am && !s.geliefert_am && (
                            <AlertTriangle size={7} className="text-amber-700" />
                          )}
                        </div>
                      ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium ml-auto">
                    {doneCnt}/{totalCnt} Stopps
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
