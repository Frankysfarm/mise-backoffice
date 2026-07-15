'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, CheckCircle2, Navigation, Clock, Package,
  ChevronDown, ChevronUp, ArrowRight, Bike,
} from 'lucide-react';

/**
 * Phase 1740 — Smart-Tour-Navigation-Command (Fahrer-App)
 *
 * Kompakter, fokussierter Tour-Navigator:
 * - Aktueller Stopp prominent mit Navigation-CTA (Google Maps / Waze)
 * - Telefonanruf mit einem Tap
 * - Nächste Stopps als kompakte Liste
 * - ETA-Fortschritt je Stopp
 * - Echtzeit-Sync aus dem übergebenen batch.stops-Array
 */

interface Stop {
  id: string;
  type?: 'pickup' | 'delivery' | 'return';
  sequence?: number;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  geliefert_am?: string | null;
  order?: {
    bestellnummer?: string | null;
    eta_latest?: string | null;
    kunde_name?: string | null;
    kunde_telefon?: string | null;
  } | null;
}

function etaLabel(etaLatest: string | null | undefined): string {
  if (!etaLatest) return '—';
  const diff = Math.round((new Date(etaLatest).getTime() - Date.now()) / 60_000);
  if (diff < -2) return `${Math.abs(diff)} Min überfällig`;
  if (diff <= 0) return 'jetzt';
  return `~${diff} Min`;
}

function etaColor(etaLatest: string | null | undefined): string {
  if (!etaLatest) return 'text-stone-400';
  const diff = Math.round((new Date(etaLatest).getTime() - Date.now()) / 60_000);
  if (diff < 0) return 'text-red-600 font-bold';
  if (diff < 10) return 'text-amber-600 font-bold';
  return 'text-matcha-700';
}

function navUrl(lat: number | null | undefined, lng: number | null | undefined, address: string | null | undefined): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  return 'https://maps.google.com';
}

export function FahrerPhase1740SmartTourNavCommand({
  stops,
  currentBatchId,
}: {
  stops: Stop[];
  currentBatchId?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [stops],
  );

  const pending = sorted.filter(s => !s.geliefert_am && s.type !== 'pickup');
  const done = sorted.filter(s => !!s.geliefert_am && s.type !== 'pickup');
  const current = pending[0] ?? null;
  const nextStops = pending.slice(1);

  const progress = sorted.length > 0
    ? Math.round((done.length / sorted.filter(s => s.type !== 'pickup').length) * 100)
    : 0;

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Progress header */}
      <div className="px-4 py-2.5 border-b bg-stone-50">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Bike className="w-4 h-4 text-saffron" />
            <span className="text-xs font-bold uppercase tracking-wider text-char">Tour-Navigation</span>
          </div>
          <span className="text-xs text-muted-foreground font-bold">
            {done.length}/{pending.length + done.length} Stopps
          </span>
        </div>
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full bg-saffron rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Aktueller Stopp */}
      {current ? (
        <div className="px-4 pt-4 pb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-saffron" />
            Jetzt anfahren
          </div>

          {/* Stopp-Karte */}
          <div className="rounded-xl border border-saffron/30 bg-saffron/5 p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-saffron flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-char truncate">
                  {current.address ?? `Stopp ${current.sequence}`}
                </div>
                {current.order?.kunde_name && (
                  <div className="text-xs text-muted-foreground">{current.order.kunde_name}</div>
                )}
                {current.order?.bestellnummer && (
                  <div className="text-[10px] font-bold text-muted-foreground">#{current.order.bestellnummer}</div>
                )}
              </div>
              {/* ETA */}
              <div className="shrink-0 text-right">
                <div className={cn('text-sm font-black tabular-nums', etaColor(current.order?.eta_latest))}>
                  {etaLabel(current.order?.eta_latest)}
                </div>
                <div className="text-[9px] text-muted-foreground">ETA</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-2 mt-3">
              <a
                href={navUrl(current.lat, current.lng, current.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-saffron text-white font-bold text-sm rounded-xl py-2.5 hover:bg-saffron/90 active:scale-95 transition-transform"
              >
                <Navigation className="w-4 h-4" />
                Navigation
              </a>
              {current.order?.kunde_telefon && (
                <a
                  href={`tel:${current.order.kunde_telefon}`}
                  className="flex items-center justify-center gap-2 border border-stone-200 bg-white text-char font-bold text-sm rounded-xl px-4 py-2.5 hover:bg-stone-50 active:scale-95 transition-transform"
                >
                  <Phone className="w-4 h-4" />
                  Anrufen
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-matcha-500" />
          <div>
            <div className="font-bold text-sm text-matcha-700">Alle Stopps erledigt!</div>
            <div className="text-xs text-muted-foreground">Tour abgeschlossen</div>
          </div>
        </div>
      )}

      {/* Nächste Stopps */}
      {nextStops.length > 0 && (
        <div className="border-t">
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition"
            onClick={() => setShowAll(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">
                Nächste {nextStops.length} {nextStops.length === 1 ? 'Stopp' : 'Stopps'}
              </span>
            </div>
            {showAll
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </button>
          {showAll && (
            <div className="divide-y">
              {nextStops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-stone-600">{idx + 2}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-char truncate">
                      {stop.address ?? `Stopp ${stop.sequence}`}
                    </div>
                    {stop.order?.kunde_name && (
                      <div className="text-[10px] text-muted-foreground">{stop.order.kunde_name}</div>
                    )}
                  </div>
                  <div className={cn('text-[11px] font-bold shrink-0', etaColor(stop.order?.eta_latest))}>
                    {etaLabel(stop.order?.eta_latest)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Abgeschlossene Stopps (kompakt) */}
      {done.length > 0 && (
        <div className="border-t px-4 py-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="w-3 h-3 text-matcha-500" />
          <span>{done.length} {done.length === 1 ? 'Stopp' : 'Stopps'} abgeschlossen</span>
        </div>
      )}
    </div>
  );
}
