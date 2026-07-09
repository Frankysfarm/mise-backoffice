'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Clock, TrendingUp, AlertTriangle, CheckCircle2, MapPin, Bike } from 'lucide-react';

type Batch = {
  id: string;
  status?: string;
  zone?: string | null;
  tour_start_at?: string | null;
  estimated_end_at?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  fahrer_id?: string | null;
  orders?: Array<{ id: string; status?: string }>;
};

type Props = {
  batches: Batch[];
  locationId?: string | null;
};

type TourHealth = 'late' | 'tight' | 'on-time' | 'unknown';

const HEALTH_STYLE: Record<TourHealth, {
  bg: string; border: string; dot: string; label: string; score: number; barColor: string;
}> = {
  late:      { bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'Verspätet',  score: 20,  barColor: 'bg-red-400' },
  tight:     { bg: 'bg-amber-50 dark:bg-amber-950/30',border: 'border-amber-200',  dot: 'bg-amber-400',  label: 'Knapp',      score: 55,  barColor: 'bg-amber-400' },
  'on-time': { bg: 'bg-matcha-50 dark:bg-matcha-950/20',border:'border-matcha-200',dot: 'bg-matcha-500', label: 'Pünktlich',  score: 90,  barColor: 'bg-matcha-500' },
  unknown:   { bg: 'bg-muted/20',                      border: 'border-border',     dot: 'bg-muted-foreground', label: 'Unbekannt', score: 50, barColor: 'bg-muted-foreground' },
};

function computeHealth(batch: Batch, nowMs: number): { health: TourHealth; progressPct: number; remainMin: number | null; elapsedMin: number } {
  const startMs = batch.tour_start_at ? new Date(batch.tour_start_at).getTime() : null;
  const endMs   = batch.estimated_end_at ? new Date(batch.estimated_end_at).getTime() : null;
  const orders  = batch.orders ?? [];
  const total   = orders.length;
  const completed = orders.filter(o => ['geliefert', 'abgeholt'].includes(o.status ?? '')).length;

  const elapsedMin = startMs ? Math.round((nowMs - startMs) / 60_000) : 0;
  let remainMin: number | null = null;

  if (endMs) remainMin = Math.max(0, Math.round((endMs - nowMs) / 60_000));

  let health: TourHealth = 'unknown';
  if (startMs && endMs) {
    const etaMin = (endMs - startMs) / 60_000;
    const usedPct = etaMin > 0 ? elapsedMin / etaMin : 0;
    const donePct = total > 0 ? completed / total : 0;
    if (usedPct - donePct > 0.35) health = 'late';
    else if (usedPct - donePct > 0.12) health = 'tight';
    else health = 'on-time';
  } else if (startMs) {
    health = elapsedMin > 45 ? 'late' : 'on-time';
  }

  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { health, progressPct, remainMin, elapsedMin };
}

function ScoreMeter({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="36" height="36" viewBox="0 0 36 36" className="rotate-[-90deg]">
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
        <circle
          cx="18" cy="18" r="14"
          fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={`${(score / 100) * 87.96} 87.96`}
          strokeLinecap="round"
          className={color}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="text-[9px] font-black tabular-nums -mt-9 rotate-0 relative z-10 text-center" style={{ lineHeight: '36px' }}>
        {score}
      </span>
    </div>
  );
}

export function DispatchPhase878TourScoreLiveKarte({ batches, locationId: _locationId }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();

  const activeBatches = batches.filter(b =>
    b.fahrer_id && ['aktiv', 'unterwegs', 'gestartet'].includes(b.status ?? ''),
  );

  if (activeBatches.length === 0) return null;

  const enriched = activeBatches.map(b => ({
    batch: b,
    ...computeHealth(b, nowMs),
  })).sort((a, b) => {
    const order: TourHealth[] = ['late', 'tight', 'on-time', 'unknown'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const lateCount   = enriched.filter(e => e.health === 'late').length;
  const onTimeCount = enriched.filter(e => e.health === 'on-time').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-dispatch-phase="878">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Tour-Score Live-Karte
        </span>
        <div className="flex gap-1.5 ml-auto">
          {lateCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
              {lateCount} verspätet
            </span>
          )}
          <span className="rounded-full bg-matcha-100 text-matcha-800 text-[9px] font-bold px-2 py-0.5">
            {onTimeCount}/{enriched.length} pünktlich
          </span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y">
        {enriched.map(({ batch, health, progressPct, remainMin, elapsedMin }) => {
          const hs = HEALTH_STYLE[health];
          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname ?? ''} ${batch.fahrer.nachname ?? ''}`.trim()
            : 'Unbekannt';
          const orders  = batch.orders ?? [];
          const total   = orders.length;
          const done    = orders.filter(o => ['geliefert', 'abgeholt'].includes(o.status ?? '')).length;

          return (
            <div key={batch.id} className={cn('px-4 py-3', hs.bg, 'border-l-4', hs.border)}>
              <div className="flex items-center gap-3">
                {/* Score meter */}
                <div className={cn('shrink-0', hs.dot === 'bg-red-500' ? 'text-red-400' : hs.dot === 'bg-amber-400' ? 'text-amber-400' : 'text-matcha-500')}>
                  <ScoreMeter score={hs.score} color={hs.dot === 'bg-red-500' ? 'text-red-400' : hs.dot === 'bg-amber-400' ? 'text-amber-400' : 'text-matcha-500'} />
                </div>

                {/* Tour info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Bike className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-bold truncate max-w-[100px]">{driverName}</span>
                    </div>
                    {batch.zone && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className={cn(
                      'ml-auto text-[9px] font-black px-2 py-0.5 rounded-full text-white shrink-0',
                      hs.dot,
                    )}>
                      {hs.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', hs.barColor)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {done}/{total} Stopps
                    </span>
                  </div>
                </div>

                {/* Time display */}
                <div className="shrink-0 text-right min-w-[48px]">
                  {remainMin !== null ? (
                    <>
                      <div className={cn(
                        'font-mono text-sm font-black tabular-nums',
                        health === 'late' ? 'text-red-600' : health === 'tight' ? 'text-amber-600' : 'text-matcha-700',
                      )}>
                        {remainMin}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">verbleibend</div>
                    </>
                  ) : (
                    <>
                      <div className="font-mono text-sm font-black tabular-nums text-foreground">
                        {elapsedMin}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">vergangen</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-matcha-600" />
          <span>Ø Score: {Math.round(enriched.reduce((s, e) => s + HEALTH_STYLE[e.health].score, 0) / enriched.length)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>{enriched.reduce((s, e) => s + (e.batch.orders?.length ?? 0), 0)} Stopps gesamt</span>
        </div>
        <div className="ml-auto text-[9px] opacity-60">Aktualisiert alle 10s</div>
      </div>
    </div>
  );
}
