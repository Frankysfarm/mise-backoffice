'use client';

/**
 * Phase 685 — Live-Tracking-Commander
 * Kompakte Live-Tracking-Karte mit Bestellstatus, Fahrer-Puls-Indikator und ETA-Countdown.
 * Props: orderId, locationId
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin, Activity, RefreshCw } from 'lucide-react';

type TrackingData = {
  status: 'pending' | 'preparing' | 'ready' | 'on_route' | 'delivered';
  etaMin: number | null;
  driverName?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  lastGpsSec?: number | null;
  stop_nr?: number | null;
  total_stops?: number | null;
  updatedAt?: string;
};

function GpsAge({ seconds }: { seconds: number | null | undefined }) {
  if (seconds == null) return null;
  const text = seconds < 30 ? 'Live' : seconds < 120 ? `${Math.floor(seconds / 60)} Min alt` : 'GPS veraltet';
  const color = seconds < 30 ? 'text-matcha-600 dark:text-matcha-400' : seconds < 120 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return (
    <span className={cn('flex items-center gap-1 text-xs font-bold', color)}>
      <Activity className="h-3 w-3" />
      {text}
    </span>
  );
}

function CountdownMin({ etaMin }: { etaMin: number | null }) {
  const [remaining, setRemaining] = useState(etaMin);
  useEffect(() => {
    setRemaining(etaMin);
    if (etaMin == null) return;
    const id = setInterval(() => {
      setRemaining((prev) => (prev !== null && prev > 0 ? Math.max(0, prev - 1 / 60) : prev));
    }, 1000);
    return () => clearInterval(id);
  }, [etaMin]);
  if (remaining === null) return null;
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining - mins) * 60);
  return (
    <span className="text-3xl font-black tabular-nums text-blue-600 dark:text-blue-400">
      {mins}:{String(secs).padStart(2, '0')}
    </span>
  );
}

const STATUS_LABEL: Record<TrackingData['status'], string> = {
  pending:   'Warten auf Küche',
  preparing: 'Wird zubereitet',
  ready:     'Abholbereit',
  on_route:  'Fahrer unterwegs',
  delivered: 'Zugestellt',
};

export function Phase685LiveTrackingCommander({
  orderId,
  locationId,
}: {
  orderId: string;
  locationId: string;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/customer/tracking?order_id=${orderId}&location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json() as TrackingData;
      setData(d);
      setLastRefresh(new Date());
    } catch {
      // API nicht verfügbar
    } finally {
      setLoading(false);
    }
  }, [orderId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const isOnRoute = data.status === 'on_route';
  const isDelivered = data.status === 'delivered';

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition',
      isOnRoute ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20' :
      isDelivered ? 'border-matcha-200 bg-matcha-50 dark:border-matcha-800 dark:bg-matcha-950/20' :
      'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className={cn('h-5 w-5', isOnRoute ? 'text-blue-500 animate-pulse' : 'text-muted-foreground')} />
          <span className="font-bold text-sm">{STATUS_LABEL[data.status]}</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnRoute && <GpsAge seconds={data.lastGpsSec} />}
          <button
            onClick={load}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition"
            title="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ETA */}
      {data.etaMin !== null && !isDelivered && (
        <div className="flex items-center gap-3 justify-center py-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col items-center">
            <CountdownMin etaMin={data.etaMin} />
            <span className="text-xs text-muted-foreground">Min:Sek Restzeit</span>
          </div>
        </div>
      )}

      {/* Fahrer-Info */}
      {isOnRoute && data.driverName && (
        <div className="flex items-center gap-2 rounded-xl bg-white/50 dark:bg-black/20 px-3 py-2">
          <Bike className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-xs font-bold">{data.driverName}</p>
            {data.stop_nr != null && data.total_stops != null && (
              <p className="text-[10px] text-muted-foreground">
                Stopp {data.stop_nr} von {data.total_stops}
              </p>
            )}
          </div>
          {lastRefresh && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Delivered-State */}
      {isDelivered && (
        <div className="text-center py-2">
          <p className="text-matcha-600 dark:text-matcha-400 font-bold text-sm">Guten Appetit! 🍴</p>
          <p className="text-xs text-muted-foreground mt-0.5">Deine Bestellung wurde zugestellt.</p>
        </div>
      )}
    </div>
  );
}
