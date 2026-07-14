'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Star, TrendingDown, TrendingUp, Trophy, Minus } from 'lucide-react';

// Phase 1505 — Score-Tour-Hub (Dispatch)
// Vereint Score-Anzeige + Tour-Visualisierung in einem Dashboard:
// • Fahrer-Leaderboard mit Live-Score (0–100) + Trend-Pfeil
// • Touren-Fortschrittsbalken je aktiver Tour
// • ETA-Abweichungs-Ampel (grün/gelb/rot)
// Polling alle 30 Sek via Supabase-State-Prop.

interface Stop {
  id: string;
  reihenfolge?: number | null;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  eta_min?: number | null;
  order?: { bestellnummer?: string | null; kunde_name?: string | null } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  employee_id?: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
  fahrer?: { vorname?: string; nachname?: string } | null;
}

interface Driver {
  employee_id: string;
  employee?: { vorname?: string; nachname?: string } | null;
  is_online?: boolean;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function driverName(d: Driver | Batch): string {
  const e = (d as any).fahrer ?? (d as any).employee;
  if (!e) return 'Fahrer';
  return `${e.vorname ?? ''} ${(e.nachname ?? '').charAt(0)}.`.trim();
}

function computeTourScore(batch: Batch, now: number): number {
  const stops = batch.stops ?? [];
  const done = stops.filter((s) => s.geliefert_am).length;
  const total = stops.length || 1;
  const progress = done / total;

  const startMs = batch.startzeit
    ? new Date(batch.startzeit).getTime()
    : batch.started_at
    ? new Date(batch.started_at).getTime()
    : now;

  const etaMs = batch.total_eta_min != null ? startMs + batch.total_eta_min * 60_000 : null;
  let punctuality = 80;
  if (etaMs) {
    const driftMin = (now - etaMs) / 60_000;
    if (driftMin < -10)     punctuality = 100;
    else if (driftMin < 0)  punctuality = 92;
    else if (driftMin < 5)  punctuality = 75;
    else if (driftMin < 15) punctuality = 55;
    else                    punctuality = 35;
  }
  return Math.round(punctuality * 0.55 + progress * 100 * 0.45);
}

function scoreStyle(score: number) {
  if (score >= 85) return { ring: 'text-emerald-700 bg-emerald-50 border-emerald-300', bar: 'bg-emerald-500', badge: 'bg-emerald-500' };
  if (score >= 65) return { ring: 'text-yellow-700 bg-yellow-50 border-yellow-300',  bar: 'bg-yellow-400',  badge: 'bg-yellow-400' };
  if (score >= 45) return { ring: 'text-orange-700 bg-orange-50 border-orange-300',  bar: 'bg-orange-500',  badge: 'bg-orange-500' };
  return             { ring: 'text-red-700 bg-red-50 border-red-300',    bar: 'bg-red-600',    badge: 'bg-red-600' };
}

export function DispatchPhase1505ScoreTourHub({ batches, drivers }: Props) {
  const [, setTick] = useState(0);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = useMemo(
    () => batches.filter((b) => ['unterwegs', 'picking', 'aktiv'].includes(b.status)),
    [batches],
  );

  const tourRows = useMemo(() => {
    const now = Date.now();
    return activeBatches
      .map((b) => {
        const stops = b.stops ?? [];
        const done  = stops.filter((s) => s.geliefert_am).length;
        const total = stops.length;
        const score = computeTourScore(b, now);
        const style = scoreStyle(score);
        const prev  = prevScores[b.id] ?? score;

        const startMs = b.startzeit
          ? new Date(b.startzeit).getTime()
          : b.started_at
          ? new Date(b.started_at).getTime()
          : now;
        const etaMs = b.total_eta_min != null ? startMs + b.total_eta_min * 60_000 : null;
        const etaMinLeft = etaMs ? Math.round((etaMs - now) / 60_000) : null;

        return { batch: b, done, total, score, style, prev, etaMinLeft };
      })
      .sort((a, b) => b.score - a.score);
  }, [activeBatches, prevScores]);

  // snapshot scores for trend arrows
  useEffect(() => {
    const map: Record<string, number> = {};
    tourRows.forEach(({ batch, score }) => { map[batch.id] = score; });
    const t = setTimeout(() => setPrevScores(map), 15_000);
    return () => clearTimeout(t);
  }, [tourRows]);

  const avgScore = tourRows.length
    ? Math.round(tourRows.reduce((s, r) => s + r.score, 0) / tourRows.length)
    : 0;

  const onlineDrivers = drivers.filter((d) => d.is_online !== false).length;

  if (activeBatches.length === 0) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm p-5 text-center text-sm text-stone-400">
        <Bike className="mx-auto mb-2 h-6 w-6 opacity-30" />
        Keine aktiven Touren
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-stone-900 text-white">
        <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="text-[11px] font-black uppercase tracking-widest">Score + Tour Übersicht</span>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="text-stone-400">{onlineDrivers} online</span>
          <span className={cn(
            'rounded-full px-2 py-0.5 font-black text-[11px] tabular-nums',
            avgScore >= 80 ? 'bg-emerald-500' : avgScore >= 60 ? 'bg-yellow-400 text-stone-900' : 'bg-red-600',
          )}>
            Ø {avgScore}
          </span>
        </div>
      </div>

      {/* Tour list */}
      <div className="divide-y">
        {tourRows.map(({ batch, done, total, score, style, prev, etaMinLeft }) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const trend = score > prev + 3 ? 'up' : score < prev - 3 ? 'down' : 'flat';
          const name  = driverName(batch);

          return (
            <div key={batch.id} className="px-4 py-3">
              {/* Top row */}
              <div className="flex items-center gap-2 mb-2">
                {/* Score ring */}
                <div className={cn(
                  'shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black tabular-nums',
                  style.ring,
                )}>
                  {score}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate">{name}</span>
                    {trend === 'up'   && <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />}
                    {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />}
                    {trend === 'flat' && <Minus className="w-3 h-3 text-stone-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {done}/{total} Stopps
                    {batch.zone ? ` · Zone ${batch.zone}` : ''}
                  </div>
                </div>

                {/* ETA / done badge */}
                <div className="shrink-0 text-right">
                  {done === total ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : etaMinLeft !== null ? (
                    <>
                      <div className={cn(
                        'text-xs font-black tabular-nums',
                        etaMinLeft < 0 ? 'text-red-600' : etaMinLeft < 5 ? 'text-orange-600' : 'text-stone-700',
                      )}>
                        {etaMinLeft < 0 ? `+${Math.abs(etaMinLeft)}` : etaMinLeft} Min
                      </div>
                      <div className="text-[9px] text-stone-400">
                        {etaMinLeft < 0 ? 'Verspätet' : 'noch'}
                      </div>
                    </>
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Stop dots */}
              {total > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {(batch.stops ?? [])
                    .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
                    .map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center',
                          s.geliefert_am ? 'bg-emerald-500' : 'bg-stone-200',
                        )}
                        title={s.order?.kunde_name ?? undefined}
                      >
                        {s.geliefert_am && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t px-4 py-2 bg-stone-50 text-[10px] text-stone-500">
        <MapPin className="w-3 h-3 shrink-0" />
        <span>{activeBatches.length} Tour{activeBatches.length !== 1 ? 'en' : ''} aktiv</span>
        <Star className="ml-auto w-3 h-3 text-amber-400 shrink-0" />
        <span>Top-Score: {tourRows[0]?.score ?? 0}</span>
      </div>
    </div>
  );
}
