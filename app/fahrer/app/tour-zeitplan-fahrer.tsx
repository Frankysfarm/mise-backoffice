'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, Circle, Navigation } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
}

const AVG_STOP_MIN = 8; // default if no ETA available

function estimateArrival(stop: Stop, idx: number, batchStartedAt: string | null): Date {
  if (stop.order.eta_earliest) return new Date(stop.order.eta_earliest);
  const base = batchStartedAt ? new Date(batchStartedAt) : new Date();
  return new Date(base.getTime() + (idx + 1) * AVG_STOP_MIN * 60_000);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
}

function useSecTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);
}

export function TourZeitplanFahrer({ stops, batchStartedAt }: Props) {
  useSecTick();
  const now = Date.now();

  const sortedStops = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const currentIdx = sortedStops.findIndex(s => !s.geliefert_am);
  const hasAny = sortedStops.length > 0;

  if (!hasAny) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-matcha-50/60">
        <Clock size={14} className="text-matcha-600 shrink-0" />
        <span className="text-xs font-bold tracking-wide text-matcha-800 flex-1">
          Tour-Zeitplan
        </span>
        <span className="text-[10px] text-matcha-600 font-semibold">
          {sortedStops.filter(s => s.geliefert_am).length}/{sortedStops.length} geliefert
        </span>
      </div>

      {/* Stop list */}
      <div className="p-3 space-y-0">
        {sortedStops.map((stop, idx) => {
          const isDone = !!stop.geliefert_am;
          const isCurrent = idx === currentIdx;
          const estArrival = estimateArrival(stop, idx, batchStartedAt);
          const isLate = !isDone && estArrival.getTime() < now && isCurrent;
          const distKm = stop.distanz_zum_vorgaenger_m
            ? (stop.distanz_zum_vorgaenger_m / 1000).toFixed(1)
            : null;

          return (
            <div key={stop.id} className="relative flex gap-3">
              {/* Vertical line */}
              {idx < sortedStops.length - 1 && (
                <div className="absolute left-[17px] top-8 bottom-0 w-0.5 bg-border" />
              )}

              {/* Status icon */}
              <div className={cn(
                'relative z-10 shrink-0 h-9 w-9 rounded-full flex items-center justify-center border-2 mt-0.5',
                isDone
                  ? 'bg-matcha-500 border-matcha-400'
                  : isCurrent
                  ? 'bg-white border-matcha-500 shadow-md shadow-matcha-200'
                  : 'bg-muted border-border',
              )}>
                {isDone ? (
                  <CheckCircle2 size={16} className="text-white" />
                ) : isCurrent ? (
                  <Navigation size={14} className="text-matcha-600" />
                ) : (
                  <Circle size={14} className="text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className={cn(
                'flex-1 rounded-xl px-3 py-2 mb-2 min-w-0 transition-colors',
                isDone ? 'bg-muted/40' : isCurrent ? 'bg-matcha-50 border border-matcha-200' : 'bg-transparent',
              )}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      'text-[10px] font-black rounded-full px-1.5 py-0.5 shrink-0',
                      isDone ? 'bg-matcha-100 text-matcha-700'
                        : isCurrent ? 'bg-matcha-500 text-white'
                        : 'bg-muted-foreground/15 text-muted-foreground',
                    )}>
                      {idx + 1}
                    </span>
                    <span className={cn(
                      'text-[12px] font-bold truncate',
                      isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}>
                      {stop.order.kunde_name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'text-[11px] font-black tabular-nums',
                      isDone ? 'text-matcha-600' : isLate ? 'text-red-500 animate-pulse' : isCurrent ? 'text-matcha-700' : 'text-muted-foreground',
                    )}>
                      {isDone && stop.geliefert_am
                        ? fmtTime(new Date(stop.geliefert_am))
                        : isLate ? 'Überfällig' : fmtTime(estArrival)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {isDone ? 'geliefert' : isCurrent ? 'Ziel' : 'ca.'}
                    </div>
                  </div>
                </div>

                {stop.order.kunde_adresse && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <MapPin size={9} className="shrink-0" />
                    {stop.order.kunde_adresse}
                  </div>
                )}

                {distKm && idx > 0 && (
                  <div className="mt-0.5 text-[9px] text-muted-foreground">
                    ca. {distKm} km vom Vorgänger
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
