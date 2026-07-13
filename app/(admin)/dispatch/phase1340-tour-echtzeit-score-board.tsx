'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Route, Star, TrendingDown, TrendingUp, Zap,
} from 'lucide-react';

/**
 * Phase 1340 — Tour-Echtzeit-Score-Board (Dispatch)
 *
 * Live-Visualisierung aller aktiven Touren mit:
 * — Tour-Score (Effizienz + Pünktlichkeit + Kunden-Score)
 * — Stop-Fortschritt mit ETA-Ampel
 * — Fahrernamen + Zone
 * — Sortierung nach Score (schlechteste zuerst für sofortige Intervention)
 * — Farbkodierung: Rot < 60, Orange 60–75, Grün ≥ 75
 *
 * Datenquelle: Props (batches + drivers aus Dispatch-Client)
 * Mock-Fallback wenn keine Props
 */

interface Stop {
  id: string;
  status?: string | null;
  position?: number | null;
  eta?: string | null;
  kunde_name?: string | null;
  delivered_at?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  zone?: string | null;
  abgeholt_am?: string | null;
  erstellt_am?: string | null;
  dispatch_score?: number | null;
  stops?: Stop[] | null;
  eta_minutes?: number | null;
  driver?: {
    employee?: {
      vorname?: string | null;
      nachname?: string | null;
    } | null;
  } | null;
}

interface Driver {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id?: string | null;
  employee?: {
    vorname?: string | null;
    nachname?: string | null;
  } | null;
}

interface Props {
  batches?: Batch[];
  drivers?: Driver[];
  locationId?: string | null;
}

type ScoreTier = 'low' | 'mid' | 'high';

function getScoreTier(score: number): ScoreTier {
  if (score < 60) return 'low';
  if (score < 75) return 'mid';
  return 'high';
}

const SCORE_CFG: Record<ScoreTier, { bg: string; badge: string; border: string; label: string; icon: React.ReactNode }> = {
  low:  { bg: 'bg-red-50 dark:bg-red-950/20',    badge: 'bg-red-600 text-white',    border: 'border-l-4 border-l-red-500',    label: 'SCHWACH',   icon: <TrendingDown className="h-3 w-3" /> },
  mid:  { bg: 'bg-amber-50 dark:bg-amber-950/20', badge: 'bg-amber-500 text-white',  border: 'border-l-4 border-l-amber-400',  label: 'MITTEL',    icon: <AlertTriangle className="h-3 w-3" /> },
  high: { bg: 'bg-matcha-50 dark:bg-matcha-950/20', badge: 'bg-matcha-600 text-white', border: 'border-l-4 border-l-matcha-500', label: 'TOP',     icon: <TrendingUp className="h-3 w-3" /> },
};

// Fallback mock data so the component is always visible even without real data
const MOCK_BATCHES: Batch[] = [
  {
    id: 'mock-1', status: 'unterwegs', zone: 'A', abgeholt_am: new Date(Date.now() - 18 * 60_000).toISOString(),
    dispatch_score: 54, eta_minutes: 8,
    driver: { employee: { vorname: 'Max', nachname: 'Müller' } },
    stops: [
      { id: 's1', status: 'geliefert', position: 1, kunde_name: 'K. Huber' },
      { id: 's2', status: 'unterwegs', position: 2, kunde_name: 'S. Klar' },
    ],
  },
  {
    id: 'mock-2', status: 'unterwegs', zone: 'B', abgeholt_am: new Date(Date.now() - 9 * 60_000).toISOString(),
    dispatch_score: 72, eta_minutes: 14,
    driver: { employee: { vorname: 'Anna', nachname: 'Bauer' } },
    stops: [
      { id: 's3', status: 'unterwegs', position: 1, kunde_name: 'P. Stein' },
      { id: 's4', status: 'ausstehend', position: 2, kunde_name: 'M. Vogel' },
      { id: 's5', status: 'ausstehend', position: 3, kunde_name: 'L. Fox' },
    ],
  },
  {
    id: 'mock-3', status: 'unterwegs', zone: 'C', abgeholt_am: new Date(Date.now() - 5 * 60_000).toISOString(),
    dispatch_score: 88, eta_minutes: 22,
    driver: { employee: { vorname: 'Tim', nachname: 'Koch' } },
    stops: [
      { id: 's6', status: 'ausstehend', position: 1, kunde_name: 'A. Weiß' },
    ],
  },
];

export function DispatchPhase1340TourEchtzeitScoreBoard({ batches = [], drivers = [] }: Props) {
  const [tick, setTick] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const activeBatches = batches.filter((b) => b.status === 'unterwegs');
  const displayBatches = activeBatches.length > 0 ? activeBatches : MOCK_BATCHES;
  const isMock = activeBatches.length === 0;

  type Row = {
    batch: Batch;
    driverName: string;
    score: number;
    tier: ScoreTier;
    completedStops: number;
    totalStops: number;
    elapsedMin: number;
    progressPct: number;
  };

  const rows: Row[] = displayBatches.map((batch) => {
    // Resolve driver name from batch or from drivers array
    let driverName = 'Fahrer';
    if (batch.driver?.employee?.vorname) {
      driverName = `${batch.driver.employee.vorname} ${batch.driver.employee.nachname ?? ''}`.trim();
    } else {
      const drv = drivers.find((d) => d.employee_id === batch.fahrer_id);
      if (drv?.employee) {
        driverName = `${drv.employee.vorname ?? ''} ${drv.employee.nachname ?? ''}`.trim();
      }
    }

    const stops = batch.stops ?? [];
    const completedStops = stops.filter((s) => s.status === 'geliefert').length;
    const totalStops = stops.length;

    const startMs = batch.abgeholt_am ? new Date(batch.abgeholt_am).getTime() : Date.now();
    const elapsedMin = Math.round((Date.now() - startMs) / 60_000);

    const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

    const score = batch.dispatch_score ?? 70;
    const tier = getScoreTier(score);

    return { batch, driverName, score, tier, completedStops, totalStops, elapsedMin, progressPct };
  });

  // Sort: lowest score first (needs most attention)
  rows.sort((a, b) => a.score - b.score);

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
  const lowCount = rows.filter((r) => r.tier === 'low').length;

  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b border-border',
        lowCount > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-background',
      )}>
        <Route className={cn('h-4 w-4 shrink-0', lowCount > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Tour-Score Board · {rows.length} aktiv{isMock && ' (Demo)'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {lowCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              <Zap className="h-2.5 w-2.5" />
              {lowCount} Intervention
            </span>
          )}
          <div className="text-right">
            <div className={cn(
              'text-sm font-black tabular-nums',
              avgScore < 60 ? 'text-red-600' : avgScore < 75 ? 'text-amber-600' : 'text-matcha-700',
            )}>
              Ø {avgScore}
            </div>
            <div className="text-[9px] text-muted-foreground">Score</div>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50">
        {rows.map(({ batch, driverName, score, tier, completedStops, totalStops, elapsedMin, progressPct }) => {
          const cfg = SCORE_CFG[tier];
          const nextStop = (batch.stops ?? []).find((s) => s.status === 'unterwegs' || s.status === 'ausstehend');

          return (
            <div key={batch.id} className={cn('px-4 py-3', cfg.bg, cfg.border)}>
              <div className="flex items-center gap-3">
                {/* Score badge */}
                <div className={cn(
                  'shrink-0 flex flex-col items-center rounded-xl px-2.5 py-1.5 min-w-[52px]',
                  cfg.badge,
                )}>
                  <span className="text-lg font-black tabular-nums leading-tight">{score}</span>
                  <span className="text-[8px] font-bold leading-tight opacity-90">{cfg.label}</span>
                </div>

                {/* Tour info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Bike className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-bold truncate">{driverName}</span>
                    </div>
                    {batch.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 dark:bg-black/20 border px-1.5 py-0.5 font-bold">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      <Clock className="inline h-2.5 w-2.5" /> {elapsedMin} Min
                    </span>
                  </div>

                  {/* Stop progress */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          tier === 'low' ? 'bg-red-500' : tier === 'mid' ? 'bg-amber-400' : 'bg-matcha-500',
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {completedStops}/{totalStops} Stopps
                    </span>
                  </div>

                  {/* Next stop */}
                  {nextStop?.kunde_name && (
                    <div className="mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate">
                        Nächster: {nextStop.kunde_name}
                        {batch.eta_minutes != null && (
                          <span className="ml-1 font-bold">
                            (~{batch.eta_minutes} Min)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Score stars */}
                <div className="shrink-0 flex flex-col items-center gap-0.5">
                  {[...Array(3)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-3 w-3',
                        i < Math.ceil(score / 33.4)
                          ? tier === 'low' ? 'text-red-400 fill-red-400' : tier === 'mid' ? 'text-amber-400 fill-amber-400' : 'text-matcha-500 fill-matcha-500'
                          : 'text-border fill-border',
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-matcha-500" />
          Keine aktiven Touren
        </div>
      )}
    </div>
  );
}
