'use client';

/**
 * Smart Tour-Stop-Hub V2
 * Übersicht aller aktiven Tour-Stopps mit Navigation, ETA-Countdown
 * und direktem Stop-Bestätigungs-CTA – kompakt und mobile-first.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Navigation2, Phone, CheckCircle2, Clock,
  Package, Banknote, CreditCard, ChevronRight, Timer,
} from 'lucide-react';

export type TourStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string;
    kunde_plz: string;
    kunde_telefon: string | null;
    gesamtbetrag: number;
    bezahlt: boolean;
    zahlungsart: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    kunde_notiz: string | null;
  } | null;
};

function secsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function fmtMmSs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function etaColor(secs: number | null): 'green' | 'yellow' | 'red' {
  if (secs === null) return 'yellow';
  if (secs > 600) return 'green';
  if (secs > 120) return 'yellow';
  return 'red';
}

const ETA_CLASSES = {
  green: 'text-green-400 bg-green-500/10 border-green-500/30',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  red: 'text-red-400 bg-red-500/10 border-red-500/30 animate-pulse',
};

interface Props {
  stops: TourStop[];
  onConfirmStop?: (stopId: string) => Promise<void>;
  naviApp?: 'google' | 'waze' | 'apple';
}

export function SmartTourStopHubV2({ stops, onConfirmStop, naviApp = 'google' }: Props) {
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const pending = stops
    .filter((s) => !s.geliefert_am && s.order)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  const done = stops.filter((s) => !!s.geliefert_am);

  const handleConfirm = useCallback(async (stopId: string) => {
    if (!onConfirmStop) return;
    setConfirming(stopId);
    try {
      await onConfirmStop(stopId);
    } finally {
      setConfirming(null);
    }
  }, [onConfirmStop]);

  function naviUrl(adresse: string, plz: string): string {
    const addr = encodeURIComponent(`${adresse}, ${plz}`);
    if (naviApp === 'waze') return `https://waze.com/ul?q=${addr}&navigate=yes`;
    if (naviApp === 'apple') return `maps://maps.apple.com/?daddr=${addr}`;
    return `https://maps.google.com/?q=${addr}`;
  }

  if (pending.length === 0 && done.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
        Keine Stopps – Warte auf neue Tour
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-white/50 mb-1">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          {done.length}/{stops.length} Stopps
        </span>
        <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${stops.length > 0 ? (done.length / stops.length) * 100 : 0}%` }}
          />
        </div>
        <span>{Math.round(done.length / Math.max(stops.length, 1) * 100)}%</span>
      </div>

      {/* Pending stops */}
      {pending.map((stop, idx) => {
        const o = stop.order!;
        const secs = secsUntil(o.eta_earliest);
        const color = etaColor(secs);
        const isNext = idx === 0;

        return (
          <div
            key={stop.id}
            className={cn(
              'rounded-xl border p-3 space-y-2 transition-all',
              isNext
                ? 'border-white/20 bg-white/8 shadow-lg'
                : 'border-white/10 bg-white/5 opacity-80',
            )}
          >
            {/* Stop header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0',
                  isNext ? 'bg-white text-black' : 'bg-white/20 text-white',
                )}>
                  {stop.reihenfolge}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{o.kunde_name}</p>
                  <p className="text-xs text-white/50 truncate">{o.kunde_adresse}</p>
                </div>
              </div>

              {/* ETA countdown */}
              {secs !== null && (
                <div className={cn('shrink-0 rounded-lg border px-2 py-1 text-center', ETA_CLASSES[color])}>
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    <span className="text-sm font-mono font-bold tabular-nums">{fmtMmSs(secs)}</span>
                  </div>
                  <div className="text-[10px] opacity-70">bis ETA</div>
                </div>
              )}
            </div>

            {/* Payment + notes */}
            <div className="flex items-center gap-3 text-xs text-white/60">
              {o.bezahlt ? (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Bezahlt
                </span>
              ) : (
                <span className="flex items-center gap-1 text-orange-400">
                  {o.zahlungsart === 'karte' ? (
                    <CreditCard className="h-3 w-3" />
                  ) : (
                    <Banknote className="h-3 w-3" />
                  )}
                  {euro(o.gesamtbetrag)} kassieren
                </span>
              )}
              <span className="font-mono">{euro(o.gesamtbetrag)}</span>
              {o.kunde_notiz && (
                <span className="truncate text-yellow-400/70 italic max-w-[120px]">
                  "{o.kunde_notiz}"
                </span>
              )}
            </div>

            {/* Action row */}
            <div className="flex gap-2">
              {/* Navigate */}
              <a
                href={naviUrl(o.kunde_adresse, o.kunde_plz)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/30 transition-colors"
              >
                <Navigation2 className="h-3.5 w-3.5" />
                Navigation
              </a>

              {/* Call customer */}
              {o.kunde_telefon && (
                <a
                  href={`tel:${o.kunde_telefon}`}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/20 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Anrufen
                </a>
              )}

              {/* Confirm delivery */}
              {onConfirmStop && isNext && (
                <button
                  onClick={() => handleConfirm(stop.id)}
                  disabled={confirming === stop.id}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-500/20 border border-green-500/40 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {confirming === stop.id ? 'Wird bestätigt…' : 'Geliefert ✓'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Done stops summary */}
      {done.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500/50" />
            <span>{done.length} abgeschlossen</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-white/20" />
        </div>
      )}
    </div>
  );
}
