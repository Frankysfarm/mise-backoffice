'use client';

/**
 * Phase 1018 — Smart Tour Navigations-Hub (Fahrer)
 *
 * Konsolidierter Navigations-Hub für den Fahrer:
 * - Nächster Stopp prominent mit Countdown-Ring (SVG)
 * - 1-Tap Öffnen in Google Maps / Apple Maps / Waze
 * - Stopp-Liste kompakt mit Statusampel
 * - Bestellnummer + Kundenhinweis je Stopp
 * - Bestätigen-Button je Stopp
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Clock, CheckCircle2, Navigation2,
  ChevronDown, ChevronUp, Phone, Package,
  Loader2, AlertTriangle,
} from 'lucide-react';

interface Stop {
  id: string;
  stopp_nr: number;
  adresse: string;
  bestellnummer: string;
  kunde_name?: string | null;
  kunde_notiz?: string | null;
  kunde_telefon?: string | null;
  eta_min?: number | null;
  status: 'offen' | 'unterwegs' | 'erledigt';
}

interface Props {
  stops: Stop[];
  driverId: string;
  activeBatchId: string;
  onConfirmStop?: (stopId: string) => void;
}

function CountdownRing({ min, size = 72 }: { min: number | null; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const max = 40;
  const pct = min !== null ? Math.min(1, min / max) : 0;
  const dash = circ * (1 - pct);
  const color = min === null ? '#71717a' : min <= 10 ? '#22c55e' : min <= 25 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="900" fill={color}>
        {min !== null ? `${min}m` : '—'}
      </text>
    </svg>
  );
}

function openNav(adresse: string, app: 'google' | 'apple' | 'waze') {
  const q = encodeURIComponent(adresse);
  const urls: Record<typeof app, string> = {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple:  `maps://?daddr=${q}`,
    waze:   `https://waze.com/ul?q=${q}&navigate=yes`,
  };
  window.open(urls[app], '_blank');
}

export function FahrerPhase1018SmartTourNavigationsHub({ stops, driverId, activeBatchId, onConfirmStop }: Props) {
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [localStops, setLocalStops] = useState<Stop[]>(stops);

  useEffect(() => { setLocalStops(stops); }, [stops]);

  const [, tick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => tick(n => n + 1), 60_000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  const nextStop = localStops.find(s => s.status !== 'erledigt');
  const done = localStops.filter(s => s.status === 'erledigt').length;

  async function confirmStop(stop: Stop) {
    setConfirming(stop.id);
    try {
      await fetch(`/api/delivery/fahrer/confirm-stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stop_id: stop.id, driver_id: driverId, batch_id: activeBatchId }),
      });
      setLocalStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'erledigt' as const } : s));
      onConfirmStop?.(stop.id);
    } catch {}
    setConfirming(null);
  }

  if (localStops.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation2 className="h-4 w-4 text-matcha-600" />
          <span className="font-bold text-sm">Tour-Navigation</span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-200">
            {done}/{localStops.length} Stopps
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t space-y-0 divide-y">
          {/* Next stop hero */}
          {nextStop && (
            <div className="p-4 bg-gradient-to-br from-matcha-50 to-transparent dark:from-matcha-900/20">
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 mb-2">
                Nächster Stopp
              </div>
              <div className="flex items-start gap-3">
                <CountdownRing min={nextStop.eta_min ?? null} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm leading-snug">{nextStop.adresse}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">#{nextStop.bestellnummer}</div>
                  {nextStop.kunde_name && (
                    <div className="text-xs text-muted-foreground">{nextStop.kunde_name}</div>
                  )}
                  {nextStop.kunde_notiz && (
                    <div className="mt-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
                      ℹ️ {nextStop.kunde_notiz}
                    </div>
                  )}
                  {/* Navi buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(['google', 'apple', 'waze'] as const).map(app => (
                      <button
                        key={app}
                        onClick={() => openNav(nextStop.adresse, app)}
                        className="rounded-lg border px-2.5 py-1 text-[11px] font-bold hover:bg-muted transition capitalize"
                      >
                        {app === 'google' ? '📍 Google' : app === 'apple' ? '🍎 Maps' : '🗺 Waze'}
                      </button>
                    ))}
                    {nextStop.kunde_telefon && (
                      <a
                        href={`tel:${nextStop.kunde_telefon}`}
                        className="rounded-lg border px-2.5 py-1 text-[11px] font-bold hover:bg-muted transition flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" /> Anrufen
                      </a>
                    )}
                  </div>
                  {/* Confirm button */}
                  <button
                    onClick={() => confirmStop(nextStop)}
                    disabled={confirming === nextStop.id}
                    className="mt-2 w-full rounded-xl bg-matcha-600 text-white py-2 text-sm font-bold hover:bg-matcha-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
                  >
                    {confirming === nextStop.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CheckCircle2 className="h-4 w-4" />
                    }
                    Abgeliefert ✓
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Remaining stops list */}
          {localStops.filter(s => s.status !== 'erledigt' && s.id !== nextStop?.id).map(stop => (
            <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-6 w-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                {stop.stopp_nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{stop.adresse}</div>
                <div className="text-[10px] text-muted-foreground">#{stop.bestellnummer}</div>
              </div>
              {stop.eta_min !== null && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {stop.eta_min} Min
                </div>
              )}
            </div>
          ))}

          {/* Completed stops */}
          {localStops.filter(s => s.status === 'erledigt').map(stop => (
            <div key={stop.id} className="flex items-center gap-3 px-4 py-2 opacity-50">
              <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs line-through truncate">{stop.adresse}</div>
                <div className="text-[10px] text-muted-foreground">#{stop.bestellnummer}</div>
              </div>
              <span className="text-[9px] bg-matcha-100 dark:bg-matcha-900 text-matcha-600 dark:text-matcha-300 rounded-full px-1.5 py-0.5 font-bold">
                Erledigt
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
