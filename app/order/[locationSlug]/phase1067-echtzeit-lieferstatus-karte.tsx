'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingDaten = {
  status: string;
  eta_minutes?: number | null;
  driver_name?: string | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
};

function useTracking(orderId: string | null | undefined) {
  const [data, setData] = useState<TrackingDaten | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/tracking?order_id=${encodeURIComponent(orderId)}`);
        if (r.ok) setData(await r.json());
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orderId]);

  return data;
}

function DeliveryMapSvg({ progress }: { progress: number }) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Driver moves along a curved path from left (kitchen) to right (customer)
  const pathD = 'M 30,80 Q 100,20 170,80';
  const totalLen = 180;
  const driverX = 30 + clampedProgress * 140;
  const driverY = 80 - Math.sin(clampedProgress * Math.PI) * 60;

  return (
    <svg viewBox="0 0 200 110" className="w-full h-full" aria-hidden="true">
      {/* Road */}
      <path d={pathD} fill="none" stroke="#d1d5db" strokeWidth="6" strokeLinecap="round" className="dark:stroke-gray-600" />
      {/* Progress */}
      <path
        d={pathD}
        fill="none"
        stroke="#10b981"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={String(totalLen)}
        strokeDashoffset={String(totalLen * (1 - clampedProgress))}
        className="transition-all duration-1000"
      />
      {/* Kitchen icon */}
      <circle cx="30" cy="80" r="8" fill="#6b7280" className="dark:fill-gray-500" />
      <text x="30" y="84" textAnchor="middle" fontSize="8" fill="white">🍽</text>
      {/* Customer icon */}
      <circle cx="170" cy="80" r="8" fill="#10b981" />
      <text x="170" y="84" textAnchor="middle" fontSize="8" fill="white">🏠</text>
      {/* Driver icon */}
      <g transform={`translate(${driverX},${driverY})`}>
        <circle r="10" fill="#3b82f6" opacity="0.9" />
        <text y="4" textAnchor="middle" fontSize="10" fill="white">🛵</text>
      </g>
    </svg>
  );
}

const ACTIVE_STATUSES = new Set([
  'dispatched', 'en_route', 'unterwegs', 'in_delivery', 'abgeholt', 'assigned',
]);

export function Phase1067EchtzeitLieferstatusKarte({
  orderId,
  status,
}: {
  orderId?: string | null;
  status?: string | null;
}) {
  const tracking = useTracking(orderId);
  const [countdown, setCountdown] = useState<number | null>(null);

  const etaMin = tracking?.eta_minutes ?? null;

  useEffect(() => {
    if (etaMin === null || etaMin === undefined) return;
    setCountdown(etaMin * 60);
    const id = setInterval(() => setCountdown((c) => (c !== null && c > 0 ? c - 1 : c)), 1000);
    return () => clearInterval(id);
  }, [etaMin]);

  const isActive = ACTIVE_STATUSES.has(status ?? '') || ACTIVE_STATUSES.has(tracking?.status ?? '');
  if (!isActive || !orderId) return null;

  const etaSec = countdown ?? (etaMin !== null ? etaMin * 60 : null);
  const etaMinDisplay = etaSec !== null ? Math.ceil(etaSec / 60) : null;
  const etaSecRest = etaSec !== null ? etaSec % 60 : null;

  // Progress: assume 30 min total tour, infer progress from ETA
  const totalEstSec = (etaMin ?? 15) * 60 + (countdown !== null ? (etaMin ?? 15) * 60 - countdown : 0);
  const elapsed = etaSec !== null ? totalEstSec - etaSec : 0;
  const progress = totalEstSec > 0 ? Math.max(0.1, elapsed / totalEstSec) : 0.5;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800">
        <Navigation size={13} className="text-blue-600 dark:text-blue-400 animate-pulse" />
        <span className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wider flex-1">
          Dein Fahrer ist unterwegs
        </span>
        {tracking?.driver_name && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400">
            {tracking.driver_name}
          </span>
        )}
      </div>

      <div className="p-3">
        {/* SVG Map */}
        <div className="h-28 w-full mb-3 rounded-xl overflow-hidden bg-white dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 p-2">
          <DeliveryMapSvg progress={progress} />
        </div>

        {/* ETA */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-2.5">
            <Clock size={14} className="text-blue-600 dark:text-blue-400" />
            {etaMinDisplay !== null ? (
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100 tabular-nums">
                {etaMinDisplay}
                <span className="text-xs font-normal ml-0.5">Min</span>
                {etaSecRest !== null && (
                  <span className="text-xs font-normal ml-0.5">
                    {String(etaSecRest).padStart(2, '0')}
                    <span className="text-[9px] ml-0.5">Sek</span>
                  </span>
                )}
              </span>
            ) : (
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Bald da</span>
            )}
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex gap-2 text-[10px] text-blue-700 dark:text-blue-300">
              <span className="flex items-center gap-0.5"><MapPin size={9} />Küche</span>
              <span>→</span>
              <span className="flex items-center gap-0.5"><MapPin size={9} className="text-green-500" />Du</span>
            </div>
            <div className={cn(
              'mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
              'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
            )}>
              {Math.round(progress * 100)}% der Strecke zurück
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
