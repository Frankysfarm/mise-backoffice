'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Circle, Navigation, Clock, ChevronRight } from 'lucide-react';

// Phase 1471 — Tour-Stopp Smart Navigator (Fahrer-App)
// Zeigt alle Tour-Stopps als priorisierte Liste:
// Abgeschlossen (grün) / Aktuell (pulsierend) / Ausstehend (grau)
// Mit ETA je Stopp + schnellem Navigations-Button.

interface Stop {
  id: string;
  adresse?: string | null;
  customer_name?: string | null;
  geliefert_am?: string | null;
  eta?: string | null;
  sort_order?: number | null;
  bestellnummer?: number | null;
}

interface Batch {
  id: string;
  stops?: Stop[];
}

interface Props {
  activeBatch: Batch | null;
  isOnline: boolean;
  className?: string;
}

function fmtEta(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    const diffMin = Math.round((d.getTime() - Date.now()) / 60_000);
    if (diffMin < 0) return 'Jetzt';
    if (diffMin < 60) return `~${diffMin} Min`;
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function openNav(adresse: string | null | undefined) {
  if (!adresse) return;
  const encoded = encodeURIComponent(adresse);
  window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank', 'noopener');
}

export function FahrerPhase1471TourStoppSmartNavigator({ activeBatch, isOnline, className }: Props) {
  const stops = useMemo(() => {
    if (!activeBatch?.stops?.length) return [];
    return [...activeBatch.stops].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [activeBatch]);

  if (!isOnline || stops.length === 0) return null;

  const currentIdx = stops.findIndex((s) => !s.geliefert_am);

  return (
    <div className={cn('rounded-2xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Navigation</span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground tabular-nums">
          {stops.filter((s) => !!s.geliefert_am).length}/{stops.length} Stopps
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${(stops.filter((s) => !!s.geliefert_am).length / stops.length) * 100}%` }}
        />
      </div>

      {/* Stop list */}
      <div className="divide-y">
        {stops.map((stop, idx) => {
          const done = !!stop.geliefert_am;
          const isCurrent = idx === currentIdx;
          const eta = fmtEta(stop.eta);

          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                done ? 'opacity-50' : isCurrent ? 'bg-matcha-50 dark:bg-matcha-950/30' : '',
              )}
            >
              {/* Status icon */}
              <div className={cn(
                'shrink-0 h-6 w-6 rounded-full flex items-center justify-center',
                done ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                isCurrent ? 'bg-matcha-100 dark:bg-matcha-900/40' :
                'bg-muted',
              )}>
                {done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  : isCurrent
                    ? <MapPin className="h-4 w-4 text-matcha-600 dark:text-matcha-400 animate-pulse" />
                    : <Circle className="h-3 w-3 text-muted-foreground" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-xs font-bold truncate',
                    done ? 'line-through text-muted-foreground' : '',
                  )}>
                    {stop.customer_name ?? (stop.bestellnummer ? `#${stop.bestellnummer}` : `Stopp ${idx + 1}`)}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300 rounded-full px-1.5 py-0.5">
                      Aktuell
                    </span>
                  )}
                </div>
                {stop.adresse && (
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{stop.adresse}</div>
                )}
                {eta && !done && (
                  <div className="flex items-center gap-1 text-[10px] text-matcha-600 dark:text-matcha-400 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    ETA: {eta}
                  </div>
                )}
              </div>

              {/* Navigation button */}
              {!done && stop.adresse && (
                <button
                  onClick={() => openNav(stop.adresse)}
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition',
                    isCurrent
                      ? 'bg-matcha-600 text-white hover:bg-matcha-700'
                      : 'border border-muted bg-background text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <Navigation className="h-2.5 w-2.5" />
                  {isCurrent ? 'Navi' : <ChevronRight className="h-2.5 w-2.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
