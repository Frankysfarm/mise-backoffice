'use client';

/**
 * FahrerStickyBar — Fixierte Bottom-Navigation für die Fahrer-App.
 *
 * Bleibt beim Scrollen sichtbar und zeigt immer den nächsten offenen Stop:
 * - Adresse + ETA-Countdown (farbkodiert)
 * - Stop-Fortschritt (X/Y Pill)
 * - Ein-Klick Navigation (Google Maps / Apple Maps)
 *
 * Nur sichtbar wenn batchStatus === 'unterwegs' und noch offene Stops vorhanden.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronUp, Clock, MapPin, Navigation } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_telefon?: string | null;
  };
};

// ─── helpers ────────────────────────────────────────────────────────────────

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

/**
 * Returns seconds remaining until `iso` (negative = overdue).
 */
function secsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

/**
 * Format seconds into "M:SS" or "-M:SS" (overdue).
 */
function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${m}:${s.toString().padStart(2, '0')}`;
  return secs < 0 ? `-${str}` : str;
}

type CountdownColor = 'green' | 'amber' | 'orange' | 'red';

function countdownColor(secs: number): CountdownColor {
  if (secs > 300) return 'green';   // > 5 min
  if (secs > 120) return 'amber';   // 2–5 min
  if (secs > 0)   return 'orange';  // < 2 min
  return 'red';                      // overdue
}

const colorClasses: Record<CountdownColor, string> = {
  green:  'text-emerald-400',
  amber:  'text-amber-400',
  orange: 'text-orange-400',
  red:    'text-red-400',
};

/**
 * Open navigation to lat/lng. On iOS prefers Apple Maps, otherwise Google Maps.
 */
function openNavigation(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    window.open(
      `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      '_blank',
    );
  } else {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedLabel}&travelmode=driving`,
      '_blank',
    );
  }
}

// ─── component ──────────────────────────────────────────────────────────────

interface FahrerStickyBarProps {
  stops: Stop[];
  batchStatus: string;
}

export function FahrerStickyBar({ stops, batchStatus }: FahrerStickyBarProps) {
  useTick(1000);

  const [expanded, setExpanded] = useState(false);

  // Only render when actively driving and there are pending stops
  if (batchStatus !== 'unterwegs') return null;

  const pendingStops = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  if (pendingStops.length === 0) return null;

  const nextStop = pendingStops[0];
  const { order } = nextStop;
  const totalStops = stops.length;
  const doneStops = totalStops - pendingStops.length;

  // ETA: prefer earliest, fall back to latest
  const etaIso = order.eta_earliest ?? order.eta_latest ?? null;
  const secsLeft = secsUntil(etaIso);
  const color = secsLeft !== null ? countdownColor(secsLeft) : null;
  const isOverdue = secsLeft !== null && secsLeft < 0;

  const address = [order.kunde_adresse, order.kunde_plz]
    .filter(Boolean)
    .join(', ');

  const hasCoords = order.kunde_lat !== null && order.kunde_lng !== null;

  function handleNavigate() {
    if (!hasCoords) return;
    openNavigation(order.kunde_lat!, order.kunde_lng!, address);
  }

  return (
    <div
      className={cn(
        // Fixed positioning
        'fixed bottom-0 left-0 right-0 z-50',
        // Matcha dark theme
        'bg-matcha-900/95 backdrop-blur-md border-t border-accent/20',
        // Safe area padding for iOS
        'pb-4',
        // Smooth height transition when expanded
        'transition-all duration-200',
      )}
    >
      {/* ── Progress pill ── */}
      <div className="absolute top-2 right-3 flex items-center gap-1">
        <span className="text-[10px] font-semibold tracking-wide text-matcha-300/70 bg-matcha-800/60 rounded-full px-2 py-0.5">
          Stop {doneStops + 1}/{totalStops}
        </span>
      </div>

      {/* ── Main bar content ── */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-1 max-w-xl mx-auto">

        {/* Left: address + ETA */}
        <div className="flex-1 min-w-0">
          {/* Address row */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isOverdue ? (
              <AlertTriangle className="shrink-0 w-3.5 h-3.5 text-red-400" />
            ) : (
              <MapPin className="shrink-0 w-3.5 h-3.5 text-accent/70" />
            )}
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {address || order.kunde_name}
            </p>
          </div>

          {/* Name + ETA row */}
          <div className="flex items-center gap-2 mt-0.5 pl-5">
            <span className="text-xs text-matcha-300/60 truncate leading-tight">
              {order.kunde_name} · {euro(order.gesamtbetrag)}
            </span>

            {secsLeft !== null && color && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-mono font-bold shrink-0',
                  colorClasses[color],
                )}
              >
                <Clock className="w-3 h-3" />
                {fmtCountdown(secsLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Right: expand toggle + nav button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Expand / collapse for extra details (future-proof) */}
          <button
            aria-label={expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-full text-matcha-300/50 hover:text-matcha-200 hover:bg-matcha-800/60 transition-colors"
          >
            <ChevronUp
              className={cn(
                'w-4 h-4 transition-transform duration-200',
                expanded ? 'rotate-180' : '',
              )}
            />
          </button>

          {/* Navigation CTA */}
          <button
            aria-label="Navigation starten"
            onClick={handleNavigate}
            disabled={!hasCoords}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold',
              'bg-accent text-matcha-950 shadow-md',
              'transition-all duration-150 active:scale-95',
              !hasCoords && 'opacity-40 cursor-not-allowed',
            )}
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden xs:inline">Navi</span>
          </button>
        </div>
      </div>

      {/* ── Expanded details panel ── */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 max-w-xl mx-auto border-t border-matcha-700/40 mt-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {order.bestellnummer && (
              <p className="text-[11px] text-matcha-300/60">
                <span className="text-matcha-300/40">Bestellung </span>
                #{order.bestellnummer}
              </p>
            )}
            {etaIso && (
              <p className="text-[11px] text-matcha-300/60">
                <span className="text-matcha-300/40">ETA </span>
                {new Date(etaIso).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            {order.kunde_telefon && (
              <a
                href={`tel:${order.kunde_telefon}`}
                className="text-[11px] text-accent/80 hover:text-accent underline-offset-2 hover:underline col-span-2"
              >
                {order.kunde_telefon}
              </a>
            )}
            {pendingStops.length > 1 && (
              <p className="text-[11px] text-matcha-300/50 col-span-2 mt-0.5">
                Danach: {pendingStops[1].order.kunde_adresse ?? pendingStops[1].order.kunde_name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
