'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kundeName: string;
  etaMin: number | null;
  geliefert: boolean;
  lat?: number | null;
  lng?: number | null;
  bestellnummer: string;
  betrag: number;
}

interface NavData {
  batchId: string;
  aktuellerStoppId: string | null;
  stopps: NavStop[];
  verbleibendStopps: number;
  geliefertStopps: number;
}

interface Props {
  driverId: string;
  activeBatchId?: string | null;
  stops?: Array<{
    id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order?: {
      bestellnummer: string;
      kunde_name: string;
      kunde_adresse: string | null;
      gesamtbetrag?: number;
      eta_earliest?: string | null;
      kunde_lat?: number | null;
      kunde_lng?: number | null;
    } | null;
  }>;
}

function openNavi(lat: number, lng: number, label: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`, '_blank');
  }
}

export function FahrerPhase850TourStoppNavPro({ driverId, activeBatchId, stops = [] }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (!activeBatchId || stops.length === 0) return null;

  const navStopps: NavStop[] = stops.map((s, idx) => {
    const etaMs = s.order?.eta_earliest ? new Date(s.order.eta_earliest).getTime() : null;
    const etaMin = etaMs ? Math.round((etaMs - Date.now()) / 60_000) : null;
    return {
      id: s.id,
      reihenfolge: s.reihenfolge ?? idx + 1,
      adresse: s.order?.kunde_adresse ?? 'Adresse unbekannt',
      kundeName: s.order?.kunde_name ?? '–',
      etaMin,
      geliefert: !!s.geliefert_am,
      lat: s.order?.kunde_lat ?? null,
      lng: s.order?.kunde_lng ?? null,
      bestellnummer: s.order?.bestellnummer ?? `#${idx + 1}`,
      betrag: s.order?.gesamtbetrag ?? 0,
    };
  }).sort((a, b) => a.reihenfolge - b.reihenfolge);

  const aktuellerStopp = navStopps.find((s) => !s.geliefert) ?? null;
  const geliefert = navStopps.filter((s) => s.geliefert).length;
  const gesamt = navStopps.length;
  const fortschrittPct = gesamt > 0 ? Math.round((geliefert / gesamt) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-matcha-50 dark:bg-matcha-900/10">
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-800 dark:text-matcha-300">
          Tour-Stopp Navigator Pro
        </span>
        <span className="ml-auto text-[10px] font-bold text-matcha-600">
          {geliefert}/{gesamt} Stopps
        </span>
      </div>

      {/* Fortschritts-Leiste */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${fortschrittPct}%` }}
        />
      </div>

      {/* Nächster Stopp – prominente Hervorhebung */}
      {aktuellerStopp && (
        <div className="px-4 py-3 bg-matcha-50 dark:bg-matcha-900/15 border-b">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white text-[10px] font-black">
              {aktuellerStopp.reihenfolge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-600 mb-0.5">
                Nächster Stopp
              </div>
              <div className="text-sm font-bold truncate">{aktuellerStopp.kundeName}</div>
              <div className="text-xs text-muted-foreground truncate">{aktuellerStopp.adresse}</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-muted-foreground">#{aktuellerStopp.bestellnummer}</span>
                {aktuellerStopp.etaMin !== null && (
                  <span className={cn(
                    'flex items-center gap-1 text-[10px] font-bold',
                    aktuellerStopp.etaMin < 0 ? 'text-red-600' : aktuellerStopp.etaMin <= 5 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    <Clock className="h-3 w-3" />
                    {aktuellerStopp.etaMin < 0 ? `${Math.abs(aktuellerStopp.etaMin)}m verspätet` : `~${aktuellerStopp.etaMin}m ETA`}
                  </span>
                )}
              </div>
            </div>
            {aktuellerStopp.lat && aktuellerStopp.lng && (
              <button
                onClick={() => openNavi(aktuellerStopp.lat!, aktuellerStopp.lng!, aktuellerStopp.adresse)}
                className="shrink-0 flex items-center gap-1 rounded-lg bg-matcha-600 px-3 py-2 text-[11px] font-bold text-white active:scale-95 transition-transform"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navi
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps — kompakte Liste */}
      <div className="divide-y">
        {navStopps.map((stopp) => (
          <div
            key={stopp.id}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2.5',
              stopp.geliefert ? 'opacity-50' : stopp.id === aktuellerStopp?.id ? 'bg-matcha-50/50' : '',
            )}
          >
            {stopp.geliefert ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-matcha-500" />
            ) : (
              <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black',
                stopp.id === aktuellerStopp?.id
                  ? 'bg-matcha-600 text-white'
                  : 'bg-muted text-muted-foreground',
              )}>
                {stopp.reihenfolge}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-xs font-semibold truncate', stopp.geliefert && 'line-through text-muted-foreground')}>
                  {stopp.kundeName}
                </span>
                <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">#{stopp.bestellnummer}</span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{stopp.adresse}</div>
            </div>

            <div className="shrink-0 flex items-center gap-1">
              {stopp.etaMin !== null && !stopp.geliefert && (
                <span className={cn(
                  'text-[9px] font-bold tabular-nums',
                  stopp.etaMin < 0 ? 'text-red-500' : stopp.etaMin <= 5 ? 'text-amber-500' : 'text-muted-foreground',
                )}>
                  {stopp.etaMin < 0 ? `-${Math.abs(stopp.etaMin)}m` : `${stopp.etaMin}m`}
                </span>
              )}
              {stopp.lat && stopp.lng && !stopp.geliefert && (
                <button
                  onClick={() => openNavi(stopp.lat!, stopp.lng!, stopp.adresse)}
                  className="rounded-md border border-matcha-200 bg-matcha-50 p-1 text-matcha-600 active:bg-matcha-100"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-1.5 bg-muted/30 border-t">
        <p className="text-[9px] text-muted-foreground">Tour-Stopp Navigator Pro · Phase 850 · {gesamt - geliefert} ausstehend</p>
      </div>
    </div>
  );
}
