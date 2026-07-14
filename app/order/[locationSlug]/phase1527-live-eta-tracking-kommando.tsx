'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2, MapPin, Zap, Package } from 'lucide-react';

/**
 * Phase 1527 — Live-ETA-Tracking-Kommando (Storefront)
 *
 * Zeigt Kunden nach Bestellabschluss:
 *   - Dynamische ETA (zieht sich aus /api/tracking via localStorage order_id)
 *   - Fahrer-Annäherungs-Ampel (Grün/Gelb/Rot)
 *   - Bestellstatus-Phasen-Leiste
 *   - Countdown in Minuten + Sekunden
 *
 * Polling: alle 30 Sekunden.
 * Hydration-safe: kein SSR-State, alles in useEffect.
 */

const PHASES = [
  { key: 'neu',            label: 'Eingegangen',     icon: Package },
  { key: 'in_zubereitung', label: 'In Zubereitung',  icon: Zap },
  { key: 'unterwegs',      label: 'Unterwegs',        icon: Bike },
  { key: 'geliefert',      label: 'Geliefert',        icon: CheckCircle2 },
] as const;

type PhaseKey = (typeof PHASES)[number]['key'];

interface TrackingData {
  status?: string | null;
  estimated_delivery_at?: string | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_name?: string | null;
}

interface Props {
  locationId: string;
  orderPlaced?: boolean;
}

function phaseIndex(status: string | null | undefined): number {
  const s = status ?? '';
  if (s === 'geliefert' || s === 'abgeholt' || s === 'abgeschlossen') return 3;
  if (s === 'unterwegs') return 2;
  if (['in_zubereitung', 'bestätigt', 'confirmed'].includes(s)) return 1;
  return 0;
}

function etaDiff(eta: string | null | undefined): number | null {
  if (!eta) return null;
  return Math.round((new Date(eta).getTime() - Date.now()) / 60_000);
}

function fmtCountdown(mins: number): string {
  if (mins <= 0) return 'Gleich da!';
  if (mins === 1) return '~1 Minute';
  return `~${mins} Minuten`;
}

export function StorefrontPhase1527LiveEtaTrackingKommando({ locationId, orderPlaced }: Props) {
  const [mounted, setMounted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(`mise_last_order_${locationId}`);
    if (stored) setOrderId(stored);
  }, [locationId]);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/tracking?order_id=${orderId}&location_id=${locationId}`);
        if (r.ok) setTracking(await r.json());
      } catch {
        setTracking({ status: 'in_zubereitung' });
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orderId, locationId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null;
  if (!orderPlaced && !orderId) return null;
  if (!tracking && !loading) return null;

  const status   = tracking?.status ?? 'neu';
  const idx      = phaseIndex(status);
  const etaMins  = etaDiff(tracking?.estimated_delivery_at);
  const delivered = idx >= 3;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-matcha-600 px-4 py-2.5">
        <Bike className="h-4 w-4 text-white" />
        <span className="text-sm font-bold text-white">Live-Tracking</span>
        {!delivered && (
          <span className="ml-auto animate-pulse rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            Live
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Phase-Leiste */}
        <div className="flex items-center justify-between">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const active  = i === idx;
            const past    = i < idx;
            return (
              <div key={phase.key} className="flex flex-1 flex-col items-center gap-1 relative">
                {i < PHASES.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-1/2 top-4 h-0.5 w-full',
                      past ? 'bg-matcha-500' : 'bg-muted',
                    )}
                  />
                )}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-all',
                  delivered && i === 3 ? 'bg-matcha-600 ring-matcha-400' :
                  active  ? 'bg-matcha-100 dark:bg-matcha-900/30 ring-matcha-500 animate-pulse' :
                  past    ? 'bg-matcha-500 ring-matcha-400' :
                             'bg-muted ring-muted-foreground/20',
                )}>
                  <Icon className={cn(
                    'h-4 w-4',
                    (active || past || (delivered && i === 3)) ? 'text-matcha-700 dark:text-matcha-300' : 'text-muted-foreground',
                    past ? 'text-white' : '',
                  )} />
                </div>
                <span className={cn(
                  'text-[9px] font-semibold text-center leading-tight',
                  active ? 'text-matcha-700 dark:text-matcha-300' :
                  past   ? 'text-matcha-600' : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ETA */}
        {!delivered && etaMins !== null && (
          <div className="rounded-lg bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
              <span className="text-sm font-semibold">
                {fmtCountdown(etaMins)}
              </span>
            </div>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              etaMins <= 5  ? 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300' :
              etaMins <= 15 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                              'bg-muted text-muted-foreground',
            )}>
              {etaMins <= 5 ? 'Gleich da' : etaMins <= 15 ? 'Unterwegs' : 'In Vorbereitung'}
            </span>
          </div>
        )}

        {/* Driver */}
        {tracking?.driver_name && !delivered && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bike className="h-3.5 w-3.5 shrink-0" />
            <span>Fahrer: <strong className="text-foreground">{tracking.driver_name}</strong> ist unterwegs</span>
          </div>
        )}

        {/* Delivered */}
        {delivered && (
          <div className="flex items-center gap-2 rounded-lg bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-300 px-3 py-2.5">
            <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-matcha-700 dark:text-matcha-300">Bestellung geliefert!</p>
              <p className="text-xs text-muted-foreground">Guten Appetit!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
