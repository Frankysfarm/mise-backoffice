'use client';

/**
 * TourStoppZeitlinie — Visuelle Stopp-Zeitlinie einer Tour mit Status und ETA-Annotierungen.
 *
 * Zeigt:
 *  - Alle Stopps als vertikale Zeitlinie: ✓ erledigt / → aktuell (pulsiert) / ○ ausstehend
 *  - Kundename + Adresse + Lieferzeitpunkt (wenn erledigt) je Stopp
 *  - Fortschrittsanzeige oben: X von N Stopps erledigt
 *  - Kompaktes Design, mobile-first
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, MapPin, Clock } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    gesamtbetrag: number;
  } | null;
  eta_min?: number | null;
}

interface Props {
  stops: TourStop[];
  className?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TourStoppZeitlinie({ stops, className }: Props) {
  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const done    = sorted.filter(s => s.geliefert_am).length;
  const total   = sorted.length;
  const current = sorted.find(s => !s.geliefert_am);

  if (total === 0) return null;

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Stopps</span>
        <span className="ml-auto text-[11px] font-bold text-matcha-700">
          {done}/{total} erledigt
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2.5 pb-0">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-700"
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 space-y-0">
        {sorted.map((stop, idx) => {
          const isDone    = !!stop.geliefert_am;
          const isCurrent = stop.id === current?.id;
          const isPending = !isDone && !isCurrent;
          const isLast    = idx === total - 1;

          return (
            <div key={stop.id} className="flex gap-3">
              {/* Line + Icon */}
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10',
                  isDone    ? 'bg-matcha-500'  : isCurrent ? 'bg-amber-500 animate-pulse' : 'bg-muted',
                )}>
                  {isDone
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    : <Circle className={cn('h-3.5 w-3.5', isCurrent ? 'text-white' : 'text-muted-foreground')} />
                  }
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 flex-1 my-0.5 min-h-[20px]', isDone ? 'bg-matcha-300' : 'bg-muted')} />
                )}
              </div>

              {/* Content */}
              <div className={cn('flex-1 pb-3', isLast && 'pb-1')}>
                <div className={cn(
                  'rounded-lg border px-3 py-2',
                  isDone    ? 'bg-matcha-50/60 border-matcha-200' :
                  isCurrent ? 'bg-amber-50 border-amber-300 shadow-sm' :
                              'bg-muted/20 border-border',
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'text-[9px] font-black rounded px-1 py-0.5',
                          isDone ? 'bg-matcha-200 text-matcha-800' :
                          isCurrent ? 'bg-amber-200 text-amber-800' :
                          'bg-muted text-muted-foreground',
                        )}>
                          #{stop.reihenfolge}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wide">Aktuell</span>
                        )}
                      </div>
                      <div className={cn('text-[11px] font-bold mt-0.5 leading-tight truncate', isPending && 'text-muted-foreground')}>
                        {stop.order?.kunde_name ?? 'Unbekannt'}
                      </div>
                      {stop.order?.kunde_adresse && (
                        <div className="text-[10px] text-muted-foreground truncate leading-snug">
                          {stop.order.kunde_adresse}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {isDone && stop.geliefert_am && (
                        <div className="flex items-center gap-0.5 text-[10px] text-matcha-700 font-bold">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(stop.geliefert_am)}
                        </div>
                      )}
                      {isCurrent && stop.eta_min != null && (
                        <div className="text-[10px] font-bold text-amber-700">
                          ~{stop.eta_min} Min
                        </div>
                      )}
                      {stop.order && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {(stop.order.gesamtbetrag / 100).toFixed(2)} €
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
