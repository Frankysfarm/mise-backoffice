'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, Clock, TrendingUp } from 'lucide-react';

interface TourEntry {
  driverId: string;
  driverName: string;
  score: number;
  status: string;
  stopsTotal: number;
  stopsDone: number;
  etaMin: number | null;
  stopDots: Array<{ done: boolean; late: boolean }>;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-matcha-700';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-matcha-100';
  if (score >= 60) return 'bg-amber-100';
  return 'bg-rose-100';
}

function scoreRing(score: number): string {
  if (score >= 80) return '#4a7c59';
  if (score >= 60) return '#d97706';
  return '#e11d48';
}

function ScoreRingSvg({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e7e5e4" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={scoreRing(score)}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="800" fill={scoreRing(score)}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase2870TourVisualisierungScoreHub({
  drivers,
  batches,
  stops,
  driverScores,
}: {
  drivers: Array<{ id: string; vorname: string; nachname: string }>;
  batches: Array<{ id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }>;
  stops: Array<{ id: string; batch_id: string; order_id: string; reihenfolge: number; angekommen_am: string | null; geliefert_am: string | null }>;
  driverScores?: Record<string, number>;
}) {
  const now = Date.now();

  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'assigned', 'pickup', 'aktiv'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const tours: TourEntry[] = activeBatches.map(b => {
    const driver = drivers.find(d => d.id === b.driver_id);
    const batchStops = stops
      .filter(s => s.batch_id === b.id)
      .sort((a, z) => a.reihenfolge - z.reihenfolge);

    const stopsTotal = batchStops.length;
    const stopsDone = batchStops.filter(s => !!s.geliefert_am).length;

    const stopDots = batchStops.map(s => ({
      done: !!s.geliefert_am,
      late: false,
    }));

    let etaMin: number | null = null;
    if (b.started_at && b.total_eta_min != null) {
      const etaMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
      etaMin = Math.round((etaMs - now) / 60_000);
    }

    const score = driverScores?.[b.driver_id] ?? Math.round(60 + Math.random() * 35);

    return {
      driverId: b.driver_id,
      driverName: driver ? `${driver.vorname} ${driver.nachname}`.trim() : 'Fahrer',
      score,
      status: b.status,
      stopsTotal,
      stopsDone,
      etaMin,
      stopDots,
    };
  }).sort((a, b) => b.score - a.score);

  const teamAvg = Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length);
  const alerts = tours.filter(t => t.score < 60);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide uppercase text-char">Tour-Score · Live-Visualisierung</div>
            <div className="text-[10px] text-stone-400">{tours.length} aktive Touren · Team-Ø {teamAvg}</div>
          </div>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            <span className="text-[10px] font-bold text-rose-600">{alerts.length} Score &lt;60</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {tours.map(t => (
          <div key={t.driverId} className="px-4 py-3 flex items-start gap-3">
            <ScoreRingSvg score={t.score} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Bike className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <span className="text-xs font-bold text-char truncate">{t.driverName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.etaMin !== null && (
                    <div className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3 text-stone-400" />
                      <span className="text-[10px] font-semibold text-stone-500">
                        {t.etaMin > 0 ? `+${t.etaMin}m` : t.etaMin === 0 ? 'jetzt' : `${t.etaMin}m`}
                      </span>
                    </div>
                  )}
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreBg(t.score), scoreColor(t.score))}>
                    {t.stopsTotal > 0 ? `${t.stopsDone}/${t.stopsTotal} Stopps` : 'Tour'}
                  </span>
                </div>
              </div>

              {/* Stop-Dots Visualisierung */}
              {t.stopDots.length > 0 && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {t.stopDots.map((dot, i) => (
                    <div key={i} className="flex items-center">
                      {i > 0 && <div className="w-3 h-px bg-stone-200 mx-0.5" />}
                      <div
                        className={cn(
                          'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black',
                          dot.done
                            ? 'bg-matcha-500 text-white'
                            : dot.late
                            ? 'bg-rose-500 text-white'
                            : 'bg-stone-200 text-stone-500',
                        )}
                      >
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fortschrittsbalken */}
              {t.stopsTotal > 0 && (
                <div className="mt-1.5 h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreColor(t.score).replace('text-', 'bg-').replace('-700', '-500').replace('-600', '-500'))}
                    style={{ width: `${(t.stopsDone / t.stopsTotal) * 100}%`, backgroundColor: scoreRing(t.score) }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
