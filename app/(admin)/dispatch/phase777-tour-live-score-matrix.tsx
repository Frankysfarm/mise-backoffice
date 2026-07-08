'use client';

import React, { useEffect, useState } from 'react';
import { Bike, Clock, MapPin, Route, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type Batch = {
  id: string;
  fahrer_id?: string | null;
  zone?: string | null;
  status?: string;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops?: {
    id: string;
    reihenfolge: number;
    angekommen_am?: string | null;
    geliefert_am?: string | null;
    order?: { kunde_name?: string | null; kunde_adresse?: string | null } | null;
  }[];
  fahrer?: { vorname?: string; nachname?: string } | null;
};

interface Props {
  batches: Batch[];
}

function calcScore(batch: Batch, now: number): number {
  const total = batch.stops?.length ?? 0;
  const done = batch.stops?.filter((s) => s.geliefert_am).length ?? 0;
  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
  const eta = batch.total_eta_min ?? 30;

  const progressPct = total > 0 ? done / total : 0;
  const timePct = eta > 0 ? elapsedMin / eta : 0;

  // Score: höher = besser. Strafe wenn Zeit-% > Fortschritt-%
  const delta = progressPct - timePct;
  const base = 50 + delta * 100;
  return Math.max(0, Math.min(100, Math.round(base)));
}

export function DispatchPhase777TourLiveScoreMatrix({ batches }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const active = batches.filter(
    (b) => b.status === 'unterwegs' || b.status === 'aktiv' || b.status === 'in_delivery',
  );

  if (active.length === 0) return null;

  const rows = active
    .map((b) => {
      const score = calcScore(b, now);
      const total = b.stops?.length ?? 0;
      const done = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
      const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
      const remainMin =
        b.total_eta_min !== null && b.total_eta_min !== undefined
          ? Math.max(0, b.total_eta_min - elapsedMin)
          : null;
      const driverName = b.fahrer
        ? `${b.fahrer.vorname ?? ''} ${(b.fahrer.nachname ?? '')[0] ?? ''}.`.trim()
        : 'Fahrer';

      const health: 'on-time' | 'tight' | 'late' =
        score >= 55 ? 'on-time' : score >= 35 ? 'tight' : 'late';

      return { b, score, total, done, elapsedMin, remainMin, driverName, health };
    })
    .sort((a, b) => a.score - b.score); // Schlechteste zuerst

  const styleMap = {
    'on-time': { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500' },
    tight:     { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-400 text-white',  bar: 'bg-amber-400' },
    late:      { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-500 text-white',    bar: 'bg-red-500'   },
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Phase 777 · Tour Live-Score-Matrix
        </span>
        <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[9px] font-black text-matcha-700">
          {active.length} aktiv
        </span>
      </div>

      <div className="divide-y">
        {rows.map(({ b, score, total, done, elapsedMin, remainMin, driverName, health }) => {
          const s = styleMap[health];
          const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
          const stars = Math.round((score / 100) * 5);

          return (
            <div key={b.id} className={cn('px-4 py-3', s.bg)}>
              <div className="flex items-center gap-3">
                {/* Score badge */}
                <div className={cn('shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm', s.badge)}>
                  {score}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-bold truncate">{driverName}</span>
                    {b.zone && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                        Zone {b.zone}
                      </span>
                    )}
                    {/* Stars */}
                    <span className="ml-auto flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn('h-2.5 w-2.5', i < stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')}
                        />
                      ))}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                      {done}/{total} Stopps
                    </span>
                  </div>
                </div>

                {/* Time info */}
                <div className="shrink-0 text-right space-y-0.5">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="font-mono text-xs font-black tabular-nums">{elapsedMin}m</span>
                  </div>
                  {remainMin !== null && (
                    <div className={cn('text-[9px] font-bold tabular-nums', health === 'late' ? 'text-red-600' : 'text-muted-foreground')}>
                      ~{remainMin}m zurück
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
