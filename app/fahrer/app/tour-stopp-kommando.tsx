'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, CheckCircle2, Clock, ChevronDown, ChevronUp, Phone } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kundenname?: string | null;
  telefon?: string | null;
  eta_min?: number | null;
  geliefert_am?: string | null;
  notiz?: string | null;
}

interface Props {
  stops: TourStop[];
  onNavigate?: (stop: TourStop) => void;
  onComplete?: (stopId: string) => void;
}

function formatEta(min: number | null | undefined) {
  if (min == null) return null;
  if (min < 60) return `${Math.round(min)} Min`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

export function TourStoppKommando({ stops, onNavigate, onComplete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find(s => !s.geliefert_am);
  const completed = sorted.filter(s => s.geliefert_am).length;
  const total = sorted.length;

  if (total === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        Keine Stopps in dieser Tour
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Stopps</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-emerald-600 font-bold">{completed}/{total} geliefert</span>
          {/* Mini progress */}
          <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Next stop highlight */}
      {nextStop && (
        <div className="border-b bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[8px] font-black">
                  {nextStop.reihenfolge}
                </span>
                Nächster Stopp
              </div>
              {nextStop.kundenname && (
                <div className="mt-0.5 text-sm font-semibold truncate">{nextStop.kundenname}</div>
              )}
              {nextStop.adresse && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {nextStop.adresse}{nextStop.plz ? `, ${nextStop.plz}` : ''}{nextStop.ort ? ` ${nextStop.ort}` : ''}
                </div>
              )}
              {nextStop.eta_min != null && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  <Clock className="h-3 w-3" />
                  ETA: {formatEta(nextStop.eta_min)}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {onNavigate && (
                <button
                  onClick={() => onNavigate(nextStop)}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white active:opacity-80"
                >
                  <Navigation className="h-3 w-3" />
                  Navi
                </button>
              )}
              {nextStop.telefon && (
                <a
                  href={`tel:${nextStop.telefon}`}
                  className="flex items-center gap-1 rounded-lg border border-muted-foreground/20 px-3 py-1.5 text-[11px] font-bold text-foreground active:opacity-80"
                >
                  <Phone className="h-3 w-3" />
                  Anruf
                </a>
              )}
            </div>
          </div>
          {nextStop.notiz && (
            <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              {nextStop.notiz}
            </div>
          )}
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y">
        {sorted.map(stop => {
          const done = !!stop.geliefert_am;
          const isCurrent = stop.id === nextStop?.id;
          const isExpanded = expanded === stop.id;

          return (
            <div key={stop.id} className={cn(isCurrent && 'hidden')}>
              <button
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition"
              >
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  done ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                )}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.reihenfolge}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-xs font-medium truncate', done && 'line-through text-muted-foreground')}>
                    {stop.kundenname || 'Kunde'}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {stop.adresse || 'Adresse fehlt'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stop.eta_min != null && !done && (
                    <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
                      {formatEta(stop.eta_min)}
                    </span>
                  )}
                  {done && (
                    <span className="text-[9px] text-emerald-600 font-bold">✓</span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 bg-muted/20 space-y-2">
                  {(stop.adresse || stop.plz || stop.ort) && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{[stop.adresse, stop.plz, stop.ort].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {stop.notiz && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                      {stop.notiz}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {onNavigate && !done && (
                      <button
                        onClick={() => onNavigate(stop)}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white active:opacity-80"
                      >
                        <Navigation className="h-3 w-3" />
                        Navigation starten
                      </button>
                    )}
                    {stop.telefon && (
                      <a
                        href={`tel:${stop.telefon}`}
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold active:opacity-80"
                      >
                        <Phone className="h-3 w-3" />
                        Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {completed === total && total > 0 && (
        <div className="border-t bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Tour abgeschlossen — alle {total} Stopps geliefert
        </div>
      )}
    </div>
  );
}
