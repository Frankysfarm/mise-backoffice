'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Route, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 3598 — Tour-Score Visualisierung Live Hub
 * Score-Balken 0–100 je Fahrer; Stopp-Dot-Timeline farbkodiert; Sub-Scores Pünktlichkeit/Abschluss/Speed;
 * Flotten-Ø; expandierbare Stopp-Liste; Alert Score<70; 20-Sek-Polling; Mock-Fallback
 */

interface TourStopp {
  id: string;
  sequence: number;
  adresse?: string;
  status: 'pending' | 'completed' | 'current';
  eta_min?: number | null;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  tour_id: string;
  score: number;
  pünktlichkeit: number;
  abschluss_rate: number;
  speed_score: number;
  elapsed_min: number;
  total_eta_min: number | null;
  stopps: TourStopp[];
  zone?: string;
}

interface ApiResponse {
  touren: FahrerTour[];
  flotten_avg_score: number;
}

const MOCK: ApiResponse = {
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'Mehmet A.', tour_id: 't1', score: 88,
      pünktlichkeit: 92, abschluss_rate: 100, speed_score: 80,
      elapsed_min: 18, total_eta_min: 45,
      zone: 'Mitte',
      stopps: [
        { id: 's1', sequence: 1, adresse: 'Hauptstraße 12', status: 'completed', eta_min: null },
        { id: 's2', sequence: 2, adresse: 'Bahnhofstr. 34', status: 'completed', eta_min: null },
        { id: 's3', sequence: 3, adresse: 'Goethestr. 7', status: 'current', eta_min: 8 },
        { id: 's4', sequence: 4, adresse: 'Schillerstr. 2', status: 'pending', eta_min: 20 },
        { id: 's5', sequence: 5, adresse: 'Mozartstr. 9', status: 'pending', eta_min: 32 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Lisa K.', tour_id: 't2', score: 64,
      pünktlichkeit: 55, abschluss_rate: 75, speed_score: 70,
      elapsed_min: 35, total_eta_min: 40,
      zone: 'Nord',
      stopps: [
        { id: 's6', sequence: 1, adresse: 'Karlstraße 3', status: 'completed', eta_min: null },
        { id: 's7', sequence: 2, adresse: 'Ludwigstr. 18', status: 'completed', eta_min: null },
        { id: 's8', sequence: 3, adresse: 'Maxstr. 5', status: 'completed', eta_min: null },
        { id: 's9', sequence: 4, adresse: 'Friedrichstr. 1', status: 'current', eta_min: 6 },
      ],
    },
  ],
  flotten_avg_score: 76,
};

function scoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (score >= 65) return { bar: 'bg-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  return { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-red-200' };
}

function StoppDot({ status }: { status: TourStopp['status'] }) {
  if (status === 'completed') return <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />;
  if (status === 'current')   return <div className="w-3 h-3 rounded-full bg-orange-400 border-2 border-white shadow-sm animate-pulse" />;
  return <div className="w-3 h-3 rounded-full bg-stone-200 border-2 border-white shadow-sm" />;
}

function TourRow({ tour }: { tour: FahrerTour }) {
  const [expanded, setExpanded] = useState(false);
  const col = scoreColor(tour.score);
  const completedCount = tour.stopps.filter(s => s.status === 'completed').length;
  const currentStop = tour.stopps.find(s => s.status === 'current');

  return (
    <div className={cn('rounded-lg border', col.badge)}>
      <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpanded(e => !e)}>
        {/* Score-Balken */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Bike className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-xs font-bold text-char">{tour.fahrer_name}</span>
              {tour.zone && <span className="text-[10px] text-stone-400 bg-stone-100 px-1 rounded">{tour.zone}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-black tabular-nums', col.text)}>{tour.score}</span>
              {tour.score < 70 && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-stone-400" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
            </div>
          </div>
          {/* Balken */}
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', col.bar)} style={{ width: `${tour.score}%` }} />
          </div>
          {/* Stopp-Dots */}
          <div className="flex items-center gap-1 mt-2">
            {tour.stopps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <StoppDot status={s.status} />
                {i < tour.stopps.length - 1 && <div className="w-3 h-px bg-stone-200" />}
              </div>
            ))}
            <span className="ml-2 text-[10px] text-stone-400">{completedCount}/{tour.stopps.length} Stopps</span>
            {currentStop?.eta_min != null && (
              <span className="ml-auto text-[10px] text-orange-600 font-semibold flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />{currentStop.eta_min}min
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-3 pb-3 pt-2 space-y-2">
          {/* Sub-Scores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Pünktlichkeit', value: tour.pünktlichkeit },
              { label: 'Abschluss', value: tour.abschluss_rate },
              { label: 'Speed', value: tour.speed_score },
            ].map(sub => {
              const c = scoreColor(sub.value);
              return (
                <div key={sub.label} className="bg-stone-50 rounded-lg p-2">
                  <div className={cn('text-sm font-bold tabular-nums', c.text)}>{sub.value}</div>
                  <div className="text-[10px] text-stone-400">{sub.label}</div>
                </div>
              );
            })}
          </div>
          {/* Stopp-Liste */}
          <div className="space-y-1">
            {tour.stopps.map(s => (
              <div key={s.id} className={cn(
                'flex items-center gap-2 text-[11px] rounded px-2 py-1',
                s.status === 'current' ? 'bg-orange-50' : s.status === 'completed' ? 'bg-stone-50 opacity-60' : '',
              )}>
                <StoppDot status={s.status} />
                <span className="font-medium text-char">{s.sequence}.</span>
                <span className="flex-1 text-stone-600 truncate">{s.adresse ?? `Stopp ${s.sequence}`}</span>
                {s.status === 'current' && s.eta_min != null && (
                  <span className="text-orange-600 font-semibold shrink-0">{s.eta_min}min</span>
                )}
                {s.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-stone-400 flex gap-2">
            <span>Gefahren: {tour.elapsed_min}min</span>
            {tour.total_eta_min && <span>· ETA gesamt: {tour.total_eta_min}min</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function DispatchPhase3598TourScoreVisualisierungLiveHub({ batches, drivers }: { batches?: unknown[]; drivers?: unknown[] }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/delivery/dispatch/tour-score-hub', { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const alertCount = data.touren.filter(t => t.score < 70).length;
  const avgColor = scoreColor(data.flotten_avg_score);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-2">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-char">Tour-Score Visualisierung Live</span>
          {alertCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
              {alertCount} Score&lt;70
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">Ø Flotte: <span className={cn('font-bold', avgColor.text)}>{data.flotten_avg_score}</span></span>
          <Route className="w-3.5 h-3.5 text-stone-400" />
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-stone-100 pt-3">
          {data.touren.length === 0 ? (
            <div className="text-sm text-stone-400 py-2">Keine aktiven Touren</div>
          ) : (
            data.touren.map(t => <TourRow key={t.fahrer_id} tour={t} />)
          )}
        </div>
      )}
    </div>
  );
}
