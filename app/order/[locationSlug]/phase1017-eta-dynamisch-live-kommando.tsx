'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, ChefHat, Package, Bike, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Phase 1017 — Dynamische ETA-Live-Kommando (Storefront)
 *
 * Echtzeit-ETA-Anzeige für Kunden nach Bestellabgabe:
 * - Live-Countdown bis Lieferung
 * - Bestell-Phasen-Timeline (Küche → Verpackt → Fahrer → Geliefert)
 * - Fahrer-Annäherungs-Indikator (GPS-basiert wenn verfügbar)
 * - Konfidenz-Ampel (grün/amber/rot)
 * Polling: 30s. Props: orderId, locationId.
 */

interface EtaData {
  order_id: string;
  status: string;
  eta_min: number | null;
  eta_confidence: 'hoch' | 'mittel' | 'niedrig';
  phase: 'kueche' | 'verpackt' | 'fahrer' | 'geliefert';
  driver_name: string | null;
  driver_dist_km: number | null;
  bestellt_am: string;
  fertig_erwartet: string | null;
}

const MOCK: EtaData = {
  order_id: 'mock-1',
  status: 'in_zubereitung',
  eta_min: 22,
  eta_confidence: 'hoch',
  phase: 'kueche',
  driver_name: null,
  driver_dist_km: null,
  bestellt_am: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  fertig_erwartet: new Date(Date.now() + 22 * 60 * 1000).toISOString(),
};

interface Props {
  orderId: string;
  locationId?: string | null;
  className?: string;
}

const PHASES = [
  { key: 'kueche',    label: 'In Zubereitung', icon: ChefHat },
  { key: 'verpackt',  label: 'Verpackt',        icon: Package },
  { key: 'fahrer',    label: 'Unterwegs',       icon: Bike },
  { key: 'geliefert', label: 'Geliefert',       icon: CheckCircle2 },
] as const;

type Phase = typeof PHASES[number]['key'];

function phaseIndex(phase: Phase): number {
  return PHASES.findIndex(p => p.key === phase);
}

function confidenceStyle(c: string) {
  if (c === 'hoch')   return { dot: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', label: 'Zuverlässig' };
  if (c === 'mittel') return { dot: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-300',   label: 'Ungefähr' };
  return { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Schätzung' };
}

function fmtMin(min: number): string {
  if (min < 1) return 'Gleich';
  if (min === 1) return '1 Minute';
  return `${min} Minuten`;
}

export function EtaDynamischLiveKommando({ orderId, locationId, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ order_id: orderId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/eta?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      setData(json);
      if (json.fertig_erwartet) {
        const secLeft = Math.max(0, Math.round((new Date(json.fertig_erwartet).getTime() - Date.now()) / 1000));
        setCountdown(secLeft);
      }
    } catch {
      setData(MOCK);
      setCountdown(MOCK.eta_min ? MOCK.eta_min * 60 : null);
    } finally {
      setLoading(false);
    }
  }, [orderId, locationId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // Countdown tick
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c !== null && c > 0 ? c - 1 : c));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  if (loading || !data) return null;
  if (data.phase === 'geliefert') {
    return (
      <div className={cn('rounded-2xl bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-200 dark:border-matcha-700 p-5 flex flex-col items-center gap-2 text-center', className)}>
        <CheckCircle2 className="h-10 w-10 text-matcha-500" />
        <div className="text-lg font-black text-matcha-700 dark:text-matcha-300">Deine Bestellung ist angekommen!</div>
        <div className="text-sm text-muted-foreground">Guten Appetit!</div>
      </div>
    );
  }

  const conf = confidenceStyle(data.eta_confidence);
  const activePhaseIdx = phaseIndex(data.phase);

  const countdownMin = countdown !== null ? Math.ceil(countdown / 60) : data.eta_min;
  const countdownSec = countdown !== null ? countdown % 60 : null;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-md overflow-hidden', className)}>
      {/* ETA Countdown */}
      <div className="bg-gradient-to-br from-matcha-600 to-matcha-800 dark:from-matcha-700 dark:to-matcha-900 px-5 py-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 opacity-80" />
          <span className="text-sm font-semibold opacity-90">Voraussichtliche Lieferzeit</span>
          <div className="flex items-center gap-1 ml-auto">
            <div className={cn('h-2 w-2 rounded-full', conf.dot)} />
            <span className="text-[10px] opacity-80">{conf.label}</span>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="text-5xl font-black tabular-nums leading-none">
            {countdownMin !== null ? (countdownMin <= 0 ? '< 1' : countdownMin) : '—'}
          </div>
          <div className="text-base font-semibold opacity-80 mb-1">Min</div>
          {countdownSec !== null && countdownMin !== null && countdownMin <= 5 && (
            <div className="text-xl font-mono opacity-70 mb-0.5">
              :{String(countdownSec).padStart(2, '0')}
            </div>
          )}
        </div>
        {data.fertig_erwartet && (
          <div className="text-[11px] opacity-70 mt-1">
            Ankunft ca. {new Date(data.fertig_erwartet).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="relative flex items-center justify-between">
          {/* Verbindungslinie */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-muted" />
          <div
            className="absolute left-4 top-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ width: `${activePhaseIdx > 0 ? (activePhaseIdx / (PHASES.length - 1)) * 100 : 0}%`, right: 'auto', maxWidth: 'calc(100% - 32px)' }}
          />

          {PHASES.map((phase, idx) => {
            const done = idx < activePhaseIdx;
            const active = idx === activePhaseIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="relative flex flex-col items-center gap-1.5 z-10">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                  done   ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'bg-white dark:bg-zinc-900 border-matcha-500 text-matcha-600 dark:text-matcha-400 shadow-md ring-2 ring-matcha-200 dark:ring-matcha-800' :
                           'bg-muted border-muted-foreground/30 text-muted-foreground',
                )}>
                  <Icon className={cn('h-3.5 w-3.5', active && 'animate-pulse')} />
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center leading-tight max-w-[56px]',
                  done ? 'text-matcha-600 dark:text-matcha-400' : active ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.driver_name && (
        <div className="px-4 pb-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-3 py-2 flex items-center gap-2">
            <Bike className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-700 dark:text-blue-300">{data.driver_name} ist unterwegs</div>
              {data.driver_dist_km !== null && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  noch ca. {data.driver_dist_km < 1
                    ? `${Math.round(data.driver_dist_km * 1000)} m`
                    : `${data.driver_dist_km.toFixed(1)} km`} entfernt
                </div>
              )}
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* Warnung bei niedriger Konfidenz */}
      {data.eta_confidence === 'niedrig' && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Die ETA-Schätzung ist aktuell ungenau — hohe Nachfrage.
          </div>
        </div>
      )}
    </div>
  );
}
