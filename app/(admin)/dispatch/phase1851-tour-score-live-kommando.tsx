'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, Bike, CheckCircle2, Clock, MapPin, Route, Star, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 1851 — Tour-Score Live-Kommando (Dispatch)
 *
 * Echtzeit-Ansicht aller aktiven Touren mit:
 * - Tour-Score (0–100) mit Farbkodierung
 * - Fortschrittsvisualisierung (Stops erledigt / gesamt)
 * - Fahrer-Score und Live-Status
 * - Empfehlungen für Dispatcher
 */

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  score?: number | null;
  status?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Stop {
  id: string;
  batch_id: string;
  status: string;
  position?: number;
  address?: string | null;
  eta?: string | null;
}

interface Batch {
  id: string;
  driver_id: string | null;
  status: string;
  created_at: string;
  order_count?: number | null;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  stops: Stop[];
}

interface TourEntry {
  batchId: string;
  driver: Driver | null;
  tourScore: number;
  stopsTotal: number;
  stopsDone: number;
  stopsLeft: number;
  pct: number;
  status: string;
  scoreLabel: string;
  scoreColor: string;
  empfehlung: string;
  laufzeitMin: number;
}

function berechneTourScore(batch: Batch, stops: Stop[], driver: Driver | null): number {
  const done = stops.filter((s) => s.status === 'delivered' || s.status === 'geliefert').length;
  const total = stops.length || 1;
  const completionPct = done / total;

  const driverScore = (driver?.score ?? 75) / 100;
  const laufzeitMin = (Date.now() - new Date(batch.created_at).getTime()) / 60_000;
  const laufzeitPenalty = Math.min(0.3, Math.max(0, (laufzeitMin - 30) / 100));

  return Math.round(Math.max(0, Math.min(100, (completionPct * 50 + driverScore * 40 - laufzeitPenalty * 20) * 100 / 90)));
}

function useAktivTouren(drivers: Driver[], batches: Batch[], stops: Stop[]): TourEntry[] {
  return useMemo(() => {
    const aktivBatches = batches.filter((b) => ['aktiv', 'unterwegs', 'in_progress'].includes(b.status));
    return aktivBatches.map((batch) => {
      const batchStops = stops.filter((s) => s.batch_id === batch.id);
      const driver = drivers.find((d) => d.id === batch.driver_id) ?? null;
      const done = batchStops.filter((s) => ['delivered', 'geliefert', 'abgeschlossen'].includes(s.status)).length;
      const total = batchStops.length || (batch.order_count ?? 1);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const tourScore = berechneTourScore(batch, batchStops, driver);
      const laufzeitMin = Math.round((Date.now() - new Date(batch.created_at).getTime()) / 60_000);

      let scoreLabel: string;
      let scoreColor: string;
      if (tourScore >= 80) { scoreLabel = 'Exzellent'; scoreColor = 'text-matcha-600'; }
      else if (tourScore >= 60) { scoreLabel = 'Gut'; scoreColor = 'text-green-600'; }
      else if (tourScore >= 40) { scoreLabel = 'Mittel'; scoreColor = 'text-amber-600'; }
      else { scoreLabel = 'Kritisch'; scoreColor = 'text-red-600'; }

      let empfehlung: string;
      if (tourScore < 40) empfehlung = 'Fahrer kontaktieren';
      else if (pct === 0 && laufzeitMin > 10) empfehlung = 'Tour läuft — erste Lieferung bald';
      else if (pct >= 100) empfehlung = 'Tour abgeschlossen';
      else empfehlung = `${total - done} Stopp${total - done !== 1 ? 's' : ''} verbleibend`;

      return {
        batchId: batch.id,
        driver,
        tourScore,
        stopsTotal: total,
        stopsDone: done,
        stopsLeft: total - done,
        pct,
        status: batch.status,
        scoreLabel,
        scoreColor,
        empfehlung,
        laufzeitMin,
      };
    }).sort((a, b) => a.tourScore - b.tourScore);
  }, [drivers, batches, stops]);
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = (Math.min(score, 100) / 100) * C;
  const colorMap: Record<string, string> = {
    'text-matcha-600': '#4d7c5f',
    'text-green-600': '#16a34a',
    'text-amber-600': '#d97706',
    'text-red-600': '#dc2626',
  };
  const stroke = colorMap[color] ?? '#4d7c5f';

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx="30" cy="30" r={R} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="30" cy="30" r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xs font-black tabular-nums', color)}>{score}</span>
      </div>
    </div>
  );
}

export function DispatchTourScoreLiveKommando({ drivers, batches, stops }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const touren = useAktivTouren(drivers, batches, stops);

  if (touren.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
        <Route className="h-6 w-6 mx-auto mb-2 opacity-40" />
        Keine aktiven Touren
      </div>
    );
  }

  const avgScore = Math.round(touren.reduce((s, t) => s + t.tourScore, 0) / touren.length);
  const kritisch = touren.filter((t) => t.tourScore < 40).length;

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-xs font-bold uppercase tracking-wider">
            Tour-Score Live
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className={cn('rounded-full px-2 py-0.5', avgScore >= 60 ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700')}>
            Ø {avgScore}
          </span>
          {kritisch > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 animate-pulse">
              {kritisch} krit.
            </span>
          )}
        </div>
      </div>

      {/* Tour Cards */}
      <div className="p-3 space-y-2">
        {touren.map((t) => (
          <div
            key={t.batchId}
            className={cn(
              'rounded-lg border p-3 transition-all',
              t.tourScore < 40
                ? 'bg-red-50 border-red-200'
                : t.tourScore < 60
                ? 'bg-amber-50 border-amber-200'
                : 'bg-card border-border',
            )}
          >
            <div className="flex items-center gap-3">
              <ScoreRing score={t.tourScore} color={t.scoreColor} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-xs truncate">
                      {t.driver ? `${t.driver.vorname} ${t.driver.nachname}` : 'Kein Fahrer'}
                    </span>
                  </div>
                  <span className={cn('text-[10px] font-bold', t.scoreColor)}>{t.scoreLabel}</span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        t.pct === 100 ? 'bg-matcha-500' : t.pct >= 50 ? 'bg-green-500' : 'bg-amber-400'
                      )}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                    {t.stopsDone}/{t.stopsTotal}
                  </span>
                </div>

                {/* Empfehlung + Laufzeit */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">{t.empfehlung}</span>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    {t.laufzeitMin} Min
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
