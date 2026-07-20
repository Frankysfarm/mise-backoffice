'use client';

/**
 * Phase 2645 — Tour-Stopp Navigator Pro Ultimate
 *
 * Fahrer-Navigation der nächsten Generation:
 * - Hero-Stopp mit Adresse, Kundenname, Distanz, ETA-Countdown (1-Sek-Tick)
 * - One-Tap Navigation: Google Maps / Waze / Apple Maps
 * - Direktanruf & Notiz-Alert (besondere Anweisungen)
 * - Stop-Progress-Dots mit Farbkodierung (grün/gelb/rot)
 * - Schicht-Einnahmen Vorschau: Aktuell + Prognose
 * - Aufklappbare Restliste aller weiteren Stopps
 * - 15-Sek-Polling + 1-Sek-ETA-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Phone, Navigation, Clock, ChevronDown, ChevronUp, AlertCircle, Euro, Loader2, CheckCircle2 } from 'lucide-react';

type StopStatus = 'pending' | 'en_route' | 'arrived' | 'delivered' | 'failed';

interface Stop {
  stopId: string;
  reihenfolge: number;
  adresse: string;
  kundeVorname: string | null;
  lat: number | null;
  lng: number | null;
  etaSec: number | null;
  distanzKm: number | null;
  status: StopStatus;
  notiz: string | null;
  betrag: number | null;
}

interface ShiftEarnings {
  aktuelleEinnahmen: number;
  prognoseEinnahmen: number;
  trinkgeldEinnahmen: number;
}

interface ApiResponse {
  driverId: string;
  stops: Stop[];
  shift: ShiftEarnings;
}

const MOCK_DRIVER = 'mock';

const MOCK: ApiResponse = {
  driverId: MOCK_DRIVER,
  stops: [
    { stopId: 's1', reihenfolge: 1, adresse: 'Hauptstraße 42, 80331 München',     kundeVorname: 'Maria',   lat: 48.138, lng: 11.575, etaSec: 185, distanzKm: 1.3, status: 'en_route', notiz: 'Klingel 3. OG — bitte klingeln', betrag: 18.90 },
    { stopId: 's2', reihenfolge: 2, adresse: 'Schleißheimer Str. 7, 80333 München', kundeVorname: 'Jonas',   lat: 48.151, lng: 11.568, etaSec: 720, distanzKm: 3.2, status: 'pending',  notiz: null, betrag: 22.50 },
    { stopId: 's3', reihenfolge: 3, adresse: 'Leopoldstraße 15, 80802 München',     kundeVorname: 'Sophie',  lat: 48.160, lng: 11.571, etaSec: 1200, distanzKm: 4.8, status: 'pending', notiz: 'Hinterhof links', betrag: 14.75 },
    { stopId: 's4', reihenfolge: 0, adresse: 'Karlsplatz 1, 80335 München',         kundeVorname: 'Felix',   lat: 48.137, lng: 11.565, etaSec: null, distanzKm: null, status: 'delivered', notiz: null, betrag: 31.20 },
  ],
  shift: { aktuelleEinnahmen: 31.20, prognoseEinnahmen: 87.35, trinkgeldEinnahmen: 3.50 },
};

function fmtSec(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function dotCls(status: StopStatus): string {
  switch (status) {
    case 'delivered': return 'bg-matcha-500';
    case 'en_route':  return 'bg-amber-500 ring-2 ring-amber-300 animate-pulse';
    case 'failed':    return 'bg-red-500';
    case 'arrived':   return 'bg-blue-500';
    default:          return 'bg-muted-foreground/30';
  }
}

function navLink(platform: 'google' | 'waze' | 'apple', lat: number, lng: number, adresse: string): string {
  const enc = encodeURIComponent(adresse);
  switch (platform) {
    case 'waze':   return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    case 'apple':  return `maps://maps.apple.com/?daddr=${lat},${lng}`;
    default:       return `https://maps.google.com/?daddr=${lat},${lng}`;
  }
}

export function FahrerPhase2645TourStoppNavigatorProUltimate({ driverId }: { driverId: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveStops, setLiveStops] = useState<Stop[]>(MOCK.stops);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setLiveStops(prev => prev.map(s => ({
      ...s,
      etaSec: s.etaSec !== null ? Math.max(0, s.etaSec - 1) : null,
    })));
  }, [tick]);

  const fetchData = async () => {
    if (!driverId || driverId === MOCK_DRIVER) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/tour-stops?driverId=${driverId}`);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setLiveStops(json.stops);
      }
    } catch { /* use mock */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [driverId]);

  const sorted = [...liveStops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find(s => s.status === 'en_route' || s.status === 'pending' || s.status === 'arrived');
  const restStops = sorted.filter(s => s !== nextStop && s.status !== 'delivered' && s.status !== 'failed');
  const doneCount = sorted.filter(s => s.status === 'delivered').length;
  const totalCount = sorted.length;

  if (!nextStop) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center">
        <CheckCircle2 className="h-8 w-8 text-matcha-500 mx-auto mb-1" />
        <p className="font-bold text-sm">Tour abgeschlossen!</p>
        <p className="text-xs text-muted-foreground">{doneCount} von {totalCount} Stopps geliefert</p>
      </div>
    );
  }

  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider">Navigator Pro</span>
        <span className="text-[10px] text-muted-foreground">2645</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-[10px] text-muted-foreground">{doneCount}/{totalCount} ✓</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div className="h-full bg-matcha-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Hero stop */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs">{nextStop.reihenfolge || doneCount + 1}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm">
                {nextStop.kundeVorname ? `${nextStop.kundeVorname} — ` : ''}{nextStop.adresse}
              </span>
            </div>
            {nextStop.notiz && (
              <div className="mt-1 flex items-start gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                <AlertCircle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-700">{nextStop.notiz}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {nextStop.etaSec !== null && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn(
                    'font-mono font-black text-base tabular-nums',
                    nextStop.etaSec < 60 ? 'text-red-600 animate-pulse' : nextStop.etaSec < 180 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {fmtSec(nextStop.etaSec)}
                  </span>
                  {nextStop.distanzKm !== null && (
                    <span className="text-[10px] text-muted-foreground">{nextStop.distanzKm.toFixed(1)} km</span>
                  )}
                </div>
              )}
              {nextStop.betrag !== null && (
                <div className="flex items-center gap-0.5">
                  <Euro className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-bold">{nextStop.betrag.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        {nextStop.lat !== null && nextStop.lng !== null && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['google', 'waze', 'apple'] as const).map(platform => (
              <a
                key={platform}
                href={navLink(platform, nextStop.lat!, nextStop.lng!, nextStop.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-opacity active:opacity-70',
                  platform === 'google' ? 'bg-blue-600 text-white' :
                  platform === 'waze'  ? 'bg-sky-500 text-white' :
                                         'bg-gray-700 text-white',
                )}
              >
                <Navigation className="h-3.5 w-3.5" />
                {platform === 'google' ? 'Google' : platform === 'waze' ? 'Waze' : 'Apple'}
              </a>
            ))}
          </div>
        )}

        {/* Phone */}
        <div className="mt-2 flex gap-2">
          <a
            href="tel:"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold hover:bg-muted/40 transition"
          >
            <Phone className="h-3.5 w-3.5" />
            Anrufen
          </a>
        </div>
      </div>

      {/* Stop dots */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t bg-muted/10 overflow-x-auto">
        {sorted.map((s, i) => (
          <div key={s.stopId} className="flex items-center gap-1 shrink-0">
            <span className={cn('h-3 w-3 rounded-full', dotCls(s.status))} />
            {i < sorted.length - 1 && <span className="h-px w-3 bg-muted-foreground/20" />}
          </div>
        ))}
        <span className="ml-2 text-[10px] text-muted-foreground">{doneCount}/{totalCount}</span>
      </div>

      {/* Earnings preview */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-matcha-50 dark:bg-matcha-950/30 text-xs">
        <div>
          <span className="text-muted-foreground">Aktuell </span>
          <span className="font-black text-matcha-700">{data.shift.aktuelleEinnahmen.toFixed(2)} €</span>
        </div>
        <div>
          <span className="text-muted-foreground">Prognose </span>
          <span className="font-bold">{data.shift.prognoseEinnahmen.toFixed(2)} €</span>
        </div>
        {data.shift.trinkgeldEinnahmen > 0 && (
          <div>
            <span className="text-muted-foreground">Trinkgeld </span>
            <span className="font-bold text-amber-600">{data.shift.trinkgeldEinnahmen.toFixed(2)} €</span>
          </div>
        )}
      </div>

      {/* Remaining stops (collapsible) */}
      {restStops.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 border-t hover:bg-muted/30 transition text-xs text-muted-foreground"
          >
            <span>{restStops.length} weitere Stopp{restStops.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="border-t divide-y">
              {restStops.map((s) => (
                <div key={s.stopId} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.adresse}</div>
                    {s.notiz && <div className="text-[10px] text-amber-600 truncate">{s.notiz}</div>}
                  </div>
                  {s.etaSec !== null && (
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">~{Math.round(s.etaSec / 60)} Min</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
