'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, ChevronDown, ChevronUp, Loader2, Route, Clock, Star } from 'lucide-react';

/**
 * Phase 964 — Tour-Reihenfolge-Vorschlag (Fahrer-App)
 *
 * Optimale Stopp-Reihenfolge für aktuelle Tour via /api/delivery/driver/routen-optimierung.
 * 10-Min-Polling, isOnline-Guard.
 */

interface OptimierterStop {
  stop_id: string;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  zone: string;
  eta_min: number;
  reihenfolge: number;
  geschaetzte_ankunft_min: number;
  distanz_km: number;
  prioritaet: 'hoch' | 'normal' | 'niedrig';
  artikel_anzahl: number;
}

interface ApiResponse {
  stopps: OptimierterStop[];
  gesamt_km: number;
  gesamt_min: number;
  generatedAt: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase964TourReihenfolgeVorschlag({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const laden = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/delivery/driver/routen-optimierung?driver_id=${driverId}`);
        if (!res.ok) throw new Error('Fehler');
        const json: ApiResponse = await res.json();
        setData(json);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    laden();
    const interval = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driverId, isOnline]);

  if (!isOnline || (!loading && !data && !error)) return null;

  const prioBadge = (p: OptimierterStop['prioritaet']) => {
    if (p === 'hoch') return <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">Dringend</span>;
    if (p === 'normal') return <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-white">Normal</span>;
    return null;
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-4">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            Optimale Stopp-Reihenfolge
          </span>
          {data && (
            <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
              {data.stopps.length} Stopps · {data.gesamt_km} km
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Route wird optimiert…
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500 py-2">Route konnte nicht geladen werden.</p>
          )}

          {data && !loading && (
            <>
              {/* Zusammenfassung */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{data.gesamt_km} km</div>
                  <div className="text-xs text-muted-foreground">Gesamt</div>
                </div>
                <div className="flex-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-matcha-700 dark:text-matcha-300">{data.gesamt_min} Min</div>
                  <div className="text-xs text-muted-foreground">Geschätzt</div>
                </div>
                <div className="flex-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{data.stopps.length}</div>
                  <div className="text-xs text-muted-foreground">Stopps</div>
                </div>
              </div>

              {/* Stopp-Liste */}
              <div className="space-y-2">
                {data.stopps.map((stopp, idx) => (
                  <div
                    key={stopp.stop_id}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm',
                      idx === 0
                        ? 'border-matcha-300 bg-matcha-50 dark:border-matcha-700 dark:bg-matcha-900/30'
                        : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shrink-0',
                          idx === 0 ? 'bg-matcha-600' : 'bg-zinc-400',
                        )}>
                          {stopp.reihenfolge}
                        </span>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {stopp.bestellnummer}
                            {prioBadge(stopp.prioritaet)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{stopp.adresse}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          +{stopp.geschaetzte_ankunft_min} Min
                        </div>
                        <div className="text-xs text-muted-foreground">{stopp.distanz_km} km</div>
                      </div>
                    </div>
                    {stopp.artikel_anzahl > 1 && (
                      <div className="mt-1 text-xs text-muted-foreground">{stopp.artikel_anzahl} Artikel</div>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Nearest-Neighbor-Optimierung · Prio-Stopps zuerst · Aktualisiert {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
