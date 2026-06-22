'use client';

/**
 * BestellPhasenBanner — Pre-order social proof banner für die Storefront.
 *
 * Zeigt Kunden vor der Bestellung die aktuellen Servicequalitäts-Signale:
 *   - Live-Wartezeit (ETA)
 *   - Anzahl aktiver Lieferungen
 *   - Online-Fahrer
 *   - Pünktlichkeitsrate
 *
 * Nur sichtbar wenn orderType === 'lieferung'.
 * Pollt /api/delivery/public/avg-eta alle 60s.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, Clock, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvgEtaData {
  avgEtaMin?: number;
  activeOrders?: number;
  onTimePct?: number;
  driversOnline?: number;
}

export function BestellPhasenBanner({
  locationId,
  orderType,
}: {
  locationId: string;
  orderType: string;
}) {
  const [data, setData] = useState<AvgEtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/delivery/public/avg-eta?location_id=${encodeURIComponent(locationId)}`,
        { signal: abortRef.current.signal, cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = (await res.json()) as AvgEtaData;
      setData(json);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { /* Ignore — show nothing */ }
    } finally {
      setLoading(false);
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

  if (orderType !== 'lieferung') return null;

  // --- Shimmer skeleton during initial load ---
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 h-9 w-32 rounded-full bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // No data at all → render nothing
  if (!data) return null;

  // Build badge list — only include badges with real values
  type Badge = {
    icon: typeof Bike;
    label: string;
    value: string;
    colorCls: string;
    dotColor?: string;
  };

  const badges: Badge[] = [];

  if (typeof data.driversOnline === 'number') {
    badges.push({
      icon: Bike,
      label: 'Fahrer online',
      value: String(data.driversOnline),
      colorCls: 'bg-matcha-50 border-matcha-200 text-matcha-700',
      dotColor: 'bg-matcha-500',
    });
  }

  if (typeof data.avgEtaMin === 'number') {
    badges.push({
      icon: Clock,
      label: 'ETA',
      value: `~${data.avgEtaMin} Min`,
      colorCls: 'bg-blue-50 border-blue-200 text-blue-700',
      dotColor: 'bg-blue-500',
    });
  }

  if (typeof data.onTimePct === 'number') {
    badges.push({
      icon: CheckCircle2,
      label: 'pünktlich',
      value: `${data.onTimePct}%`,
      colorCls: 'bg-matcha-50 border-matcha-200 text-matcha-700',
    });
  }

  if (typeof data.activeOrders === 'number') {
    badges.push({
      icon: Package,
      label: 'aktive Lieferungen',
      value: String(data.activeOrders),
      colorCls: 'bg-stone-50 border-stone-200 text-stone-600',
    });
  }

  // Nothing worth showing
  if (badges.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Horizontal scrollable strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {/* Live indicator pill */}
        <div className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-matcha-200 bg-matcha-50 px-2.5 py-1.5 text-xs font-semibold text-matcha-700">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-500" />
          </span>
          <Zap className="h-3 w-3 shrink-0" />
          <span>Live</span>
        </div>

        {/* Data badges */}
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.label}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium',
                badge.colorCls,
              )}
            >
              {badge.dotColor && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                      badge.dotColor,
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex h-1.5 w-1.5 rounded-full',
                      badge.dotColor,
                    )}
                  />
                </span>
              )}
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-bold tabular-nums">{badge.value}</span>
              <span className="opacity-75">{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
