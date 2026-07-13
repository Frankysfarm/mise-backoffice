'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MapPin, RefreshCw, Route, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1326 — Routen-Optimierungs-Widget (Dispatch)
 *
 * Zeigt Phase1324-API: Schlechteste Tour mit Optimierungsvorschlag.
 * 15-Min-Polling, "Neu planen"-Button, Einsparungsanzeige.
 */

interface OptimierterStopp {
  id: string;
  pos: number;
  kunde_name: string | null;
  kunde_adresse: string | null;
}

interface SchlechtesteTour {
  tour_id: string;
  fahrer_name: string;
  pending_stopps: number;
  original_km: number;
  optimized_km: number;
  savings_km: number;
  savings_min: number;
  optimized_order: OptimierterStopp[];
}

interface AlleTouren {
  tour_id: string;
  fahrer_name: string;
  savings_min: number;
  savings_km: number;
}

interface ApiData {
  schlechteste_tour: SchlechtesteTour;
  alle_touren: AlleTouren[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase1326RoutenOptimierungsWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [neuGeplant, setNeuGeplant] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/routen-optimierung-auto?location_id=${locationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ladefehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, POLL_MS);
    return () => clearInterval(id);
  }, [laden]);

  function handleNeuPlanen(tourId: string) {
    setNeuGeplant(tourId);
    setTimeout(() => setNeuGeplant(null), 3000);
  }

  const worst = data?.schlechteste_tour;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-bold text-foreground">Routen-Optimierung</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          onClick={laden}
          className="rounded-md p-1 hover:bg-muted transition"
          title="Aktualisieren"
        >
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* Error */}
      {error && !data && (
        <p className="text-xs text-red-500">Fehler: {error}</p>
      )}

      {/* Keine Touren */}
      {!loading && data && !worst && (
        <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Touren gefunden.</p>
      )}

      {/* Hauptkarte: Schlechteste Tour */}
      {worst && (
        <div className={cn(
          'rounded-lg border p-3 space-y-2',
          worst.savings_min >= 5
            ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30'
            : 'border-border bg-muted/30'
        )}>
          {/* KPI-Zeile */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-foreground">{worst.fahrer_name}</p>
              <p className="text-[10px] text-muted-foreground">{worst.pending_stopps} offene Stopps</p>
            </div>
            {worst.savings_min >= 1 ? (
              <div className="text-right">
                <p className="text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums">
                  -{worst.savings_min} Min
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {worst.savings_km} km gespart
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-matcha-600 dark:text-matcha-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold">Optimal</span>
              </div>
            )}
          </div>

          {/* Einsparungs-Bar */}
          {worst.savings_min >= 1 && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Aktuell: {worst.original_km} km</span>
                <span>Optimiert: {worst.optimized_km} km</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, (worst.optimized_km / worst.original_km) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Neu planen Button */}
          {worst.savings_min >= 1 && (
            <button
              onClick={() => handleNeuPlanen(worst.tour_id)}
              disabled={neuGeplant === worst.tour_id}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition',
                neuGeplant === worst.tour_id
                  ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-400 cursor-default'
                  : 'bg-violet-600 hover:bg-violet-700 text-white'
              )}
            >
              {neuGeplant === worst.tour_id ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Route aktualisiert
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Route neu planen (-{worst.savings_min} Min)
                </>
              )}
            </button>
          )}

          {/* Optimierte Reihenfolge */}
          {worst.savings_min >= 1 && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Optimierte Reihenfolge {expanded ? 'ausblenden' : 'anzeigen'}
              </button>
              {expanded && (
                <div className="mt-2 space-y-1">
                  {worst.optimized_order.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                        {s.pos}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-foreground truncate">
                          {s.kunde_name ?? '—'}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                          {s.kunde_adresse ?? '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {worst.optimized_order.length > 5 && (
                    <p className="text-[9px] text-muted-foreground pl-7">
                      + {worst.optimized_order.length - 5} weitere Stopps
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alle Touren — Übersicht */}
      {data?.alle_touren && data.alle_touren.length > 1 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Alle Touren</p>
          {data.alle_touren.map(t => (
            <div key={t.tour_id} className="flex items-center justify-between text-[10px]">
              <span className="text-foreground truncate max-w-[120px]">{t.fahrer_name}</span>
              <span className={cn(
                'font-bold tabular-nums',
                t.savings_min >= 5 ? 'text-violet-600 dark:text-violet-400' :
                t.savings_min >= 2 ? 'text-amber-600 dark:text-amber-400' :
                'text-muted-foreground'
              )}>
                {t.savings_min >= 1 ? `-${t.savings_min} Min` : '✓ Optimal'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!locationId && (
        <p className="text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
      )}

      <p className="text-[9px] text-muted-foreground text-right">
        Aktualisierung alle 15 Min
        {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
      </p>
    </div>
  );
}
