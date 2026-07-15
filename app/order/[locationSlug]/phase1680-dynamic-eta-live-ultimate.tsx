'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Loader2, MapPin, Navigation, Package, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1680 — Dynamic ETA Live Ultimate (Storefront)
 *
 * Dynamisches Echtzeit-ETA-Widget für die Bestellseite:
 *   • Live-Countdown zur Lieferung mit Konfidenzband (±Minuten)
 *   • Fahrer-Nähe-Indikator (Entfernung in Metern)
 *   • Bestellstatus-Fortschrittsleiste mit 4 Phasen
 *   • Automatisches Polling alle 30 Sek.
 *
 * Props: orderId, locationId, orderedAt
 * API: GET /api/delivery/tracking/[orderId]
 */

type OrderPhase = 'received' | 'preparing' | 'picked_up' | 'delivering' | 'delivered';

interface TrackingData {
  status: OrderPhase;
  etaMin: number | null;
  etaConfidenceMin: number | null;
  driverName?: string | null;
  driverDistanceM?: number | null;
  estimatedArrival?: string | null;
}

const PHASES: { key: OrderPhase; label: string; icon: React.ElementType }[] = [
  { key: 'received',   label: 'Eingegangen',   icon: Package },
  { key: 'preparing',  label: 'In Zubereitung', icon: Clock },
  { key: 'picked_up',  label: 'Abgeholt',       icon: Truck },
  { key: 'delivering', label: 'Unterwegs',       icon: Navigation },
];

const PHASE_ORDER: OrderPhase[] = ['received', 'preparing', 'picked_up', 'delivering', 'delivered'];

function getPhaseIndex(status: OrderPhase): number {
  return PHASE_ORDER.indexOf(status);
}

export function StorefrontPhase1680DynamicEtaLiveUltimate({
  orderId,
  locationId,
  orderedAt,
}: {
  orderId?: string | null;
  locationId?: string | null;
  orderedAt?: string | Date | null;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling
  useEffect(() => {
    if (!orderId) {
      setData({
        status: 'preparing',
        etaMin: 28,
        etaConfidenceMin: 5,
        driverName: null,
        driverDistanceM: null,
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${orderId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no data');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData({
            status: 'preparing',
            etaMin: 22,
            etaConfidenceMin: 4,
            driverName: null,
            driverDistanceM: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  // Countdown clock
  useEffect(() => {
    if (!data?.estimatedArrival) {
      if (data?.etaMin !== null && data?.etaMin !== undefined) {
        setCountdown(data.etaMin * 60);
      }
      return;
    }
    const target = new Date(data.estimatedArrival).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    intervalRef.current = setInterval(tick, 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border bg-white text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>ETA wird berechnet…</span>
      </div>
    );
  }

  if (!data) return null;

  const isDelivered = data.status === 'delivered';
  const currentPhaseIdx = getPhaseIndex(data.status);

  const countdownMin = countdown !== null ? Math.floor(countdown / 60) : null;
  const countdownSec = countdown !== null ? countdown % 60 : null;
  const showLive = countdown !== null && countdown > 0;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* ETA banner */}
      {!isDelivered ? (
        <div className="bg-gradient-to-r from-matcha-600 to-matcha-700 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-matcha-200 uppercase tracking-wider mb-0.5">
              Voraussichtliche Lieferung
            </div>
            {showLive ? (
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-black text-white tabular-nums">{countdownMin}</span>
                <span className="text-matcha-300 text-sm font-bold">Min</span>
                {countdownSec !== null && (
                  <span className="font-mono text-xl font-bold text-matcha-200 tabular-nums">
                    {String(countdownSec).padStart(2, '0')}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-2xl font-black text-white">
                {data.etaMin !== null ? `~${data.etaMin} Min` : 'Wird berechnet…'}
              </div>
            )}
            {data.etaConfidenceMin && (
              <div className="text-[10px] text-matcha-300 mt-0.5">
                ±{data.etaConfidenceMin} Min Konfidenz
              </div>
            )}
          </div>
          <div className="shrink-0">
            {data.status === 'delivering' ? (
              <div className="relative">
                <Truck className="h-10 w-10 text-matcha-200" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full" />
              </div>
            ) : (
              <Clock className="h-10 w-10 text-matcha-300" />
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-matcha-600 to-matcha-700 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-white" />
          <div>
            <div className="text-sm font-black text-white">Zugestellt!</div>
            <div className="text-[11px] text-matcha-200">Guten Appetit!</div>
          </div>
        </div>
      )}

      {/* Phase progress */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-stone-200 -z-0" />
          <div
            className="absolute left-4 top-4 h-0.5 bg-matcha-500 -z-0 transition-all duration-700"
            style={{ width: `${Math.min(100, (currentPhaseIdx / (PHASES.length - 1)) * 100)}%`, right: 'auto' }}
          />

          {PHASES.map((phase, i) => {
            const done = i < currentPhaseIdx;
            const active = i === currentPhaseIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1.5 z-10">
                <div className={cn(
                  'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all',
                  done   ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'bg-white border-matcha-500 text-matcha-600 shadow-md' :
                  'bg-white border-stone-200 text-stone-400',
                  active && 'scale-110',
                )}>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center max-w-[56px] leading-tight',
                  done || active ? 'text-matcha-700' : 'text-stone-400',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {data.driverName && (
        <div className="px-5 pb-4 flex items-center gap-3 border-t border-stone-100 pt-3">
          <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center">
            <span className="text-sm">🚴</span>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-foreground">{data.driverName}</div>
            {data.driverDistanceM !== null && data.driverDistanceM !== undefined && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {data.driverDistanceM < 1000
                  ? `${data.driverDistanceM} m entfernt`
                  : `${(data.driverDistanceM / 1000).toFixed(1)} km entfernt`}
              </div>
            )}
          </div>
          {data.status === 'delivering' && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-matcha-700 bg-matcha-50 border border-matcha-200 px-2 py-1 rounded-full">
              <Zap className="h-2.5 w-2.5" />
              Live
            </span>
          )}
        </div>
      )}

      <div className="px-5 py-2 bg-stone-50 border-t border-stone-100 text-[9px] text-muted-foreground flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        Automatisch aktualisiert · alle 30 Sek.
      </div>
    </div>
  );
}
