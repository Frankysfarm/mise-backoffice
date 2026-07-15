'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, Banknote, MapPin, RefreshCw, Route, Star } from 'lucide-react';

/**
 * Phase 1779 — Meine Schicht-Bilanz-Karte (Fahrer-App)
 *
 * Letzte abgeschlossene Tour: Einnahmen + Bewertung + km.
 * Immer sichtbar nach letzter Tour; isOnline-Guard; 30-Min-Polling.
 */

interface SchichtBilanzAntwort {
  fahrer_id: string;
  letzte_tour_id: string | null;
  letzte_tour_einnahmen_eur: number;
  letzte_tour_bewertung: number | null;
  letzte_tour_km: number;
  letzte_tour_stopps: number;
  letzte_tour_abgeschlossen_vor_min: number | null;
  schicht_einnahmen_gesamt_eur: number;
  schicht_touren_anzahl: number;
  schicht_bewertung_avg: number | null;
  schicht_km_gesamt: number;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

function Stern({ filled }: { filled: boolean }) {
  return (
    <Star
      className={cn('h-3.5 w-3.5', filled ? 'fill-saffron text-saffron' : 'text-muted-foreground')}
    />
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Stern key={i} filled={i < Math.round(rating)} />
      ))}
      <span className="ml-1 text-xs font-bold tabular-nums">{rating.toFixed(1)}</span>
    </div>
  );
}

async function fetchBilanz(driverId: string): Promise<SchichtBilanzAntwort | null> {
  try {
    const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
    if (res.ok) return res.json();
  } catch {}
  // Mock-Fallback
  return {
    fahrer_id: driverId,
    letzte_tour_id: 'tour-mock-1',
    letzte_tour_einnahmen_eur: 34.5,
    letzte_tour_bewertung: 4.8,
    letzte_tour_km: 8.3,
    letzte_tour_stopps: 4,
    letzte_tour_abgeschlossen_vor_min: 22,
    schicht_einnahmen_gesamt_eur: 148.2,
    schicht_touren_anzahl: 5,
    schicht_bewertung_avg: 4.7,
    schicht_km_gesamt: 41.6,
    generiert_am: new Date().toISOString(),
  };
}

export function FahrerPhase1779MeineSchichtBilanzKarte({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<SchichtBilanzAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!driverId) return;
    setLoading(true);
    try {
      const result = await fetchBilanz(driverId);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOnline || !driverId) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline) return null;
  if (!data && !loading) return null;

  const hatteTour = data && data.letzte_tour_id !== null;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Meine Schicht-Bilanz</span>
        </div>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {!data && loading && (
        <div className="text-sm text-muted-foreground text-center py-2">Lade Bilanz…</div>
      )}

      {data && (
        <div className="space-y-3">
          {/* Schicht-Gesamt */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-saffron/10 px-3 py-2">
              <p className="text-[10px] text-saffron/80 font-bold uppercase tracking-wide">Schicht gesamt</p>
              <p className="text-lg font-black tabular-nums text-saffron">
                {data.schicht_einnahmen_gesamt_eur.toFixed(2)} €
              </p>
              <p className="text-[10px] text-muted-foreground">{data.schicht_touren_anzahl} Touren</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Route className="h-3 w-3 text-matcha-600" />
                <span className="text-xs font-bold">{data.schicht_km_gesamt.toFixed(1)} km</span>
              </div>
              {data.schicht_bewertung_avg && (
                <StarRow rating={data.schicht_bewertung_avg} />
              )}
            </div>
          </div>

          {/* Letzte Tour */}
          {hatteTour && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Letzte Tour
                </span>
                {data.letzte_tour_abgeschlossen_vor_min !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    vor {data.letzte_tour_abgeschlossen_vor_min} Min
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-saffron mb-0.5">
                    <Banknote className="h-3.5 w-3.5" />
                    <span className="text-sm font-black tabular-nums">
                      {data.letzte_tour_einnahmen_eur.toFixed(2)} €
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">Einnahmen</p>
                </div>

                <div>
                  <div className="flex items-center justify-center gap-1 text-matcha-600 mb-0.5">
                    <Route className="h-3.5 w-3.5" />
                    <span className="text-sm font-black tabular-nums">
                      {data.letzte_tour_km.toFixed(1)} km
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">Strecke</p>
                </div>

                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-sm font-black tabular-nums">
                      {data.letzte_tour_stopps}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">Stopps</p>
                </div>
              </div>

              {data.letzte_tour_bewertung && (
                <div className="flex items-center justify-center">
                  <StarRow rating={data.letzte_tour_bewertung} />
                </div>
              )}
            </div>
          )}

          {!hatteTour && (
            <p className="text-xs text-muted-foreground text-center py-1">
              Noch keine abgeschlossene Tour heute.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
