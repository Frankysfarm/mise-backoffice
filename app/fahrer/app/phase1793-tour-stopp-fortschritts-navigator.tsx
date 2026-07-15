'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Package, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

/**
 * Phase 1793 — Tour-Stopp-Fortschritts-Navigator (Fahrer-App)
 *
 * Kompakter Tour-Fortschrittsbalken mit Liste aller Stopps,
 * aktivem Stopp hervorgehoben, abgeschlossene grün markiert.
 * Karten-Link für aktiven Stopp; 2-Min-Polling; Mock-Fallback.
 * Nutzt /api/delivery/driver/tour-stops (Phase 502).
 */

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  kunde_name?: string | null;
  bestellnummer?: string | null;
  status: 'offen' | 'aktiv' | 'abgeschlossen';
  eta_min?: number | null;
  distanz_km?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface TourAntwort {
  stopps: TourStopp[];
  abgeschlossen: number;
  gesamt: number;
  tour_id?: string | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

function buildMock(): TourAntwort {
  return {
    gesamt: 4,
    abgeschlossen: 1,
    tour_id: 'mock-tour',
    stopps: [
      { stopp_nr: 1, adresse: 'Berliner Str. 12, 10115 Berlin', kunde_name: 'K. Braun',  bestellnummer: '#1038', status: 'abgeschlossen' },
      { stopp_nr: 2, adresse: 'Unter den Linden 5, 10117 Berlin', kunde_name: 'M. Schulz', bestellnummer: '#1039', status: 'aktiv', eta_min: 4, distanz_km: 1.8 },
      { stopp_nr: 3, adresse: 'Friedrichstr. 88, 10117 Berlin', kunde_name: 'J. Richter', bestellnummer: '#1041', status: 'offen', eta_min: 14, distanz_km: 3.2 },
      { stopp_nr: 4, adresse: 'Rosenthaler Str. 40, 10119 Berlin', kunde_name: 'A. König',  bestellnummer: '#1042', status: 'offen', eta_min: 22, distanz_km: 5.1 },
    ],
  };
}

function kartenLink(s: TourStopp): string {
  if (s.lat && s.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.adresse)}`;
}

export function FahrerPhase1793TourStoppFortschrittsNavigator({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<TourAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.stopps) && json.stopps.length > 0) {
          setData(json);
        } else {
          setData(isOnline ? null : buildMock());
        }
      } else {
        setData(buildMock());
      }
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!data) return null;

  const { stopps, abgeschlossen, gesamt } = data;
  const fortschrittPct = gesamt > 0 ? Math.round((abgeschlossen / gesamt) * 100) : 0;
  const aktiverStopp = stopps.find(s => s.status === 'aktiv') ?? null;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-matcha-600 shrink-0" />
            <span className="font-display text-sm font-bold uppercase tracking-wider">Tour-Fortschritt</span>
          </div>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
            {abgeschlossen}/{gesamt} Stopps
          </span>
        </div>
        {/* Fortschrittsbalken */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${fortschrittPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">{fortschrittPct}% abgeschlossen</span>
          {aktiverStopp?.eta_min && (
            <span className="text-[9px] font-bold text-matcha-600 dark:text-matcha-400 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> Nächster Stopp in ~{aktiverStopp.eta_min} Min
            </span>
          )}
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-border">
        {stopps.map((stopp) => {
          const isAktiv = stopp.status === 'aktiv';
          const isDone = stopp.status === 'abgeschlossen';
          return (
            <div
              key={stopp.stopp_nr}
              className={cn(
                'px-4 py-3 flex items-start gap-3 transition-colors',
                isAktiv ? 'bg-matcha-50 dark:bg-matcha-950/30' : isDone ? 'opacity-60' : '',
              )}
            >
              {/* Status-Icon */}
              <div className="shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                ) : isAktiv ? (
                  <Navigation className="h-4 w-4 text-matcha-600 animate-pulse" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-border flex items-center justify-center">
                    <span className="text-[8px] font-black text-muted-foreground">{stopp.stopp_nr}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {stopp.bestellnummer && (
                    <span className={cn('text-[10px] font-bold rounded px-1.5 py-0.5',
                      isAktiv ? 'bg-matcha-100 dark:bg-matcha-900/50 text-matcha-700 dark:text-matcha-300' : 'bg-muted text-muted-foreground'
                    )}>
                      {stopp.bestellnummer}
                    </span>
                  )}
                  {stopp.kunde_name && (
                    <span className="text-[11px] font-semibold text-foreground truncate">{stopp.kunde_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{stopp.adresse}</span>
                </div>
                {isAktiv && stopp.distanz_km && (
                  <div className="mt-1 text-[10px] text-matcha-600 dark:text-matcha-400 font-semibold">
                    {stopp.distanz_km.toFixed(1)} km entfernt
                  </div>
                )}
              </div>

              {/* Navigation-Link (aktiver Stopp) */}
              {isAktiv && (
                <a
                  href={kartenLink(stopp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-matcha-500 text-white px-3 py-1.5 text-[11px] font-bold hover:bg-matcha-600 transition-colors active:scale-95"
                >
                  <Navigation className="h-3 w-3" />
                  Navi
                  <ChevronRight className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="px-4 py-2 border-t border-border">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/2 bg-matcha-300 animate-pulse rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
