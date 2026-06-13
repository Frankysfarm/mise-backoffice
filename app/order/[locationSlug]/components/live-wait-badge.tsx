'use client';

/**
 * LiveWaitBadge
 *
 * Zeigt Kunden die aktuelle Wartezeit dynamisch basierend auf dem
 * Live-Küchen-Queue. Pollt /api/delivery/eta/live alle 60s.
 *
 * Farbkodierung:
 *  - Grün (quiet):  schnelle Lieferung
 *  - Amber (normal): normale Auslastung
 *  - Rot (busy):    hohe Nachfrage / verlängerte Wartezeit
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Zap } from 'lucide-react';

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
  orderType: 'lieferung' | 'abholung';
  defaultDeliveryMin?: number;
  defaultPickupMin?: number;
  className?: string;
}

const LOAD_STYLES = {
  quiet:  { bg: 'bg-matcha-100',  text: 'text-matcha-800',  dot: 'bg-matcha-500',  label: 'Ruhig' },
  normal: { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500',    label: 'Normal' },
  busy:   { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Viel los' },
};

export function LiveWaitBadge({
  locationId,
  orderType,
  defaultDeliveryMin = 35,
  defaultPickupMin = 15,
  className,
}: Props) {
  const [data, setData] = useState<LiveEtaData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!locationId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/delivery/eta/live?location_id=${encodeURIComponent(locationId)}`,
        { signal: abortRef.current.signal, cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = (await res.json()) as LiveEtaData;
      setData(json);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { /* Zeige Default */ }
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
  }, [fetchData]);

  const isBusy = (data?.load ?? 'normal') === 'busy';
  const load = data?.load ?? 'normal';
  const style = LOAD_STYLES[load] ?? LOAD_STYLES.normal;

  // ETA-Berechnung
  const etaMin = data
    ? data.eta_min
    : (orderType === 'lieferung' ? defaultDeliveryMin : defaultPickupMin);

  // Pickup deutlich kürzer als Lieferung
  const displayMin = orderType === 'abholung'
    ? Math.max(10, Math.round(etaMin * 0.4))
    : etaMin;

  const rangeLow = Math.max(5, displayMin - 5);
  const rangeHigh = displayMin + 5;

  const isSurge = data?.queue_signal === 'surge' || (data?.eta_extension_min ?? 0) > 5;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
      isSurge ? 'bg-red-100 text-red-800' : style.bg,
      !isSurge && style.text,
      className,
    )}>
      {/* Pulsing dot — zeigt Live-Verbindung */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          isSurge ? 'bg-red-400' : style.dot,
        )} />
        <span className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          isSurge ? 'bg-red-500' : style.dot,
        )} />
      </span>

      <Clock className="h-3.5 w-3.5 shrink-0" />

      <span className="font-bold tabular-nums">
        {rangeLow}–{rangeHigh} Min
      </span>

      {isSurge && (
        <>
          <Zap className="h-3 w-3 text-red-600 shrink-0" />
          <span className="text-[10px] font-black text-red-700 hidden sm:inline">
            Hohe Nachfrage
          </span>
        </>
      )}

      {!isSurge && isBusy && (
        <span className="text-[10px] font-semibold opacity-80">{style.label}</span>
      )}
    </div>
  );
}
