'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface TourStop {
  id: string;
  adresse?: string | null;
  status?: string | null;
  sequence_number?: number | null;
  eta?: string | null;
  delivered_at?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  score?: number | null;
  tour_score?: number | null;
  created_at?: string | null;
  stops?: TourStop[];
}

interface Props {
  batches: Batch[];
  locationId: string | null;
}

function scoreColor(s: number): { bar: string; text: string; bg: string } {
  if (s >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (s >= 75) return { bar: 'bg-matcha-500',  text: 'text-matcha-700',  bg: 'bg-matcha-50'  };
  if (s >= 60) return { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50'   };
  if (s >= 45) return { bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50'  };
  return              { bar: 'bg-red-500',      text: 'text-red-700',     bg: 'bg-red-50'     };
}

function stopDot(status: string | null | undefined): { fill: string } {
  switch (status) {
    case 'geliefert':
    case 'abgeschlossen': return { fill: 'bg-emerald-500' };
    case 'unterwegs':     return { fill: 'bg-blue-500' };
    case 'pending':       return { fill: 'bg-gray-300' };
    default:              return { fill: 'bg-amber-400' };
  }
}

export function DispatchPhase1614ScoreTourVisualisierungsHub({ batches, locationId }: Props) {
  const [_, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = batches.filter((b) =>
    b.status && !['abgeschlossen', 'storniert', 'cancelled'].includes(b.status),
  );

  if (aktiv.length === 0) return null;

  const avgScore = aktiv.reduce((sum, b) => sum + (b.tour_score ?? b.score ?? 0), 0) / aktiv.length;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Score & Tour-Visualisierung
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          Ø {avgScore.toFixed(0)} Pkt · {aktiv.length} Touren
        </span>
      </div>

      <div className="divide-y divide-stone-50">
        {aktiv.slice(0, 8).map((b) => {
          const score = b.tour_score ?? b.score ?? 0;
          const col = scoreColor(score);
          const stops = (b.stops ?? []).slice().sort((a, z) => (a.sequence_number ?? 0) - (z.sequence_number ?? 0));
          const geliefert = stops.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;
          const total = stops.length;

          return (
            <div key={b.id} className="px-4 py-3">
              {/* Fahrer + Score */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-sm ${col.bg} ${col.text}`}>
                  {score.toFixed(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-800 truncate">
                    {b.driver_name ?? 'Fahrer'}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {geliefert}/{total} Stopps · Tour #{b.id.slice(-6)}
                  </div>
                </div>
                {/* Score-Bar */}
                <div className="w-20 h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${col.bar}`}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>

              {/* Tour-Stopp-Visualisierung */}
              {stops.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {stops.map((s, i) => {
                    const dot = stopDot(s.status);
                    return (
                      <React.Fragment key={s.id}>
                        {i > 0 && <div className="h-px w-4 bg-stone-200 shrink-0" />}
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 ${dot.fill}`}
                          title={s.adresse ?? `Stopp ${i + 1}`}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex gap-4 px-4 py-2 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-500 flex-wrap">
        {[
          { c: 'bg-emerald-500', l: 'Geliefert' },
          { c: 'bg-blue-500',    l: 'Unterwegs' },
          { c: 'bg-amber-400',   l: 'Ausstehend' },
          { c: 'bg-gray-300',    l: 'Geplant' },
        ].map(({ c, l }) => (
          <span key={l} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${c}`} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
