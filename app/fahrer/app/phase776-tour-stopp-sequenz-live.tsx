'use client';

import React, { useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TourStoppLive = {
  id: string;
  reihenfolge: number;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  order?: {
    id?: string;
    kunde_name?: string | null;
    kunde_adresse?: string | null;
    gesamtbetrag?: number;
  } | null;
  eta_min?: number | null;
};

interface Props {
  stops: TourStoppLive[];
  currentStopId?: string | null;
  onNavigate?: (stop: TourStoppLive) => void;
}

export function Phase776TourStoppSequenzLive({ stops, currentStopId, onNavigate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!stops || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter((s) => s.geliefert_am).length;
  const progressPct = stops.length > 0 ? Math.round((doneCount / stops.length) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Phase 776 · Stopp-Sequenz Live
        </span>
        <span className="ml-auto text-[9px] font-black text-matcha-700 bg-matcha-100 rounded-full px-2 py-0.5">
          {doneCount}/{stops.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Tour-Fortschritt</span>
          <span className="text-[8px] text-muted-foreground tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stops list */}
      <div className="divide-y">
        {sorted.map((stop, idx) => {
          const done = !!stop.geliefert_am;
          const isCurrent = stop.id === currentStopId || (!currentStopId && !done && idx === doneCount);
          const isExpanded = expanded === stop.id;

          return (
            <div
              key={stop.id}
              className={cn(
                'px-4 py-2.5 transition-colors',
                done ? 'bg-muted/20' : isCurrent ? 'bg-matcha-50' : 'bg-card',
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Stop number / status */}
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-black text-xs',
                    done
                      ? 'bg-matcha-500 text-white'
                      : isCurrent
                      ? 'bg-matcha-600 text-white ring-2 ring-matcha-300 ring-offset-1'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.reihenfolge}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate text-foreground">
                      {stop.order?.kunde_name ?? `Stopp ${stop.reihenfolge}`}
                    </div>
                    {stop.order?.kunde_adresse && (
                      <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {stop.order.kunde_adresse}
                      </div>
                    )}
                  </div>

                  {/* ETA / time */}
                  <div className="shrink-0 text-right">
                    {done ? (
                      <span className="text-[9px] text-matcha-600 font-bold">✓ Geliefert</span>
                    ) : stop.eta_min !== null && stop.eta_min !== undefined ? (
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold tabular-nums">{stop.eta_min}m</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              {/* Expanded: Navigation-Button */}
              {isExpanded && !done && (
                <div className="mt-2 pl-10">
                  {stop.order?.kunde_adresse && onNavigate && (
                    <button
                      onClick={() => onNavigate(stop)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-matcha-700 transition"
                    >
                      <Navigation className="h-3 w-3" />
                      Navigation starten
                    </button>
                  )}
                  {stop.order?.gesamtbetrag !== undefined && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {(stop.order.gesamtbetrag ?? 0).toFixed(2)} €
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
