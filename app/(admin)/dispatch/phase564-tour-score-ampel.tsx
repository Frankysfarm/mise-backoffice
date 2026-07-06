'use client';

/**
 * Phase 564 — Dispatch: Tour-Score-Echtzeit-Ampel
 *
 * Zeigt den aktuellen Score-Status aller aktiven Fahrerbatches als
 * kompakte Ampelkacheln. Farbkodierung nach Score-Niveau:
 *
 *   Exzellent  (≥ 85)  → dunkel-grün
 *   Gut        (70–84) → grün
 *   OK         (50–69) → amber
 *   Schwach    (< 50)  → rot
 *
 * Score ergibt sich aus: Pünktlichkeit × Stopp-Fortschritt × Pace-Faktor.
 * Kein API nötig — berechnet sich live aus batch/stops-Props.
 *
 * Polling: 15s Ticker für Countdown-Aktualisierung
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Gauge, MapPin, TrendingUp, User } from 'lucide-react';

interface Stop {
  geliefert_am: string | null;
  order?: { bestellnummer?: string } | null;
}

interface Driver {
  id: string;
  vorname?: string;
  nachname?: string;
}

interface Batch {
  id: string;
  status: string;
  zone?: string | null;
  total_eta_min?: number | null;
  startzeit?: string | null;
  started_at?: string | null;
  driver_id?: string | null;
  fahrer_id?: string | null;
  stops: Stop[];
  fahrer?: { vorname?: string; nachname?: string } | null;
}

interface Props {
  batches: Batch[];
  drivers?: Driver[];
}

type ScoreTier = 'excellent' | 'good' | 'ok' | 'weak';

interface TourScore {
  batch: Batch;
  driverName: string;
  score: number;
  tier: ScoreTier;
  completedStops: number;
  totalStops: number;
  elapsedMin: number;
  remainMin: number | null;
  progressPct: number;
}

const TIER_CONFIG: Record<ScoreTier, {
  bg: string; border: string; text: string; scoreText: string;
  barColor: string; badge: string; label: string;
}> = {
  excellent: {
    bg: 'bg-matcha-50', border: 'border-matcha-300', text: 'text-matcha-800',
    scoreText: 'text-matcha-700', barColor: 'bg-matcha-500',
    badge: 'bg-matcha-600 text-white', label: 'Exzellent',
  },
  good: {
    bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800',
    scoreText: 'text-green-700', barColor: 'bg-green-500',
    badge: 'bg-green-600 text-white', label: 'Gut',
  },
  ok: {
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800',
    scoreText: 'text-amber-700', barColor: 'bg-amber-400',
    badge: 'bg-amber-500 text-white', label: 'OK',
  },
  weak: {
    bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
    scoreText: 'text-red-700', barColor: 'bg-red-400',
    badge: 'bg-red-600 text-white', label: 'Schwach',
  },
};

function scoreTier(score: number): ScoreTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'ok';
  return 'weak';
}

function computeScore(batch: Batch, now: number): number {
  const totalStops    = batch.stops.length;
  const completedStops = batch.stops.filter(s => s.geliefert_am).length;
  const progressFactor = totalStops > 0 ? completedStops / totalStops : 0;

  const startMs = new Date(batch.startzeit ?? batch.started_at ?? '').getTime();
  const isValidStart = !isNaN(startMs);
  const elapsedMin = isValidStart ? (now - startMs) / 60_000 : 0;

  const expectedMinPerStop = 12;
  const expectedElapsed = completedStops * expectedMinPerStop;
  const paceFactor = elapsedMin > 0 && expectedElapsed > 0
    ? Math.min(1, expectedElapsed / elapsedMin)
    : 1;

  const etaMin = batch.total_eta_min;
  let punctualityFactor = 1;
  if (etaMin && isValidStart) {
    const expectedEndMs = startMs + etaMin * 60_000;
    const overduePct = (now - expectedEndMs) / (etaMin * 60_000);
    punctualityFactor = Math.max(0, 1 - Math.max(0, overduePct));
  }

  const rawScore = (progressFactor * 0.4 + paceFactor * 0.3 + punctualityFactor * 0.3) * 100;
  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

export function DispatchPhase564TourScoreAmpel({ batches, drivers = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = useMemo(() =>
    batches.filter(b => b.status === 'unterwegs' || b.status === 'on_route'),
    [batches],
  );

  const tourScores = useMemo<TourScore[]>(() => {
    const now = Date.now();
    return activeBatches.map(batch => {
      const driverId = batch.driver_id ?? batch.fahrer_id;
      const driver   = drivers.find(d => d.id === driverId);
      const fahrer   = batch.fahrer;
      const firstName = driver?.vorname ?? fahrer?.vorname ?? '';
      const lastName  = (driver?.nachname ?? fahrer?.nachname ?? '').charAt(0);
      const driverName = firstName ? `${firstName} ${lastName}.` : 'Fahrer';

      const totalStops    = batch.stops.length;
      const completedStops = batch.stops.filter(s => s.geliefert_am).length;
      const startMs = new Date(batch.startzeit ?? batch.started_at ?? '').getTime();
      const isValidStart = !isNaN(startMs);
      const elapsedMin = isValidStart ? Math.round((now - startMs) / 60_000) : 0;
      const remainMin = batch.total_eta_min && isValidStart
        ? Math.round((startMs + batch.total_eta_min * 60_000 - now) / 60_000)
        : null;

      const score = computeScore(batch, now);
      const tier  = scoreTier(score);

      return {
        batch,
        driverName,
        score,
        tier,
        completedStops,
        totalStops,
        elapsedMin,
        remainMin,
        progressPct: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
      };
    }).sort((a, b) => {
      const tierOrder: ScoreTier[] = ['weak', 'ok', 'good', 'excellent'];
      return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
    });
  }, [activeBatches, drivers]);

  const weakCount = tourScores.filter(t => t.tier === 'weak').length;

  if (activeBatches.length === 0) return null;

  const avgScore = tourScores.length > 0
    ? Math.round(tourScores.reduce((s, t) => s + t.score, 0) / tourScores.length)
    : 0;

  return (
    <Card className={cn('overflow-hidden', weakCount > 0 && 'border-red-200')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          weakCount > 0 ? 'bg-red-100 text-red-700' : 'bg-matcha-100 text-matcha-700',
        )}>
          <Gauge className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Tour-Score Ampel
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              avgScore >= 85 ? 'bg-matcha-600 text-white'
                : avgScore >= 70 ? 'bg-green-600 text-white'
                : avgScore >= 50 ? 'bg-amber-500 text-white'
                : 'bg-red-600 text-white',
            )}>
              Ø {avgScore}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {tourScores.filter(t => t.tier === 'excellent' || t.tier === 'good').length} stark ·{' '}
            {weakCount} schwach · {activeBatches.length} aktiv
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y">
          {tourScores.map(({ batch, driverName, score, tier, completedStops, totalStops, elapsedMin, remainMin, progressPct }) => {
            const cfg = TIER_CONFIG[tier];
            return (
              <div key={batch.id} className={cn('px-4 py-3 flex items-center gap-3', cfg.bg)}>
                {/* Score */}
                <div className="shrink-0 text-center w-12">
                  <div className={cn('text-xl font-black tabular-nums leading-none', cfg.scoreText)}>
                    {score}
                  </div>
                  <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className={cn('h-3 w-3', cfg.text)} />
                      <span className={cn('text-xs font-bold truncate', cfg.text)}>{driverName}</span>
                    </div>
                    {batch.zone && (
                      <div className="flex items-center gap-1">
                        <MapPin className={cn('h-2.5 w-2.5', cfg.text)} />
                        <span className={cn('text-[10px]', cfg.text)}>Zone {batch.zone}</span>
                      </div>
                    )}
                    {remainMin !== null && (
                      <span className={cn(
                        'text-[10px] font-bold tabular-nums',
                        remainMin < 0 ? 'text-red-600' : remainMin < 5 ? 'text-amber-600' : cfg.text,
                      )}>
                        {remainMin < 0 ? `+${Math.abs(remainMin)}m` : `~${remainMin}m`}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className={cn('text-[9px] font-bold tabular-nums shrink-0', cfg.text)}>
                      {completedStops}/{totalStops}
                    </span>
                  </div>
                </div>

                {/* Elapsed */}
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-sm font-black tabular-nums', cfg.scoreText)}>
                    {elapsedMin}m
                  </div>
                  <div className="text-[8px] text-muted-foreground">vergangen</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Score = Pünktlichkeit 30% + Pace 30% + Fortschritt 40%
          </span>
          <Badge variant="outline" className="ml-auto text-[9px] h-4">
            Live · 15s
          </Badge>
        </div>
      )}
    </Card>
  );
}
