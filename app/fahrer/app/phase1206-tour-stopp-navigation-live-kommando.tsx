'use client';

// Phase 1206 — Tour-Stopp-Navigation-Live-Kommando (Fahrer-App)
// Echtzeit-Navigations-Kommandozentrale: Nächster Stopp + Countdown + Karten-Link + Stop-Checkliste

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, CheckCircle2, AlertTriangle, ChevronRight, Phone, Package } from 'lucide-react';

interface Stop {
  id: string;
  adresse?: string | null;
  name?: string | null;
  kunden_name?: string | null;
  telefon?: string | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  sequence?: number | null;
  bestellnummer?: string | null;
  lat?: number | null;
  lng?: number | null;
  [k: string]: unknown;
}

interface Props {
  stops: Stop[];
  tourStartedAt?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return '✓';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FahrerPhase1206TourStoppNavigationLiveKommando({
  stops,
  tourStartedAt,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!stops || stops.length === 0) return null;

  const sortedStops = [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const completedStops = sortedStops.filter(s => s.geliefert_am);
  const remainingStops = sortedStops.filter(s => !s.geliefert_am);
  const nextStop = remainingStops[0] ?? null;

  const totalStops = sortedStops.length;
  const progressPct = totalStops > 0 ? Math.round((completedStops.length / totalStops) * 100) : 0;

  const now = Date.now();
  let elapsedSec = 0;
  if (tourStartedAt) {
    elapsedSec = Math.floor((now - new Date(tourStartedAt).getTime()) / 1000);
  }

  // Berechne ETA zum nächsten Stopp
  let etaSec: number | null = null;
  if (nextStop?.eta_min != null) {
    etaSec = Math.round(nextStop.eta_min * 60 - elapsedSec);
  }

  function buildNavUrl(stop: Stop): string {
    if (stop.lat && stop.lng) {
      return `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
    }
    const addr = stop.adresse ?? '';
    return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
  }

  if (!nextStop) {
    return (
      <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-matcha-600" />
          <div>
            <div className="font-bold text-matcha-800 text-lg">Tour abgeschlossen!</div>
            <div className="text-sm text-matcha-600">Alle {totalStops} Stopps erledigt</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Fortschritts-Header */}
      <div className="rounded-xl border bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tour-Fortschritt</span>
          <span className="text-xs font-bold tabular-nums">
            {completedStops.length}/{totalStops} Stopps
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground text-right">{progressPct}% fertig</div>
      </div>

      {/* Nächster Stopp — Kommando-Karte */}
      <div className="rounded-2xl border-2 border-matcha-400 bg-gradient-to-br from-matcha-50 to-white p-4 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-600 text-white text-xs font-black">
              {completedStops.length + 1}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">Nächster Stopp</span>
          </div>
          {etaSec !== null && (
            <div className={cn(
              'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black',
              etaSec <= 0 ? 'bg-matcha-500 text-white' :
              etaSec <= 120 ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            )}>
              <Clock className="h-3 w-3" />
              {etaSec <= 0 ? 'Angekommen' : `~${Math.ceil(etaSec / 60)} Min`}
            </div>
          )}
        </div>

        {/* Kundeninfo */}
        <div className="mb-3">
          <div className="font-bold text-base text-foreground">
            {nextStop.kunden_name ?? nextStop.name ?? 'Kunde'}
          </div>
          {nextStop.bestellnummer && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              #{nextStop.bestellnummer}
            </div>
          )}
          {nextStop.adresse && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-foreground">
              <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
              <span className="font-medium">{nextStop.adresse}</span>
            </div>
          )}
        </div>

        {/* Aktions-Buttons */}
        <div className="flex gap-2">
          <a
            href={buildNavUrl(nextStop)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-matcha-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-matcha-700 active:scale-95 transition-all"
          >
            <Navigation className="h-4 w-4" />
            Navigation starten
          </a>
          {nextStop.telefon && (
            <a
              href={`tel:${nextStop.telefon}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-matcha-300 bg-white px-3 py-2.5 text-sm font-bold text-matcha-700 hover:bg-matcha-50 active:scale-95 transition-all"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Nächste Stopps Preview */}
      {remainingStops.length > 1 && (
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Weitere Stopps ({remainingStops.length - 1})
          </div>
          <div className="space-y-2">
            {remainingStops.slice(1, 4).map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-2 py-1">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-black text-muted-foreground">
                  {completedStops.length + 2 + i}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{stop.kunden_name ?? stop.name ?? 'Kunde'}</div>
                  {stop.adresse && (
                    <div className="text-[10px] text-muted-foreground truncate">{stop.adresse}</div>
                  )}
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </div>
            ))}
            {remainingStops.length > 4 && (
              <div className="text-[10px] text-muted-foreground text-center">
                +{remainingStops.length - 4} weitere
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
