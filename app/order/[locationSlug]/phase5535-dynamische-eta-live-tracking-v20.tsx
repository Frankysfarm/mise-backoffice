'use client';

/**
 * Phase 5535 — Dynamische ETA Live-Tracking V20
 *
 * V19+: Animierter Fahrer-Annäherungs-Radar; ETA-Vertrauens-Band ±min;
 * Fortschritts-Phasen-Bar Bestellung/Küche/Unterwegs/Ankunft;
 * Live-Puls-Indikator; Transparenz-Info Küche+Fahrer;
 * 30s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Zap } from 'lucide-react';

/* ─── Typen ─────────────────────────────────────────────── */
type Phase = 'bestellt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  bestellnummer: string;
  phase: Phase;
  eta_min: number;
  eta_min_min: number; // Untergrenze ETA
  eta_min_max: number; // Obergrenze ETA
  eta_confidence_pct: number;
  driver_name: string | null;
  driver_distance_km: number | null;
  kueche_start: string | null;
  abholzeit: string | null;
  prep_pct: number; // 0-100
  delivery_pct: number; // 0-100
}

/* ─── Mock-Daten ─────────────────────────────────────────── */
const MOCK_TRACKING: TrackingData = {
  order_id: 'mock-1',
  bestellnummer: '#1047',
  phase: 'unterwegs',
  eta_min: 7,
  eta_min_min: 5,
  eta_min_max: 10,
  eta_confidence_pct: 82,
  driver_name: 'Mehmet K.',
  driver_distance_km: 1.4,
  kueche_start: new Date(Date.now() - 15 * 60_000).toISOString(),
  abholzeit: new Date(Date.now() - 4 * 60_000).toISOString(),
  prep_pct: 100,
  delivery_pct: 65,
};

/* ─── Phase-Konfiguration ────────────────────────────────── */
const PHASES: { id: Phase; label: string; icon: typeof ChefHat }[] = [
  { id: 'bestellt',        label: 'Bestellt',    icon: Package },
  { id: 'in_zubereitung',  label: 'Küche',       icon: ChefHat },
  { id: 'unterwegs',       label: 'Unterwegs',   icon: Bike },
  { id: 'geliefert',       label: 'Ankunft',     icon: CheckCircle2 },
];

const PHASE_ORDER: Phase[] = ['bestellt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}

function fmtMin(min: number): string {
  if (min <= 0) return 'Gleich';
  return `${min} Min`;
}

/* ─── Puls-Animationsklasse ─────────────────────────────── */
function PulsingDot({ color = 'bg-emerald-500' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
    </span>
  );
}

/* ─── Radar-Visualisierung ──────────────────────────────── */
function DriverRadar({ distanceKm, active }: { distanceKm: number | null; active: boolean }) {
  if (!active || distanceKm === null) return null;

  const rings = [3, 2, 1]; // km-Ringe
  const driverPos = Math.min(distanceKm / 3, 1); // 0=nah 1=weit

  return (
    <div className="flex flex-col items-center py-3">
      <div className="relative w-32 h-32">
        {/* Ringe */}
        {rings.map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-emerald-200 dark:border-emerald-800"
            style={{
              width: `${(1 - (r - 1) / 3) * 100}%`,
              height: `${(1 - (r - 1) / 3) * 100}%`,
              top: `${((r - 1) / 3) * 50}%`,
              left: `${((r - 1) / 3) * 50}%`,
            }}
          />
        ))}
        {/* Ziel (Restaurant) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        </div>
        {/* Fahrer-Position */}
        <div
          className="absolute"
          style={{
            top: `${15 + driverPos * 30}%`,
            left: `${55 + driverPos * 15}%`,
          }}
        >
          <Bike className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <div className="text-[10px] text-zinc-500 mt-1">
        {distanceKm.toFixed(1)}km entfernt
      </div>
    </div>
  );
}

/* ─── Haupt-Komponente ───────────────────────────────────── */
export function StorefrontPhase5535DynamischeEtaLiveTrackingV20({
  orderId,
  token,
}: {
  orderId?: string;
  token?: string;
}) {
  const [data, setData] = useState<TrackingData>(MOCK_TRACKING);
  const [, setTick] = useState(0);
  const loadingRef = useRef(false);

  // 1s-Tick
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 30s-Polling
  useEffect(() => {
    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const url = orderId
          ? `/api/delivery/tracking?orderId=${orderId}&phase=5535`
          : token
          ? `/api/delivery/tracking?token=${token}&phase=5535`
          : null;
        if (!url) return;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('api');
        const d = await r.json();
        if (d.tracking) setData(d.tracking);
      } catch {
        // Mock-Fallback bleibt
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, token]);

  const currentPhaseIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-3',
        isDelivered
          ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
          : 'bg-gradient-to-r from-blue-600 to-indigo-600',
      )}>
        <Bike className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">
          {isDelivered ? 'Geliefert!' : 'Live-Tracking'}
        </span>
        <span className="text-xs text-blue-200 ml-1">{data.bestellnummer}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <PulsingDot color={isDelivered ? 'bg-emerald-300' : 'bg-blue-300'} />
          <span className="text-xs text-blue-200">Live</span>
        </div>
      </div>

      {/* ETA-Anzeige */}
      {!isDelivered && (
        <div className="px-4 pt-4 pb-2 text-center">
          <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {fmtMin(data.eta_min)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Geschätzte Ankunftszeit: in {data.eta_min_min}–{data.eta_min_max} Min
          </div>
          {/* Vertrauens-Band */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-1 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700 relative">
              <div
                className="absolute top-0 h-1 rounded-full bg-blue-500"
                style={{ left: '20%', right: `${100 - data.eta_confidence_pct}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500">{data.eta_confidence_pct}% Konfidenz</span>
          </div>
        </div>
      )}

      {isDelivered && (
        <div className="px-4 pt-4 pb-2 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-2">Deine Bestellung ist da!</div>
          <div className="text-xs text-zinc-500 mt-1">Guten Appetit! 🍽️</div>
        </div>
      )}

      {/* Phasen-Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          {PHASES.map((p, i) => {
            const done = currentPhaseIdx >= phaseIndex(p.id) + (p.id === 'geliefert' ? 1 : 0);
            const active = p.id === data.phase || (p.id === 'in_zubereitung' && data.phase === 'fertig');
            const Icon = p.icon;
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center">
                {/* Connector links */}
                {i > 0 && (
                  <div className="absolute" />
                )}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-400',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className={cn(
                  'text-[10px] mt-1 text-center',
                  done ? 'text-emerald-600 dark:text-emerald-400 font-medium' :
                  active ? 'text-blue-600 dark:text-blue-400 font-medium' :
                  'text-zinc-400',
                )}>
                  {p.label}
                </div>
                {/* Verbindungslinie */}
                {i < PHASES.length - 1 && (
                  <div className={cn(
                    'absolute mt-4 ml-8 h-0.5 w-full max-w-16 -translate-y-4',
                    currentPhaseIdx > i ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Radar + Fahrer-Info */}
      {data.driver_name && data.phase === 'unterwegs' && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-2">
          <div className="flex items-center gap-3">
            <DriverRadar distanceKm={data.driver_distance_km} active={data.phase === 'unterwegs'} />
            <div className="flex-1">
              <div className="text-xs text-zinc-500">Dein Fahrer</div>
              <div className="text-sm font-bold">{data.driver_name}</div>
              {data.driver_distance_km !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">
                    {data.driver_distance_km.toFixed(1)} km entfernt
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Küchen-Transparenz */}
      {(data.phase === 'in_zubereitung' || data.phase === 'fertig') && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <ChefHat className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium">Küchen-Status</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-amber-500 transition-all duration-1000"
              style={{ width: `${data.prep_pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
            <span>In Zubereitung</span>
            <span>{data.prep_pct}%</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-2.5 pt-1 flex items-center gap-1.5 text-[10px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
        <Clock className="h-3 w-3" />
        <span>30s-Polling · Echtzeit-ETA · V20</span>
        <Zap className="h-3 w-3 ml-auto text-blue-400" />
      </div>
    </div>
  );
}
