'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1385 — Live-Tracking ETA-Cockpit (Storefront)
 *
 * Dynamisches ETA-Cockpit für die Bestellbestätigungs-Seite:
 *   • Phasen-Timeline (Eingegangen → Zubereitung → Unterwegs → Geliefert)
 *   • Sekunden-genauer Countdown bis Lieferung
 *   • Fahrer-Näherungs-Anzeige (wenn GPS-Daten verfügbar)
 *   • Farbkodierung: Grün (pünktlich) → Gelb (<5min) → Rot (überfällig)
 *   • 30-Sek-Polling auf /api/delivery/tracking/[orderId]
 *
 * Nach Phase1380 in storefront.tsx einbinden.
 */

const PHASES = [
  { key: 'neu',            label: 'Eingegangen',    icon: Package    },
  { key: 'bestätigt',      label: 'Angenommen',     icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat    },
  { key: 'fertig',         label: 'Bereit',         icon: Package    },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: Truck      },
  { key: 'geliefert',      label: 'Geliefert',      icon: MapPin     },
] as const;

function statusToPhaseIdx(status: string): number {
  const idx = PHASES.findIndex((p) => p.key === status);
  return idx >= 0 ? idx : 0;
}

interface TrackingData {
  status: string;
  etaMin: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
  driverNearby: boolean;
}

interface Props {
  orderId: string | null;
  locationId: string;
  initialEtaMin?: number;
  initialStatus?: string;
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return '🎉 Gleich da!';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function etaStufe(sek: number): 'gruen' | 'gelb' | 'rot' {
  if (sek <= 0)   return 'rot';
  if (sek <= 300) return 'gelb';
  return 'gruen';
}

export function StorefrontPhase1389LiveTrackingEtaCockpit({ orderId, locationId, initialEtaMin = 30, initialStatus = 'neu' }: Props) {
  const [tracking, setTracking] = useState<TrackingData>({
    status: initialStatus,
    etaMin: initialEtaMin,
    driverName: null,
    driverDistanceKm: null,
    driverNearby: false,
  });
  const [countdown, setCountdown] = useState(initialEtaMin * 60);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling for tracking updates
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${orderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setTracking({
          status: data.status ?? initialStatus,
          etaMin: data.eta_min ?? null,
          driverName: data.driver_name ?? null,
          driverDistanceKm: data.driver_distance_km ?? null,
          driverNearby: !!data.driver_nearby,
        });
        if (data.eta_min != null) {
          setCountdown(data.eta_min * 60);
        }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, initialStatus]);

  // Countdown tick
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setCountdown((c) => Math.max(-60, c - 1));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const phaseIdx = statusToPhaseIdx(tracking.status);
  const isDelivered = tracking.status === 'geliefert';
  const stufe = isDelivered ? 'gruen' : etaStufe(countdown);

  const STUFE_COLOR: Record<string, { text: string; ring: string; bg: string }> = {
    gruen:  { text: 'text-green-700 dark:text-green-300',  ring: 'stroke-green-500',  bg: 'bg-green-50 dark:bg-green-950/20' },
    gelb:   { text: 'text-amber-700 dark:text-amber-300',  ring: 'stroke-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
    rot:    { text: 'text-red-700 dark:text-red-300',      ring: 'stroke-red-500',    bg: 'bg-red-50 dark:bg-red-950/20' },
  };
  const sc = STUFE_COLOR[stufe];

  const circumference = 2 * Math.PI * 40;
  const maxSek = initialEtaMin * 60;
  const progressPct = isDelivered ? 1 : Math.max(0, Math.min(1, 1 - countdown / Math.max(maxSek, 1)));
  const offset = circumference - progressPct * circumference;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn('px-4 py-2.5 border-b border-border flex items-center gap-2', sc.bg)}>
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Live-Tracking</span>
        {tracking.driverNearby && (
          <span className="ml-auto text-[10px] font-black text-green-700 dark:text-green-300 animate-pulse">
            🚴 Fahrer in der Nähe!
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 py-4">
        {/* Countdown ring */}
        <div className="relative flex items-center justify-center h-24 w-24 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
            <circle
              cx="50" cy="50" r="40" fill="none" strokeWidth="10" strokeLinecap="round"
              className={sc.ring}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="relative z-10 text-center">
            {isDelivered ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
            ) : (
              <>
                <div className={cn('font-mono text-lg font-black tabular-nums', sc.text)}>
                  {formatCountdown(countdown)}
                </div>
                <div className="text-[8px] text-muted-foreground uppercase font-bold">ETA</div>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold mb-1', sc.text)}>
            {isDelivered ? '🎉 Deine Bestellung ist da!' :
             stufe === 'rot' ? '⚡ Jeden Moment!' :
             stufe === 'gelb' ? '🔔 Fast fertig!' :
             '👍 Deine Bestellung ist unterwegs'}
          </div>
          {tracking.driverName && !isDelivered && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Truck className="h-3 w-3" />
              <span>Fahrer: <strong>{tracking.driverName}</strong></span>
            </div>
          )}
          {tracking.driverDistanceKm != null && !isDelivered && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>~{tracking.driverDistanceKm.toFixed(1)} km entfernt</span>
            </div>
          )}
        </div>
      </div>

      {/* Phase timeline */}
      <div className="px-4 pb-4">
        <div className="flex items-center">
          {PHASES.map((phase, i) => {
            const done = i <= phaseIdx;
            const active = i === phaseIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center transition-all duration-500',
                    done ? 'bg-matcha-600 text-white shadow-sm' :
                    active ? 'bg-matcha-200 text-matcha-800 ring-2 ring-matcha-400' :
                    'bg-muted text-muted-foreground',
                    active && 'scale-110',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className={cn(
                    'text-[9px] mt-0.5 text-center font-bold w-14 leading-tight',
                    done || active ? 'text-matcha-700 dark:text-matcha-300' : 'text-muted-foreground',
                  )}>
                    {phase.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mb-4 mx-0.5 transition-all duration-500',
                    i < phaseIdx ? 'bg-matcha-500' : 'bg-muted/60',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
