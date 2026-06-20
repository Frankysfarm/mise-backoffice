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
import { Bike, Clock, PauseCircle, Zap } from 'lucide-react';

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

  const isPaused = data?.queue_signal === 'paused';
  const isBusy = (data?.load ?? 'normal') === 'busy';
  const load = data?.load ?? 'normal';
  const style = LOAD_STYLES[load] ?? LOAD_STYLES.normal;

  if (isPaused) {
    return (
      <div className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
        'bg-red-600 text-white',
        className,
      )}>
        <PauseCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="font-bold">Bestellungen pausiert</span>
        <span className="text-[10px] font-medium opacity-80 hidden sm:inline">Bitte später versuchen</span>
      </div>
    );
  }

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

      {/* Fahrer-Status: nur sichtbar wenn Daten geladen */}
      {data?.drivers_online !== undefined && data.drivers_online > 0 && !isSurge && (
        <span className="flex items-center gap-0.5 text-[10px] font-medium opacity-70">
          <Bike className="h-3 w-3" />
          {data.drivers_online}
        </span>
      )}
      {data?.drivers_online === 0 && (
        <span className="text-[10px] font-black text-red-600">Keine Fahrer!</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 337: Default export — kompaktes Pill-Badge ohne locationId    */
/* Pollt /api/delivery/eta/live alle 120s, zeigt ~X Min Wartezeit.     */
/* Farbkodierung: grün ≤20min, amber 20–35min, rot >35min.             */
/* ------------------------------------------------------------------ */

interface SimpleBadgeData {
  eta_min: number;
}

export default function LiveWaitBadgeSimple({ orderType }: { orderType: string }) {
  const [etaMin, setEtaMin] = React.useState<number | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const fetchEta = React.useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/delivery/eta/live', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as SimpleBadgeData;
      setEtaMin(json.eta_min ?? null);
    } catch {
      // Fallback: keep previous or null → renders default
    }
  }, []);

  React.useEffect(() => {
    fetchEta();
    const iv = setInterval(fetchEta, 120_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
  }, [fetchEta]);

  // Display: abholung = ~40% of delivery time, min 10min
  const rawMin = etaMin ?? 25;
  const displayMin =
    orderType === 'abholung'
      ? Math.max(10, Math.round(rawMin * 0.4))
      : rawMin;

  const colorClass =
    displayMin <= 20
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : displayMin <= 35
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-red-100 text-red-800 border-red-300';

  const dotClass =
    displayMin <= 20
      ? 'bg-emerald-500'
      : displayMin <= 35
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold',
      colorClass,
    )}>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dotClass)} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotClass)} />
      </span>
      <Clock className="h-3.5 w-3.5 shrink-0" />
      ~{displayMin} Min
    </span>
  );
}
