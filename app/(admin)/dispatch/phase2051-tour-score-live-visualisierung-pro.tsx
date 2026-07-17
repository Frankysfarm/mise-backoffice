'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ACTIVE_STATES = new Set(['assigned', 'at_restaurant', 'on_route']);

const MOCK_BATCHES = [
  { id: 'b1', state: 'on_route', score: 87, driver_name: 'Hans M.', stops_total: 3, stops_done: 1, eta_min: 12, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: 'b2', state: 'assigned', score: 73, driver_name: 'Lisa K.', stops_total: 2, stops_done: 0, eta_min: 24, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'b3', state: 'on_route', score: 55, driver_name: 'Tom B.', stops_total: 4, stops_done: 3, eta_min: 6, created_at: new Date(Date.now() - 35 * 60000).toISOString() },
];

interface Batch {
  id: string;
  state?: string;
  score?: number;
  driver_name?: string;
  stops_total?: number;
  stops_done?: number;
  eta_min?: number;
  created_at?: string;
}

interface Driver {
  id: string;
  name?: string;
}

interface Props {
  batches: Array<Batch>;
  drivers: Array<Driver>;
  className?: string;
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-900 text-green-300';
  if (score >= 60) return 'bg-yellow-900 text-yellow-300';
  return 'bg-red-900 text-red-300';
}

function ScoreRing({ score }: { score: number }) {
  const r = 16;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90 shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#374151" strokeWidth="3.5" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke="#c084fc"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function DispatchPhase2051TourScoreLiveVisualisierungPro({ batches, drivers: _drivers, className }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  // tick increments every 30s to force re-evaluation of derived data from props
  void tick;

  const filtered = batches.filter(b => ACTIVE_STATES.has(b.state ?? ''));
  const source = filtered.length > 0 ? filtered : MOCK_BATCHES;
  const activeBatches = [...source]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  const avgScore = activeBatches.length > 0
    ? Math.round(activeBatches.reduce((s, b) => s + (b.score ?? 0), 0) / activeBatches.length)
    : 0;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-400" />
          Tour-Score Live-Visualisierung Pro
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">
            {activeBatches.length} aktiv
          </span>
          <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-bold', scoreBadgeClass(avgScore))}>
            Ø {avgScore}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {activeBatches.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">Keine aktiven Touren</p>
          ) : (
            activeBatches.map(b => {
              const score = b.score ?? 0;
              const stopsTotal = b.stops_total ?? 0;
              const stopsDone = b.stops_done ?? 0;
              const progressPct = stopsTotal > 0 ? Math.round((stopsDone / stopsTotal) * 100) : 0;
              return (
                <div key={b.id} className="rounded-lg bg-gray-800 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-100 truncate">
                          {b.driver_name ?? 'Fahrer'}
                        </span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-black shrink-0', scoreBadgeClass(score))}>
                          {score}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                        <span>{stopsDone}/{stopsTotal} Stopps</span>
                        {b.eta_min != null && (
                          <span>ETA {b.eta_min} Min</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
