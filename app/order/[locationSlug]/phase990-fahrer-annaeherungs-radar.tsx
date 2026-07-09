'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin } from 'lucide-react';

/**
 * Phase 990 — Fahrer-Annäherungs-Radar (Storefront)
 *
 * Zeigt wenn der Fahrer < 500m entfernt ist: Echtzeit-Entfernungsanzeige
 * + pulsierender Radar-Kreis. Polling /api/delivery/tracking?order_id=...
 * Nur sichtbar wenn Status = unterwegs/in_delivery/dispatched.
 */

type TrackingData = {
  status: string;
  driver_lat?: number | null;
  driver_lng?: number | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  eta_minutes?: number | null;
  driver_name?: string | null;
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ACTIVE_STATUSES = ['unterwegs', 'in_delivery', 'dispatched', 'abgeholt'];
const RADAR_THRESHOLD_M = 500;

interface Props {
  orderId: string | null;
  status: string | null;
  className?: string;
}

export function Phase990FahrerAnnaeherungsRadar({ orderId, status, className }: Props) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);

  const isActive = ACTIVE_STATUSES.includes(status ?? '');

  useEffect(() => {
    if (!orderId || !isActive) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (res.ok) {
          const json = await res.json() as TrackingData;
          setTracking(json);
        }
      } catch {
        // silently fail
      }
    };

    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [orderId, isActive]);

  const distanceM = useMemo(() => {
    if (!tracking?.driver_lat || !tracking?.driver_lng) return null;
    if (!tracking?.customer_lat || !tracking?.customer_lng) return null;
    return haversineM(
      tracking.driver_lat, tracking.driver_lng,
      tracking.customer_lat, tracking.customer_lng,
    );
  }, [tracking]);

  const isNear = distanceM !== null && distanceM < RADAR_THRESHOLD_M;

  if (!isActive || !isNear || distanceM === null) return null;

  const distLabel =
    distanceM < 50
      ? 'Gleich da!'
      : distanceM < 100
        ? `ca. ${Math.round(distanceM / 10) * 10} m`
        : `ca. ${Math.round(distanceM / 50) * 50} m`;

  const urgency = distanceM < 100 ? 'imminent' : distanceM < 250 ? 'close' : 'near';

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className,
      urgency === 'imminent'
        ? 'border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30'
        : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20'
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Radar animation */}
        <div className="relative shrink-0 w-10 h-10">
          <div className={cn(
            'absolute inset-0 rounded-full opacity-30 animate-ping',
            urgency === 'imminent' ? 'bg-matcha-500' : 'bg-blue-500'
          )} />
          <div className={cn(
            'absolute inset-[4px] rounded-full opacity-50',
            urgency === 'imminent' ? 'bg-matcha-400' : 'bg-blue-400',
            urgency !== 'imminent' ? 'animate-pulse' : ''
          )} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Navigation className={cn(
              'h-4 w-4',
              urgency === 'imminent' ? 'text-matcha-700 dark:text-matcha-300' : 'text-blue-700 dark:text-blue-300'
            )} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-sm font-bold',
            urgency === 'imminent' ? 'text-matcha-700 dark:text-matcha-300' : 'text-blue-700 dark:text-blue-300'
          )}>
            {urgency === 'imminent' ? 'Fahrer ist fast da!' : 'Fahrer nähert sich'}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{distLabel} entfernt</span>
            {tracking?.driver_name && (
              <span className="text-xs text-muted-foreground">· {tracking.driver_name}</span>
            )}
          </div>
        </div>

        {tracking?.eta_minutes !== null && tracking?.eta_minutes !== undefined && (
          <div className="shrink-0 text-right">
            <div className={cn(
              'text-lg font-black tabular-nums leading-none',
              urgency === 'imminent' ? 'text-matcha-700 dark:text-matcha-300' : 'text-blue-700 dark:text-blue-300'
            )}>
              {tracking.eta_minutes}&apos;
            </div>
            <div className="text-[9px] text-muted-foreground">Min</div>
          </div>
        )}
      </div>

      {urgency === 'imminent' && (
        <div className="bg-matcha-100 dark:bg-matcha-900/30 border-t border-matcha-200 dark:border-matcha-800 px-4 py-1.5 text-center">
          <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
            Bitte zur Tür gehen — Fahrer ist in weniger als 1 Minute da!
          </span>
        </div>
      )}
    </div>
  );
}
