'use client';

import React, { useEffect, useState } from 'react';

interface Stop {
  id: string;
  position: number;
  status?: string | null;
  address?: string | null;
  eta_min?: number | null;
}

interface TourRow {
  batch_id: string;
  driver_name: string;
  score: number;
  score_label: 'top' | 'gut' | 'mittel' | 'schwach';
  completed_stops: number;
  total_stops: number;
  elapsed_min: number;
  eta_total_min: number | null;
  stops: Stop[];
}

interface BatchInput {
  id: string;
  driver_name?: string | null;
  score?: number | null;
  status?: string | null;
  started_at?: string | null;
  completed_stops?: number | null;
  total_stops?: number | null;
}

interface StopInput {
  id: string;
  batch_id?: string | null;
  position?: number | null;
  status?: string | null;
  address?: string | null;
  eta_min?: number | null;
}

interface Props {
  batches: BatchInput[];
  stops: StopInput[];
  locationId?: string | null;
}

const MOCK_TOURS: TourRow[] = [
  {
    batch_id: 'b1', driver_name: 'Max M.', score: 91, score_label: 'top',
    completed_stops: 2, total_stops: 4, elapsed_min: 22, eta_total_min: 18,
    stops: [
      { id: 's1', position: 1, status: 'geliefert', address: 'Hauptstr. 12', eta_min: 8 },
      { id: 's2', position: 2, status: 'geliefert', address: 'Gartenweg 5', eta_min: 12 },
      { id: 's3', position: 3, status: 'unterwegs', address: 'Birkenallee 3', eta_min: 9 },
      { id: 's4', position: 4, status: 'ausstehend', address: 'Ringstr. 22', eta_min: 18 },
    ],
  },
  {
    batch_id: 'b2', driver_name: 'Anna S.', score: 74, score_label: 'gut',
    completed_stops: 1, total_stops: 3, elapsed_min: 14, eta_total_min: 25,
    stops: [
      { id: 's5', position: 1, status: 'geliefert', address: 'Marktplatz 1', eta_min: 11 },
      { id: 's6', position: 2, status: 'unterwegs', address: 'Schillerstr. 9', eta_min: 13 },
      { id: 's7', position: 3, status: 'ausstehend', address: 'Berliner Str. 44', eta_min: 25 },
    ],
  },
];

const SCORE_STYLE = {
  top:    { bg: 'bg-emerald-500', text: 'text-white', label: 'Top' },
  gut:    { bg: 'bg-matcha-500',  text: 'text-white', label: 'Gut' },
  mittel: { bg: 'bg-amber-400',   text: 'text-white', label: 'Mittel' },
  schwach: { bg: 'bg-rose-500',   text: 'text-white', label: 'Schwach' },
};

const STOP_STATUS_DOT: Record<string, string> = {
  geliefert: 'bg-emerald-500',
  unterwegs: 'bg-amber-400 animate-pulse',
  ausstehend: 'bg-gray-200',
};

function scoreLabel(score: number): 'top' | 'gut' | 'mittel' | 'schwach' {
  if (score >= 88) return 'top';
  if (score >= 72) return 'gut';
  if (score >= 55) return 'mittel';
  return 'schwach';
}

function toRows(batches: BatchInput[], stops: StopInput[]): TourRow[] {
  const active = batches.filter((b) => b.status === 'aktiv' || b.status === 'unterwegs');
  if (!active.length) return MOCK_TOURS;

  return active.map((b) => {
    const batchStops: Stop[] = stops
      .filter((s) => s.batch_id === b.id)
      .sort((a, b2) => (a.position ?? 0) - (b2.position ?? 0))
      .map((s) => ({
        id: s.id,
        position: s.position ?? 0,
        status: s.status,
        address: s.address,
        eta_min: s.eta_min,
      }));

    const completed = batchStops.filter((s) => s.status === 'geliefert').length;
    const total = batchStops.length || b.total_stops || 0;
    const score = b.score ?? 75;
    const elapsed = b.started_at
      ? Math.round((Date.now() - new Date(b.started_at).getTime()) / 60_000)
      : 0;
    const nextStop = batchStops.find((s) => s.status !== 'geliefert');

    return {
      batch_id: b.id,
      driver_name: b.driver_name ?? '–',
      score,
      score_label: scoreLabel(score),
      completed_stops: completed,
      total_stops: total,
      elapsed_min: elapsed,
      eta_total_min: nextStop?.eta_min ?? null,
      stops: batchStops,
    };
  });
}

export function DispatchPhase1594TourLiveVisualisierungsCockpit({ batches, stops }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const rows = toRows(batches, stops);
  if (!open) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-800 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Tour-Live-Visualisierung</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{rows.length} aktive Touren</span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="divide-y divide-gray-100">
        {rows.map((tour) => {
          const style = SCORE_STYLE[tour.score_label];
          const pct = tour.total_stops > 0 ? Math.round((tour.completed_stops / tour.total_stops) * 100) : 0;
          return (
            <div key={tour.batch_id + tick} className="p-4">
              {/* Header row */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${style.bg} ${style.text}`}>
                  {tour.score} · {style.label}
                </span>
                <span className="font-semibold text-sm text-gray-800 flex-1">{tour.driver_name}</span>
                <span className="text-xs text-gray-400">{tour.elapsed_min} min unterwegs</span>
                {tour.eta_total_min !== null && (
                  <span className="text-xs font-bold text-matcha-700">ETA {tour.eta_total_min} min</span>
                )}
              </div>

              {/* Stop timeline */}
              <div className="flex items-center gap-1 mb-2">
                {tour.stops.map((s, idx) => {
                  const dot = STOP_STATUS_DOT[s.status ?? 'ausstehend'] ?? 'bg-gray-200';
                  const isLast = idx === tour.stops.length - 1;
                  return (
                    <React.Fragment key={s.id}>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={`w-3 h-3 rounded-full ${dot}`} title={s.address ?? `Stopp ${s.position}`} />
                        <span className="text-[8px] text-gray-400">{s.position}</span>
                      </div>
                      {!isLast && <div className="flex-1 h-px bg-gray-200 min-w-[8px]" />}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                  {tour.completed_stops}/{tour.total_stops} Stopps
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3 flex gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Geliefert</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Unterwegs</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />Ausstehend</span>
      </div>
    </div>
  );
}
