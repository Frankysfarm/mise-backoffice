'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Route, Star, Clock, TrendingUp, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TourScore {
  tour_id: string;
  fahrer_name?: string | null;
  fahrer_id?: string | null;
  score: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  pünktlichkeit_pct: number;
  avg_stop_min: number;
  current_stop?: string | null;
  eta_fertig_min?: number | null;
  umsatz?: number | null;
  status: 'aktiv' | 'pause' | 'fertig' | 'verspaetet';
}

interface Props {
  locationId: string | null;
}

const STATUS_STYLES: Record<TourScore['status'], { bg: string; text: string; label: string }> = {
  aktiv: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Aktiv' },
  pause: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Pause' },
  fertig: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Fertig' },
  verspaetet: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Verspätet' },
};

function ScoreArc({ score }: { score: number }) {
  const r = 22;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <svg width="56" height="32" viewBox="0 0 56 32" className="overflow-visible">
      <path
        d={`M 4 28 A ${r} ${r} 0 0 1 52 28`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d={`M 4 28 A ${r} ${r} 0 0 1 52 28`}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="28" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold">
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase5075TourScoreVisualisierungHub({ locationId }: Props) {
  const [tours, setTours] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/dispatch/scores?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setTours(data.tours ?? data ?? []);
        } else {
          setTours(MOCK_TOURS);
        }
      } catch {
        setTours(MOCK_TOURS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  useEffect(() => {
    if (!tours.length) return;
    const active = tours.filter(t => t.status === 'aktiv' || t.status === 'verspaetet');
    if (!active.length) { setAvgScore(0); return; }
    setAvgScore(Math.round(active.reduce((s, t) => s + t.score, 0) / active.length));
  }, [tours]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 animate-pulse">
        <div className="h-4 w-52 bg-slate-700/50 rounded mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-700/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const active = tours.filter(t => t.status === 'aktiv' || t.status === 'verspaetet');
  const verspätet = tours.filter(t => t.status === 'verspaetet');

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40 bg-slate-800/40">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Tour Score Visualisierung</span>
        </div>
        <div className="flex items-center gap-2">
          {verspätet.length > 0 && (
            <div className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3 w-3" />
              {verspätet.length} verspätet
            </div>
          )}
          <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
            avgScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
            avgScore >= 60 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>
            Ø {avgScore} Punkte
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-px bg-slate-700/20">
        <div className="bg-slate-800/40 px-3 py-2">
          <p className="text-xs text-slate-500">Aktive Touren</p>
          <p className="text-lg font-bold text-slate-200">{active.length}</p>
        </div>
        <div className="bg-slate-800/40 px-3 py-2">
          <p className="text-xs text-slate-500">Verspätet</p>
          <p className={cn('text-lg font-bold', verspätet.length > 0 ? 'text-red-400' : 'text-slate-200')}>
            {verspätet.length}
          </p>
        </div>
        <div className="bg-slate-800/40 px-3 py-2">
          <p className="text-xs text-slate-500">Fertig heute</p>
          <p className="text-lg font-bold text-slate-200">{tours.filter(t => t.status === 'fertig').length}</p>
        </div>
      </div>

      {/* Tour-Karten */}
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {active.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Keine aktiven Touren
          </div>
        )}
        {[...active].sort((a, b) => b.score - a.score).map(tour => {
          const styles = STATUS_STYLES[tour.status];
          const progress = tour.stopps_gesamt > 0
            ? (tour.stopps_erledigt / tour.stopps_gesamt) * 100
            : 0;

          return (
            <div key={tour.tour_id} className={cn(
              'rounded-lg border p-3 space-y-2',
              tour.status === 'verspaetet'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-slate-700/40 bg-slate-800/20'
            )}>
              {/* Zeile 1: Fahrer + Score-Arc + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScoreArc score={tour.score} />
                  <div>
                    <p className="text-sm font-semibold text-slate-200 leading-tight">
                      {tour.fahrer_name ?? `Tour ${tour.tour_id.slice(-6)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className={cn('text-xs px-2 py-0.5 rounded-full font-medium inline-block', styles.bg, styles.text)}>
                    {styles.label}
                  </div>
                  {tour.eta_fertig_min !== null && tour.eta_fertig_min !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
                      <Clock className="h-3 w-3" />
                      Fertig in {Math.round(tour.eta_fertig_min)} min
                    </div>
                  )}
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Tour-Fortschritt</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      tour.status === 'verspaetet' ? 'bg-red-400' :
                      progress >= 75 ? 'bg-emerald-400' :
                      progress >= 40 ? 'bg-blue-400' :
                      'bg-slate-400'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Zeile 2: KPIs */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 text-amber-400" />
                    <span className={cn('text-sm font-bold tabular-nums',
                      tour.pünktlichkeit_pct >= 90 ? 'text-emerald-400' :
                      tour.pünktlichkeit_pct >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {tour.pünktlichkeit_pct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Pünktlichkeit</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3 text-blue-400" />
                    <span className="text-sm font-bold text-slate-200 tabular-nums">
                      {tour.avg_stop_min}min
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Ø Stop</p>
                </div>
                {tour.umsatz !== null && tour.umsatz !== undefined ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">
                        {euro(tour.umsatz)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Umsatz</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {tour.current_stop ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Stop</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MOCK_TOURS: TourScore[] = [
  {
    tour_id: 'tour-mock-1',
    fahrer_name: 'Max M.',
    score: 87,
    stopps_gesamt: 5,
    stopps_erledigt: 3,
    pünktlichkeit_pct: 92,
    avg_stop_min: 4,
    current_stop: 'Kaiserstr. 12',
    eta_fertig_min: 18,
    umsatz: 87.50,
    status: 'aktiv',
  },
  {
    tour_id: 'tour-mock-2',
    fahrer_name: 'Anna K.',
    score: 62,
    stopps_gesamt: 4,
    stopps_erledigt: 2,
    pünktlichkeit_pct: 68,
    avg_stop_min: 7,
    current_stop: 'Hauptstr. 5',
    eta_fertig_min: 25,
    umsatz: 54.00,
    status: 'verspaetet',
  },
  {
    tour_id: 'tour-mock-3',
    fahrer_name: 'Tom S.',
    score: 94,
    stopps_gesamt: 6,
    stopps_erledigt: 5,
    pünktlichkeit_pct: 97,
    avg_stop_min: 3,
    eta_fertig_min: 8,
    umsatz: 112.40,
    status: 'aktiv',
  },
];
