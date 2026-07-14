'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Clock, MapPin, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

// Phase 1501 — Tour Live Score Karte (Dispatch)
// Zeigt alle aktiven Touren mit Live-Score-Fortschritt:
// Pünktlichkeit + Stoppanzahl + ETA-Abweichung als Score 0–100.
// Verknüpft Fahrername, Tour-Fortschritt und SLA-Status.

interface Stop {
  id: string;
  batch_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order?: { bestellnummer?: string | null; kunde_name?: string | null } | null;
}

interface Batch {
  id: string;
  fahrer_id?: string | null;
  employee_id?: string | null;
  status: string;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops: Stop[];
  fahrer?: { vorname: string; nachname: string } | null;
}

interface Driver {
  employee_id: string;
  employee?: { vorname: string; nachname: string } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function computeScore(batch: Batch, now: number): number {
  const stops = batch.stops ?? [];
  const total = stops.length;
  if (total === 0) return 80;

  const done = stops.filter(s => s.geliefert_am).length;
  const progressRatio = done / total;

  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime()
    : batch.started_at ? new Date(batch.started_at).getTime()
    : now;
  const etaMs = batch.total_eta_min != null ? startMs + batch.total_eta_min * 60_000 : null;

  let punctuality = 80;
  if (etaMs) {
    const drift = (now - etaMs) / 60_000;
    if (drift < -10) punctuality = 100;
    else if (drift < 0) punctuality = 95;
    else if (drift < 5) punctuality = 80;
    else if (drift < 10) punctuality = 60;
    else punctuality = 40;
  }

  return Math.round(punctuality * 0.6 + progressRatio * 100 * 0.4);
}

function scoreColor(score: number) {
  if (score >= 85) return { ring: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 65) return { ring: 'bg-yellow-400',  text: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-200' };
  if (score >= 45) return { ring: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' };
  return             { ring: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300' };
}

function ScoreTrend({ prev, cur }: { prev: number; cur: number }) {
  if (cur > prev + 3)   return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (cur < prev - 3)   return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-stone-400" />;
}

export function DispatchPhase1501TourLiveScoreKarte({ batches, drivers }: Props) {
  const [, setTick] = useState(0);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setTick(n => n + 1);
      setPrevScores(prev => {
        const next: Record<string, number> = { ...prev };
        batches.forEach(b => {
          if (!prev[b.id]) next[b.id] = computeScore(b, now);
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [batches]);

  const aktiveTouren = useMemo(() => {
    const now = Date.now();
    return batches
      .filter(b => ['unterwegs', 'on_route', 'active', 'picking_up', 'at_restaurant'].includes(b.status))
      .map(b => {
        const score = computeScore(b, now);
        const driverName = b.fahrer
          ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
          : drivers.find(d => d.employee_id === (b.fahrer_id ?? b.employee_id))
            ? (() => {
                const d = drivers.find(x => x.employee_id === (b.fahrer_id ?? b.employee_id))!;
                return `${d.employee?.vorname ?? '?'} ${(d.employee?.nachname ?? '?')[0]}.`;
              })()
            : 'Fahrer';
        const done = (b.stops ?? []).filter(s => s.geliefert_am).length;
        const total = b.stops?.length ?? 0;
        const nextStop = (b.stops ?? [])
          .filter(s => !s.geliefert_am)
          .sort((a, x) => a.reihenfolge - x.reihenfolge)[0];
        const etaMs = (b.startzeit || b.started_at) && b.total_eta_min != null
          ? new Date((b.startzeit ?? b.started_at)!).getTime() + b.total_eta_min * 60_000
          : null;
        const minLeft = etaMs ? Math.round((etaMs - now) / 60_000) : null;
        return { ...b, score, driverName, done, total, nextStop, minLeft };
      })
      .sort((a, b) => a.score - b.score);
  }, [batches, drivers]);

  if (aktiveTouren.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-stone-600">
          Tour Live-Scores — {aktiveTouren.length} aktiv
        </span>
      </div>

      <div className="divide-y divide-stone-100">
        {aktiveTouren.map(tour => {
          const c = scoreColor(tour.score);
          const prev = prevScores[tour.id] ?? tour.score;
          return (
            <div key={tour.id} className={cn('flex items-center gap-3 px-4 py-3', c.bg)}>
              {/* Score-Ring */}
              <div className={cn('flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-black border-2', c.border, c.text, 'bg-white')}>
                {tour.score}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-black truncate', c.text)}>
                    {tour.driverName}
                  </span>
                  {tour.zone && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 uppercase">
                      Zone {tour.zone}
                    </span>
                  )}
                  <ScoreTrend prev={prev} cur={tour.score} />
                </div>

                {/* Fortschrittsbalken */}
                <div className="mt-1.5 h-1.5 rounded-full bg-stone-200 overflow-hidden w-full">
                  <div
                    className={cn('h-full rounded-full transition-all', c.ring)}
                    style={{ width: `${tour.total > 0 ? (tour.done / tour.total) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-stone-500">
                    <MapPin className="w-3 h-3 inline-block mr-0.5" />
                    {tour.done}/{tour.total} Stopps
                  </span>
                  {tour.minLeft != null && (
                    <span className={cn('text-[10px] font-semibold', tour.minLeft < 0 ? 'text-red-600' : tour.minLeft < 5 ? 'text-orange-600' : 'text-stone-500')}>
                      <Clock className="w-3 h-3 inline-block mr-0.5" />
                      {tour.minLeft < 0 ? `+${Math.abs(tour.minLeft)} Min überfällig` : `${tour.minLeft} Min verbl.`}
                    </span>
                  )}
                </div>
              </div>

              {/* Score-Sterne */}
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={cn('w-3 h-3', s <= Math.round(tour.score / 20) ? 'text-amber-400 fill-amber-400' : 'text-stone-200')}
                    />
                  ))}
                </div>
                <span className={cn('text-[9px] font-bold uppercase', c.text)}>
                  {tour.score >= 85 ? 'Sehr gut' : tour.score >= 65 ? 'Gut' : tour.score >= 45 ? 'OK' : 'Kritisch'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
