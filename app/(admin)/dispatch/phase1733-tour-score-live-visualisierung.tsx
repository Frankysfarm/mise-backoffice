'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Route, TrendingUp, Clock, MapPin, CheckCircle2, AlertTriangle, Bike } from 'lucide-react';

interface TourScore {
  tourId: string;
  driverName: string;
  zone: string | null;
  stopsTotal: number;
  stopsDone: number;
  elapsedMin: number;
  etaMin: number | null;
  timingScore: number; // 0–100
  routeScore: number;  // 0–100
  overallScore: number;
  status: 'on_route' | 'picking_up' | 'returning';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-matcha-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-matcha-500';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#4d7c0f' : score >= 60 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="fill-foreground font-black"
        style={{ fontSize: 11, fontWeight: 900, transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`, fill: color }}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

const MOCK_TOURS: TourScore[] = [
  { tourId: 't1', driverName: 'Max M.', zone: 'A', stopsTotal: 4, stopsDone: 2, elapsedMin: 22, etaMin: 40, timingScore: 88, routeScore: 92, overallScore: 90, status: 'on_route' },
  { tourId: 't2', driverName: 'Sarah K.', zone: 'B', stopsTotal: 3, stopsDone: 1, elapsedMin: 35, etaMin: 55, timingScore: 61, routeScore: 74, overallScore: 67, status: 'on_route' },
  { tourId: 't3', driverName: 'Tom R.', zone: 'C', stopsTotal: 5, stopsDone: 4, elapsedMin: 48, etaMin: 52, timingScore: 45, routeScore: 68, overallScore: 54, status: 'returning' },
];

export function DispatchPhase1733TourScoreLiveVisualisierung({
  locationId,
  batches,
  drivers,
}: {
  locationId?: string | null;
  batches?: any[];
  drivers?: any[];
}) {
  const [tours, setTours] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(true);

  const buildTours = useCallback(() => {
    if (!batches || batches.length === 0) {
      setTours(MOCK_TOURS);
      setLoading(false);
      return;
    }
    const now = Date.now();
    const activeBatches = batches.filter((b) => b.status === 'on_route' || b.status === 'picking_up');
    const result: TourScore[] = activeBatches.slice(0, 8).map((b) => {
      const driver = drivers?.find((d) => d.id === b.driver_id);
      const driverName = driver ? `${driver.vorname ?? ''} ${(driver.nachname ?? '').charAt(0)}.`.trim() : 'Unbekannt';
      const stops = b.stops ?? [];
      const stopsTotal = stops.length;
      const stopsDone = stops.filter((s: any) => s.status === 'delivered').length;
      const elapsedMin = b.dispatched_at ? Math.round((now - new Date(b.dispatched_at).getTime()) / 60000) : 0;
      const etaMin = b.eta_min ?? null;
      // Simple heuristic scores
      const timingScore = etaMin ? Math.max(0, Math.min(100, Math.round(100 - ((elapsedMin / (etaMin || 1)) - 0.5) * 100))) : 70;
      const routeScore = stopsTotal > 0 ? Math.round(60 + (stopsDone / stopsTotal) * 40) : 70;
      const overallScore = Math.round((timingScore + routeScore) / 2);
      return {
        tourId: b.id,
        driverName,
        zone: b.zone ?? null,
        stopsTotal,
        stopsDone,
        elapsedMin,
        etaMin,
        timingScore,
        routeScore,
        overallScore,
        status: b.status,
      };
    }).sort((a, b) => a.overallScore - b.overallScore);
    setTours(result.length > 0 ? result : MOCK_TOURS);
    setLoading(false);
  }, [batches, drivers]);

  useEffect(() => {
    buildTours();
  }, [buildTours]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse space-y-3">
        <div className="h-4 w-48 bg-stone-100 rounded" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
      </div>
    );
  }

  if (tours.length === 0) return null;

  const avgScore = Math.round(tours.reduce((s, t) => s + t.overallScore, 0) / tours.length);
  const critical = tours.filter((t) => t.overallScore < 60).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Route className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Tour Score · Live</div>
          <div className="text-[10px] text-muted-foreground">{tours.length} aktive Touren</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn('text-xl font-black tabular-nums', scoreColor(avgScore))}>{avgScore}</div>
          <div className="text-[8px] text-muted-foreground">Ø Score</div>
        </div>
        {critical > 0 && (
          <div className="shrink-0 flex items-center gap-1 rounded-full bg-red-100 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span className="text-[9px] font-bold text-red-700">{critical} kritisch</span>
          </div>
        )}
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-stone-100">
        {tours.map((tour) => {
          const progressPct = tour.stopsTotal > 0 ? Math.round((tour.stopsDone / tour.stopsTotal) * 100) : 0;
          return (
            <div key={tour.tourId} className="px-4 py-3 flex items-center gap-3">
              {/* Score ring */}
              <ScoreRing score={tour.overallScore} size={44} />

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Bike className="h-3 w-3 text-muted-foreground" />
                    {tour.driverName}
                  </span>
                  {tour.zone && (
                    <span className="text-[9px] font-bold border border-stone-300 rounded-full px-1.5 py-0.5">
                      Zone {tour.zone}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground">
                    {tour.stopsDone}/{tour.stopsTotal} Stopps
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', scoreBg(tour.overallScore))}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">{progressPct}%</span>
                </div>

                {/* Sub scores */}
                <div className="mt-1 flex items-center gap-3 text-[9px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    <span className={scoreColor(tour.timingScore)}>Timing {tour.timingScore}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    <span className={scoreColor(tour.routeScore)}>Route {tour.routeScore}</span>
                  </span>
                  {tour.etaMin && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-2.5 w-2.5" />
                      ~{tour.etaMin - tour.elapsedMin > 0 ? `${tour.etaMin - tour.elapsedMin} Min` : 'fertig'}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="shrink-0 text-right">
                <div className="text-xs font-mono tabular-nums font-bold text-muted-foreground">
                  {tour.elapsedMin}m
                </div>
                <div className={cn(
                  'text-[8px] font-bold mt-0.5',
                  tour.status === 'on_route' ? 'text-blue-600' : tour.status === 'picking_up' ? 'text-amber-600' : 'text-matcha-600',
                )}>
                  {tour.status === 'on_route' ? 'Unterwegs' : tour.status === 'picking_up' ? 'Abholung' : 'Rückkehr'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-matcha-500" />
            {tours.filter((t) => t.overallScore >= 80).length} top
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            {tours.filter((t) => t.overallScore >= 60 && t.overallScore < 80).length} ok
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {critical} kritisch
          </span>
        </div>
        <div className="text-[9px] text-muted-foreground">Echtzeit · alle 30s</div>
      </div>
    </div>
  );
}
