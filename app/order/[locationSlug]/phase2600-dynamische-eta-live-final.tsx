'use client';

/**
 * Phase 2600 — Dynamische ETA Live Final (Storefront)
 *
 * Zeigt dem Kunden die Live-ETA mit Farbkodierung, Fahrer-Status
 * und Fortschrittsbalken. Sekunden-Countdown + 30-Sek-API-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

interface EtaData {
  estimatedMinutes: number | null;
  confidence: 'high' | 'medium' | 'low';
  phase: 'placed' | 'preparing' | 'ready' | 'delivering' | 'delivered';
  driverName: string | null;
  driverLat: number | null;
  driverLng: number | null;
  updatedAt: string;
}

interface Props {
  bestellnummer: string;
  locationSlug?: string;
}

/* ── Phase Config ─────────────────────────────────────────────────────── */

const PHASES: { key: EtaData['phase']; label: string; icon: React.ReactNode }[] = [
  { key: 'placed',    label: 'Bestellt',     icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'preparing', label: 'In Zubereitung', icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'ready',    label: 'Fertig',        icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'delivering', label: 'Unterwegs',   icon: <Bike className="w-3.5 h-3.5" /> },
  { key: 'delivered', label: 'Geliefert',    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

const CONFIDENCE_COLOR = {
  high:   'text-matcha-700 dark:text-matcha-300',
  medium: 'text-amber-700  dark:text-amber-300',
  low:    'text-red-700    dark:text-red-300',
};

/* ── Progress Bar ─────────────────────────────────────────────────────── */

function PhaseBar({ currentPhase }: { currentPhase: EtaData['phase'] }) {
  const idx = PHASES.findIndex(p => p.key === currentPhase);
  return (
    <div className="flex items-center gap-0 w-full">
      {PHASES.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={p.key} className="flex items-center flex-1">
            <div className={cn(
              'relative flex items-center justify-center rounded-full border-2 shrink-0',
              'h-7 w-7 text-[10px]',
              done ? 'bg-matcha-500 border-matcha-500 text-white' :
              active ? 'bg-amber-400 border-amber-400 text-white ring-2 ring-amber-200' :
              'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-400',
            )}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : p.icon}
            </div>
            {i < PHASES.length - 1 && (
              <div className="flex-1 h-0.5 mx-0.5">
                <div className={cn(
                  'h-full rounded-full transition-all duration-700',
                  done ? 'bg-matcha-500' : 'bg-stone-200 dark:bg-stone-700',
                )} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Mock data for when no real API is available ─────────────────────── */

function mockEta(bestellnummer: string): EtaData {
  return {
    estimatedMinutes: 28,
    confidence: 'high',
    phase: 'delivering',
    driverName: null,
    driverLat: null,
    driverLng: null,
    updatedAt: new Date().toISOString(),
  };
}

/* ── Main ───────────────────────────────────────────────────────────── */

export function StorefrontPhase2600DynamischeEtaLiveFinal({ bestellnummer, locationSlug }: Props) {
  const [eta, setEta] = useState<EtaData | null>(null);
  const [tick, setTick] = useState(0);
  const [minsLeft, setMinsLeft] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    fetch(`/api/delivery/eta/${encodeURIComponent(bestellnummer)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setEta(d);
          setMinsLeft(d.estimatedMinutes);
          setFetchedAt(new Date());
        } else {
          // Use mock when no API
          const mock = mockEta(bestellnummer);
          setEta(mock);
          setMinsLeft(mock.estimatedMinutes);
          setFetchedAt(new Date());
        }
      })
      .catch(() => {
        const mock = mockEta(bestellnummer);
        setEta(mock);
        setMinsLeft(mock.estimatedMinutes);
        setFetchedAt(new Date());
      });
  }, [bestellnummer]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Countdown tick
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  // Decrement minutes locally (tick triggers re-render to recalculate)
  const displayMin = (() => {
    if (minsLeft === null || !fetchedAt) return null;
    const elapsed = Math.floor((Date.now() - fetchedAt.getTime()) / 60_000);
    return Math.max(0, minsLeft - elapsed);
  })();

  if (!eta) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 mb-3 animate-pulse">
        <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-2/3 mb-2" />
        <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-1/3" />
      </div>
    );
  }

  const isDelivered = eta.phase === 'delivered';

  return (
    <div className={cn(
      'rounded-2xl border shadow-sm mb-3 overflow-hidden',
      isDelivered ? 'border-matcha-200 dark:border-matcha-800' : 'border-stone-200 dark:border-stone-700',
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white dark:bg-stone-900">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
              isDelivered ? 'bg-matcha-100 dark:bg-matcha-900/40' : 'bg-amber-100 dark:bg-amber-900/40',
            )}>
              {isDelivered
                ? <CheckCircle2 className="w-5 h-5 text-matcha-600 dark:text-matcha-400" />
                : <Bike className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            </div>
            <div>
              <div className="text-sm font-bold text-stone-800 dark:text-stone-100">
                {isDelivered ? 'Bestellung angekommen!' : 'Deine Bestellung'}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400">#{bestellnummer}</div>
            </div>
          </div>
          {!isDelivered && displayMin !== null && (
            <div className={cn('text-right', CONFIDENCE_COLOR[eta.confidence])}>
              <div className="text-2xl font-black tabular-nums leading-none">{displayMin}</div>
              <div className="text-[10px] font-semibold">Min</div>
            </div>
          )}
        </div>

        {/* Phase bar */}
        <PhaseBar currentPhase={eta.phase} />

        {/* Phase labels */}
        <div className="flex items-center mt-1">
          {PHASES.map((p, i) => (
            <div key={p.key} className="flex-1 text-center">
              <span className={cn(
                'text-[9px] leading-none',
                i === PHASES.findIndex(ph => ph.key === eta.phase)
                  ? 'font-bold text-amber-600 dark:text-amber-400'
                  : 'text-stone-400 dark:text-stone-500',
              )}>
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Driver info */}
      {eta.driverName && (
        <div className="px-4 py-2.5 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex items-center gap-2">
          <Bike className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs text-stone-600 dark:text-stone-300">Fahrer: <strong>{eta.driverName}</strong></span>
        </div>
      )}

      {/* Confidence indicator */}
      {!isDelivered && (
        <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-stone-500 dark:text-stone-400">
            <Clock className="w-3 h-3" />
            Zuletzt aktualisiert {fetchedAt ? new Date(fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
          <div className={cn('text-[10px] font-semibold', CONFIDENCE_COLOR[eta.confidence])}>
            {eta.confidence === 'high' ? '● Genau' : eta.confidence === 'medium' ? '● Ca.' : '● Schätzung'}
          </div>
        </div>
      )}
    </div>
  );
}

