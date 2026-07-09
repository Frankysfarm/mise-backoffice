'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight, Clock, Loader2, MapPin, Navigation, Package, Phone, ZoomIn } from 'lucide-react';

type Stop = {
  stopNr: number;
  adresse: string;
  kundeName: string;
  telefon?: string | null;
  etaSec: number;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen';
  notiz?: string | null;
  bestellnummer?: string;
  betrag?: number;
};

type TourData = {
  batchId: string;
  stops: Stop[];
  distanceKmRestlich?: number;
};

function useCountdownTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function formatEta(sec: number): string {
  if (sec <= 0) return 'Ankunft';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

function openNavigation(adresse: string) {
  const q = encodeURIComponent(adresse);
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad/.test(ua)) {
    window.location.href = `maps://?daddr=${q}`;
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
  }
}

const MOCK_TOUR: TourData = {
  batchId: 'mock',
  distanceKmRestlich: 4.2,
  stops: [
    {
      stopNr: 1, adresse: 'Hauptstraße 12, Berlin', kundeName: 'Max Müller',
      telefon: '+49 151 123456', etaSec: 240, status: 'aktiv',
      bestellnummer: '1042', betrag: 24.9,
      notiz: 'Bitte klingeln — 3. OG links',
    },
    {
      stopNr: 2, adresse: 'Bahnhofstraße 5, Berlin', kundeName: 'Anna Schmidt',
      etaSec: 600, status: 'ausstehend',
      bestellnummer: '1043', betrag: 18.5,
    },
    {
      stopNr: 3, adresse: 'Kirchweg 3, Berlin', kundeName: 'Tom Weber',
      etaSec: 900, status: 'ausstehend',
      bestellnummer: '1044', betrag: 31.0,
    },
  ],
};

export function FahrerPhase1040NaechsterStoppUltraKommando() {
  useCountdownTick();
  const [tour, setTour] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/delivery/driver/tour')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d?.tour) setTour(d.tour);
          else setTour(MOCK_TOUR);
        })
        .catch(() => { if (!cancelled) setTour(MOCK_TOUR); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const confirmDelivery = async (stopNr: number) => {
    if (!tour) return;
    setConfirming(stopNr);
    try {
      await fetch('/api/delivery/driver/stop-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: tour.batchId, stopNr }),
      });
      setTour((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stops: prev.stops.map((s) =>
            s.stopNr === stopNr ? { ...s, status: 'abgeschlossen' } : s
          ),
        };
      });
    } catch {
      // ignore
    } finally {
      setConfirming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Tour…
      </div>
    );
  }

  if (!tour || tour.stops.length === 0) return null;

  const pendingStops = tour.stops.filter((s) => s.status !== 'abgeschlossen');
  const currentStop = pendingStops.find((s) => s.status === 'aktiv') ?? pendingStops[0] ?? null;
  const nextStops = pendingStops.filter((s) => s !== currentStop).slice(0, 2);
  const doneCount = tour.stops.filter((s) => s.status === 'abgeschlossen').length;

  return (
    <div className="space-y-3">
      {/* Progress strip */}
      <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Tour-Fortschritt</span>
          <span className="text-[11px] font-bold text-white/70 tabular-nums">
            {doneCount}/{tour.stops.length} Stopps
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-400 transition-all"
            style={{ width: `${(doneCount / tour.stops.length) * 100}%` }}
          />
        </div>
        {tour.distanceKmRestlich !== undefined && (
          <div className="mt-1 text-[10px] text-white/50 text-right">
            {tour.distanceKmRestlich.toFixed(1)} km verbleibend
          </div>
        )}
      </div>

      {/* Current stop - large card */}
      {currentStop && (
        <div className="rounded-2xl bg-white/15 border-2 border-white/30 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-0.5">
                Aktueller Stopp #{currentStop.stopNr}
              </div>
              <div className="text-base font-black text-white leading-tight">
                {currentStop.kundeName}
              </div>
              <div className="text-sm text-white/70 mt-0.5">{currentStop.adresse}</div>
            </div>
            {/* ETA ring */}
            <div className="flex flex-col items-center shrink-0">
              <div className={cn(
                'text-2xl font-black tabular-nums',
                currentStop.etaSec <= 60 ? 'text-amber-300 animate-pulse' : 'text-white',
              )}>
                {formatEta(currentStop.etaSec)}
              </div>
              <div className="text-[9px] text-white/50 uppercase tracking-wide">ETA</div>
            </div>
          </div>

          {currentStop.notiz && (
            <div className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-3 py-2 text-xs text-amber-200">
              {currentStop.notiz}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => openNavigation(currentStop.adresse)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white text-sm font-bold py-3 transition-colors"
            >
              <Navigation size={16} /> Navigation
            </button>
            {currentStop.telefon && (
              <a
                href={`tel:${currentStop.telefon}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-4 py-3 transition-colors"
              >
                <Phone size={16} />
              </a>
            )}
            <button
              onClick={() => confirmDelivery(currentStop.stopNr)}
              disabled={confirming === currentStop.stopNr}
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-500 hover:bg-matcha-400 active:bg-matcha-600 text-white text-sm font-bold px-4 py-3 transition-colors disabled:opacity-60"
            >
              {confirming === currentStop.stopNr
                ? <Loader2 size={16} className="animate-spin" />
                : <CheckCircle2 size={16} />}
            </button>
          </div>

          {(currentStop.bestellnummer || currentStop.betrag !== undefined) && (
            <div className="flex items-center gap-3 text-[11px] text-white/50">
              {currentStop.bestellnummer && (
                <span className="flex items-center gap-1">
                  <Package size={10} /> #{currentStop.bestellnummer}
                </span>
              )}
              {currentStop.betrag !== undefined && (
                <span className="font-bold text-white/70">
                  {currentStop.betrag.toFixed(2).replace('.', ',')} €
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1">
            Nächste Stopps
          </div>
          {nextStops.map((stop) => (
            <div
              key={stop.stopNr}
              className="rounded-xl bg-white/8 border border-white/15 px-3 py-2.5 flex items-center gap-3"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-black text-white">
                {stop.stopNr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{stop.kundeName}</div>
                <div className="text-[10px] text-white/50 truncate">{stop.adresse}</div>
              </div>
              <div className="text-[11px] text-white/60 tabular-nums shrink-0">
                {Math.round(stop.etaSec / 60)} Min
              </div>
              <button
                onClick={() => openNavigation(stop.adresse)}
                className="rounded-lg bg-white/10 p-1.5 text-white/60 hover:bg-white/20 transition-colors"
              >
                <MapPin size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* All done */}
      {pendingStops.length === 0 && (
        <div className="rounded-2xl bg-matcha-500/20 border border-matcha-400/30 p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-matcha-400 mx-auto mb-2" />
          <div className="text-base font-black text-white">Tour abgeschlossen!</div>
          <div className="text-sm text-matcha-300">Alle {tour.stops.length} Stopps erledigt</div>
        </div>
      )}
    </div>
  );
}
