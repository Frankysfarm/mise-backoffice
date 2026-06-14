'use client';

/**
 * OrderQueuePulse — Live Warteschlangen-Indikator für die Storefront.
 *
 * Zeigt Kunden während der Bestellphase den aktuellen Betriebszustand:
 * - Live ETA mit animiertem Countdown
 * - Queue-Tiefe ("Küche ist beschäftigt")
 * - Fahrer-Verfügbarkeit
 * - Surge / Pause Modus
 *
 * Pollt /api/delivery/eta/live alle 90s.
 * Zeigt Loading-Skeleton beim ersten Laden.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, Flame, PauseCircle, Wifi, WifiOff, Zap } from 'lucide-react';

interface LiveEtaData {
  eta_min: number;
  load: 'quiet' | 'normal' | 'busy';
  active_orders: number;
  drivers_online: number;
  queue_signal: string;
  eta_extension_min: number;
  signal_message: string | null;
}

interface Props {
  locationId: string;
  orderType?: 'lieferung' | 'abholung';
  defaultDeliveryMin?: number;
  defaultPickupMin?: number;
  compact?: boolean;
  className?: string;
}

const LOAD_CONFIG = {
  quiet: {
    bg: 'bg-matcha-50 border-matcha-200',
    badge: 'bg-matcha-100 text-matcha-700',
    dot: 'bg-matcha-500',
    ping: 'bg-matcha-400',
    label: 'Ruhig — schnelle Lieferung',
    etaColor: 'text-matcha-700',
  },
  normal: {
    bg: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    ping: 'bg-blue-400',
    label: 'Normale Auslastung',
    etaColor: 'text-blue-700',
  },
  busy: {
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    ping: 'bg-amber-400',
    label: 'Viel los – etwas mehr Zeit',
    etaColor: 'text-amber-700',
  },
};

function LiveDot({ color, ping }: { color: string; ping: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', ping)} />
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
    </span>
  );
}

export function OrderQueuePulse({
  locationId,
  orderType = 'lieferung',
  defaultDeliveryMin = 35,
  defaultPickupMin = 15,
  compact = false,
  className,
}: Props) {
  const [data, setData] = useState<LiveEtaData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    if (!locationId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/delivery/eta/live?location_id=${encodeURIComponent(locationId)}`,
        { signal: abortRef.current.signal, cache: 'no-store' },
      );
      if (!res.ok) { setError(true); return; }
      const json = (await res.json()) as LiveEtaData;
      setData(json);
      setError(false);
      setLastUpdate(new Date());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true);
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 90_000);
    return () => { clearInterval(iv); abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const isPaused = data?.queue_signal === 'paused';
  const isSurge = data?.queue_signal === 'surge' || (data?.eta_extension_min ?? 0) > 5;
  const load = data?.load ?? 'normal';
  const config = LOAD_CONFIG[load];

  // ETA
  const baseEta = data?.eta_min ?? (orderType === 'lieferung' ? defaultDeliveryMin : defaultPickupMin);
  const displayEta = orderType === 'abholung'
    ? Math.max(10, Math.round(baseEta * 0.4))
    : baseEta;
  const etaLow = Math.max(5, displayEta - 5);
  const etaHigh = displayEta + (isSurge ? 10 : 5);

  // Paused state
  if (isPaused) {
    return (
      <div className={cn(
        'rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3',
        className,
      )}>
        <div className="flex items-center gap-2.5">
          <PauseCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <div className="font-bold text-red-800 text-sm">Bestellannahme pausiert</div>
            <div className="text-[11px] text-red-600 mt-0.5">
              {data?.signal_message ?? 'Bitte in Kürze erneut versuchen'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
        isSurge ? 'border-red-200 bg-red-50' : config.bg,
        className,
      )}>
        {error
          ? <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <LiveDot color={isSurge ? 'bg-red-500' : config.dot} ping={isSurge ? 'bg-red-400' : config.ping} />
        }
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn('font-bold tabular-nums text-sm', isSurge ? 'text-red-700' : config.etaColor)}>
          {etaLow}–{etaHigh} Min
        </span>
        {isSurge && <Zap className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {data?.drivers_online !== undefined && !isSurge && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
            <Bike className="h-3 w-3" />
            {data.drivers_online}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 space-y-3 transition-all',
      isSurge ? 'border-red-200 bg-red-50' : config.bg,
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {error
            ? <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
            : <LiveDot color={isSurge ? 'bg-red-500' : config.dot} ping={isSurge ? 'bg-red-400' : config.ping} />
          }
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            {orderType === 'abholung' ? 'Abholzeit' : 'Lieferzeit'}
          </span>
        </div>
        {lastUpdate && (
          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
            <Wifi className="h-2.5 w-2.5" />
            Live
          </span>
        )}
      </div>

      {/* ETA Display */}
      <div className="flex items-end gap-3">
        <div>
          <div className={cn(
            'font-mono text-4xl font-black tabular-nums leading-none',
            isSurge ? 'text-red-700' : config.etaColor,
          )}>
            {etaLow}–{etaHigh}
          </div>
          <div className="text-sm font-bold text-muted-foreground mt-1">Minuten</div>
        </div>

        {/* Status Badge */}
        <div className="flex-1">
          {isSurge ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 border border-red-200 px-3 py-1.5">
              <Flame className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700">Hohe Nachfrage</span>
            </div>
          ) : (
            <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5', config.badge)}>
              <span className="text-xs font-bold">{config.label}</span>
            </div>
          )}

          {/* Fahrer-Info */}
          {data && (
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Bike className="h-3 w-3" />
                {data.drivers_online > 0
                  ? <>{data.drivers_online} Fahrer online</>
                  : <span className="text-red-600 font-bold">Keine Fahrer!</span>
                }
              </span>
              {data.active_orders > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {data.active_orders} aktive Bestellungen
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Surge-Nachricht */}
      {isSurge && data?.signal_message && (
        <div className="rounded-xl bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
          {data.signal_message}
        </div>
      )}

      {/* Extension Info */}
      {(data?.eta_extension_min ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 font-bold">
          <Zap className="h-3 w-3" />
          +{data!.eta_extension_min} Min aufgrund hoher Nachfrage
        </div>
      )}
    </div>
  );
}
