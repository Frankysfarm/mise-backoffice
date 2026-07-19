'use client';

/**
 * Phase 2600 — Smart Tour-Stopp Navigator Final (Fahrer-App)
 *
 * Zeigt den aktuellen Stopp mit Navigation-Button, Kunden-Info und
 * ETA-Anzeige. Listet alle Tour-Stopps mit Status-Dots. Countdown
 * zum nächsten Stopp. 1-Sek-Tick + 30-Sek-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Stop {
  id: string;
  reihenfolge: number | null;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
}

interface Props {
  batchId: string | null;
  stops: Stop[];
  onConfirm?: (stopId: string) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function sortedStops(stops: Stop[]) {
  return [...stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
}

function etaDisplay(etaMin: number | null): string {
  if (etaMin === null) return '—';
  if (etaMin <= 0) return 'Jetzt';
  return `${etaMin} Min`;
}

function openNav(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) {
    window.open(`https://maps.google.com/maps?daddr=${lat},${lng}`, '_blank');
  } else if (adresse) {
    window.open(`https://maps.google.com/maps?daddr=${encodeURIComponent(adresse)}`, '_blank');
  }
}

/* ── Stop Dot ─────────────────────────────────────────────────────────── */

function StopDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <div className={cn(
      'h-3 w-3 rounded-full shrink-0',
      done ? 'bg-matcha-500' : active ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-stone-200',
    )} />
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */

export function FahrerPhase2600SmartTourStoppNavigatorFinal({ batchId, stops, onConfirm }: Props) {
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const sorted = sortedStops(stops);
  const doneCount = sorted.filter(s => !!s.geliefert_am).length;
  const currentStop = sorted.find(s => !s.geliefert_am) ?? null;
  const totalStops = sorted.length;

  const handleConfirm = useCallback(async (stopId: string) => {
    if (!onConfirm) return;
    setConfirming(stopId);
    try {
      onConfirm(stopId);
    } finally {
      setConfirming(null);
    }
  }, [onConfirm]);

  if (totalStops === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden mb-3">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
            <Navigation className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Tour-Navigator</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Stopp {doneCount + (currentStop ? 1 : 0)}/{totalStops}
              {currentStop && ` · ETA ${etaDisplay(currentStop.eta_min)}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress dots */}
          <div className="flex items-center gap-0.5">
            {sorted.map((s, i) => (
              <StopDot
                key={s.id}
                done={!!s.geliefert_am}
                active={!s.geliefert_am && s.id === currentStop?.id}
              />
            ))}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-stone-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-stone-400 ml-1" />}
        </div>
      </button>

      {open && (
        <div className="bg-white dark:bg-stone-900">
          {/* Current stop card */}
          {currentStop && (
            <div className="mx-3 mb-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center">
                    {doneCount + 1}
                  </div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Aktueller Stopp</span>
                </div>
                {currentStop.eta_min !== null && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <Clock className="w-3 h-3" />
                    {etaDisplay(currentStop.eta_min)}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 leading-tight">{currentStop.adresse ?? '—'}</div>
                  {currentStop.kunde_name && (
                    <div className="text-xs text-stone-500 dark:text-stone-400">{currentStop.kunde_name}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold py-2 transition-colors"
                  onClick={() => openNav(currentStop.lat, currentStop.lng, currentStop.adresse)}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Navigation
                </button>
                {currentStop.kunde_telefon && (
                  <a
                    href={`tel:${currentStop.kunde_telefon}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold px-3 py-2 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                {onConfirm && (
                  <button
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-matcha-500 hover:bg-matcha-600 active:bg-matcha-700 text-white text-xs font-bold px-3 py-2 transition-colors disabled:opacity-50"
                    onClick={() => handleConfirm(currentStop.id)}
                    disabled={confirming === currentStop.id}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Bestätigen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* All stops list */}
          <div className="px-3 pb-3 space-y-1.5">
            {sorted.map((s, i) => {
              const isDone = !!s.geliefert_am;
              const isCurrent = !isDone && s.id === currentStop?.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2',
                    isDone ? 'bg-stone-50 dark:bg-stone-900/30' :
                    isCurrent ? 'bg-amber-50 dark:bg-amber-950/20' :
                    'bg-white dark:bg-stone-900',
                  )}
                >
                  <div className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                    isDone ? 'bg-matcha-500 text-white' :
                    isCurrent ? 'bg-amber-400 text-white' :
                    'bg-stone-200 dark:bg-stone-700 text-stone-500',
                  )}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-semibold truncate', isDone ? 'line-through text-stone-400' : 'text-stone-700 dark:text-stone-200')}>
                      {s.adresse ?? '—'}
                    </div>
                    {s.kunde_name && (
                      <div className="text-[10px] text-stone-400 dark:text-stone-500 truncate">{s.kunde_name}</div>
                    )}
                  </div>
                  {isDone && s.geliefert_am && (
                    <span className="text-[10px] text-matcha-600 font-semibold shrink-0">
                      {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {!isDone && s.eta_min !== null && (
                    <span className={cn('text-[10px] font-semibold shrink-0', isCurrent ? 'text-amber-600' : 'text-stone-400')}>
                      {etaDisplay(s.eta_min)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
