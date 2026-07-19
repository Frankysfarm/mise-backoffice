'use client';

/**
 * Phase 2625 — Tour-Navigation Kompakt Final
 *
 * Kompakter Tour-Navigator für Fahrer:
 * - Nächster Stopp im Hero-Fokus mit One-Tap-Navigation
 * - Google Maps / Waze / Apple Maps Deep-Links
 * - Anruf-Button, Notiz-Alert
 * - Fortschrittsleiste + Stop-Dots
 * - Alle weiteren Stops aufklappbar
 * - 20-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, Phone, ChevronDown, ChevronUp,
  CheckCircle2, Clock, MapPin, AlertCircle, Loader2,
} from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min: number | null;
  notiz: string | null;
}

function stopColor(s: TourStop['status']): string {
  if (s === 'abgeliefert') return 'bg-matcha-500 text-white border-matcha-600';
  if (s === 'angekommen' || s === 'unterwegs') return 'bg-amber-400 text-white border-amber-500';
  return 'bg-white text-muted-foreground border-border';
}

function googleMapsUrl(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}
function wazeUrl(adresse: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`;
}
function appleMapsUrl(adresse: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase2625TourNavigationKompaktFinal({ driverId }: { driverId: string | null }) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStops() {
    if (!driverId) return;
    setLoading(prev => stops.length === 0 ? true : prev);
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (r.ok) setStops(await r.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchStops();
    pollRef.current = setInterval(fetchStops, 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (!driverId) return null;

  const nextStop = stops.find(s => s.status !== 'abgeliefert');
  const done = stops.filter(s => s.status === 'abgeliefert').length;
  const pct = stops.length > 0 ? (done / stops.length) * 100 : 0;
  const remaining = stops.filter(s => s.status !== 'abgeliefert');

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-matcha-50">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="font-display font-bold text-sm text-matcha-700 uppercase tracking-wider">
            Tour-Navigation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {done}/{stops.length} Stopps
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {stops.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex gap-1">
            {stops.map(s => (
              <span
                key={s.id}
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-black',
                  stopColor(s.status)
                )}
              >
                {s.status === 'abgeliefert' ? '✓' : s.reihenfolge}
              </span>
            ))}
          </div>
        </div>
      )}

      {nextStop ? (
        <div className="px-4 py-4 space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">
                  Nächster Stopp #{nextStop.reihenfolge}
                  {nextStop.bestellnummer && ` · #${nextStop.bestellnummer}`}
                </div>
                <div className="font-display font-bold text-sm leading-snug">{nextStop.adresse}</div>
                {nextStop.kunde_name && (
                  <div className="text-xs text-muted-foreground mt-0.5">{nextStop.kunde_name}</div>
                )}
                {nextStop.eta_min !== null && nextStop.eta_min > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                    <Clock className="h-3 w-3" />
                    ~{nextStop.eta_min} Min
                  </div>
                )}
              </div>
            </div>

            {nextStop.notiz && (
              <div className="flex items-start gap-1.5 rounded-lg bg-amber-100 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
                <span className="text-xs text-amber-800 font-medium">{nextStop.notiz}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <a
                href={googleMapsUrl(nextStop.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-xl bg-matcha-600 px-2 py-2.5 text-[11px] font-bold text-white active:opacity-80"
              >
                <Navigation className="h-3.5 w-3.5" />
                Google
              </a>
              <a
                href={wazeUrl(nextStop.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 py-2.5 text-[11px] font-bold text-white active:opacity-80"
              >
                <Navigation className="h-3.5 w-3.5" />
                Waze
              </a>
              {nextStop.telefon ? (
                <a
                  href={`tel:${nextStop.telefon}`}
                  className="flex items-center justify-center gap-1 rounded-xl bg-matcha-100 border border-matcha-300 px-2 py-2.5 text-[11px] font-bold text-matcha-700 active:opacity-80"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Anruf
                </a>
              ) : (
                <a
                  href={appleMapsUrl(nextStop.adresse)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl bg-gray-600 px-2 py-2.5 text-[11px] font-bold text-white active:opacity-80"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Apple
                </a>
              )}
            </div>
          </div>

          {remaining.length > 1 && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold text-muted-foreground hover:bg-muted/50 transition"
              >
                <span>{remaining.length - 1} weitere Stopp{remaining.length - 1 !== 1 ? 's' : ''}</span>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {expanded && (
                <div className="mt-1 space-y-1">
                  {remaining.slice(1).map(s => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-muted/20">
                      <span className={cn(
                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-black',
                        stopColor(s.status)
                      )}>
                        {s.reihenfolge}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{s.adresse}</div>
                        {s.kunde_name && (
                          <div className="text-[10px] text-muted-foreground">{s.kunde_name}</div>
                        )}
                      </div>
                      {s.eta_min !== null && s.eta_min > 0 && (
                        <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                          ~{s.eta_min}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : stops.length > 0 ? (
        <div className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-matcha-700 font-bold">
          <CheckCircle2 className="h-5 w-5 text-matcha-500" />
          Tour abgeschlossen!
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Tour-Daten…
        </div>
      ) : (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Keine aktive Tour
        </div>
      )}
    </div>
  );
}
