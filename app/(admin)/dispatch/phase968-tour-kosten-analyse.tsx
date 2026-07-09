'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Euro, ChevronDown, ChevronUp, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 968 — Tour-Kosten-Analyse (Dispatch)
 *
 * Echtzeit-Kalkulation Kraftstoff + Fahrerlohn + km-Kosten je laufender Tour.
 * Nutzt bestehende /api/delivery/admin/tour-kosten-effizienz API.
 * 2-Min-Polling.
 */

interface Props {
  locationId: string | null;
}

interface TourKosten {
  tour_id: string;
  fahrer: string;
  stops: number;
  km_geschaetzt: number;
  einnahmen: number;
  kosten_geschaetzt: number;
  margin: number;
  margin_pct: number;
  bewertung: 'gut' | 'mittel' | 'schlecht';
}

interface ApiResponse {
  touren: TourKosten[];
  generiert_am: string;
}

function BewertungBadge({ bewertung }: { bewertung: TourKosten['bewertung'] }) {
  if (bewertung === 'gut') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">
        <TrendingUp className="h-2.5 w-2.5" />
        Gut
      </span>
    );
  }
  if (bewertung === 'mittel') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <TrendingDown className="h-2.5 w-2.5" />
        Mittel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <AlertTriangle className="h-2.5 w-2.5" />
      Schlecht
    </span>
  );
}

export function DispatchPhase968TourKostenAnalyse({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [touren, setTouren] = useState<TourKosten[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-kosten-effizienz?location_id=${locationId}`);
      if (!res.ok) return;
      const json: ApiResponse = await res.json();
      setTouren(json.touren ?? []);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const interval = setInterval(laden, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [laden]);

  const schlechteTouren = touren.filter((t) => t.bewertung === 'schlecht');
  const gesamtEinnahmen = touren.reduce((s, t) => s + t.einnahmen, 0);
  const gesamtKosten = touren.reduce((s, t) => s + t.kosten_geschaetzt, 0);
  const gesamtMargin = gesamtEinnahmen - gesamtKosten;

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-4 mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            Tour-Kosten-Analyse
          </span>
          {touren.length > 0 && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {touren.length} Touren aktiv
            </span>
          )}
          {schlechteTouren.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              {schlechteTouren.length} Defizit
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && touren.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Lade Kosten-Daten…</p>
          )}

          {!loading && touren.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Keine aktiven Touren gefunden.
            </p>
          )}

          {touren.map((tour) => (
            <div
              key={tour.tour_id}
              className={cn(
                'rounded-lg border p-3',
                tour.bewertung === 'gut' && 'border-matcha-200 bg-white dark:border-matcha-800 dark:bg-zinc-900',
                tour.bewertung === 'mittel' && 'border-amber-200 bg-white dark:border-amber-800 dark:bg-zinc-900',
                tour.bewertung === 'schlecht' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-sm">{tour.fahrer}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {tour.stops} Stopps · {tour.km_geschaetzt} km geschätzt
                  </div>
                </div>
                <BewertungBadge bewertung={tour.bewertung} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-muted-foreground">Einnahmen</div>
                  <div className="font-bold text-xs text-matcha-700">
                    €{tour.einnahmen.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-muted-foreground">Kosten</div>
                  <div className="font-bold text-xs text-red-600">
                    €{tour.kosten_geschaetzt.toFixed(2)}
                  </div>
                </div>
                <div className={cn(
                  'rounded-lg px-2 py-1.5 text-center',
                  tour.margin >= 0 ? 'bg-matcha-50 dark:bg-matcha-950/30' : 'bg-red-50 dark:bg-red-950/30',
                )}>
                  <div className="text-[10px] text-muted-foreground">Marge</div>
                  <div className={cn(
                    'font-bold text-xs tabular-nums',
                    tour.margin >= 0 ? 'text-matcha-700' : 'text-red-600',
                  )}>
                    {tour.margin >= 0 ? '+' : ''}€{tour.margin.toFixed(2)}
                    <span className="ml-1 font-normal text-[9px]">({tour.margin_pct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {touren.length > 0 && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900/30 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-200">Gesamt alle Touren</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    €{gesamtEinnahmen.toFixed(2)} Einnahmen
                  </span>
                  <span className="text-muted-foreground">
                    €{gesamtKosten.toFixed(2)} Kosten
                  </span>
                  <span className={cn(
                    'font-bold tabular-nums',
                    gesamtMargin >= 0 ? 'text-matcha-700' : 'text-red-600',
                  )}>
                    {gesamtMargin >= 0 ? '+' : ''}€{gesamtMargin.toFixed(2)} Marge
                  </span>
                </div>
              </div>
            </div>
          )}

          {lastUpdate && (
            <p className="text-[10px] text-muted-foreground text-right">
              Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 2 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
