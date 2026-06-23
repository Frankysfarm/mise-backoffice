'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, CheckCircle2, XCircle, Package } from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  status: 'pending' | 'arrived' | 'delivered' | 'failed';
  address: string;
  customer_name: string;
  order_id: string;
  bestellnummer: string;
  eta_min?: number | null;
  lat?: number | null;
  lng?: number | null;
  items?: { name: string; menge: number }[];
};

type Props = {
  stops: Stop[];
  currentStopIndex: number;
  onNavigate?: (stop: Stop) => void;
  onMarkDelivered?: (stopId: string) => void;
  onMarkFailed?: (stopId: string) => void;
};

function buildNavUrl(stop: Stop): string {
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`;
}

function formatItems(items: { name: string; menge: number }[]): string {
  return items.map((it) => `${it.menge}× ${it.name}`).join(', ');
}

function EtaDisplay({ etaMin }: { etaMin: number }) {
  const colorClass =
    etaMin > 5
      ? 'text-green-400'
      : etaMin >= 2
      ? 'text-amber-400'
      : 'text-red-400';

  const mins = Math.floor(etaMin);
  const secs = Math.round((etaMin - mins) * 60);

  return (
    <div className="flex flex-col items-center">
      <span className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-1">ETA</span>
      <span className={cn('text-4xl font-black tabular-nums leading-none', colorClass)}>
        {mins}
        <span className="text-2xl">:{String(secs).padStart(2, '0')}</span>
      </span>
      <span className={cn('text-[11px] font-bold mt-1', colorClass)}>min</span>
    </div>
  );
}

const STATUS_DOT: Record<Stop['status'], string> = {
  pending: 'bg-gray-500',
  arrived: 'bg-blue-500',
  delivered: 'bg-green-500',
  failed: 'bg-red-500',
};

export function TourStoppFokusHub({
  stops,
  currentStopIndex,
  onNavigate,
  onMarkDelivered,
  onMarkFailed,
}: Props) {
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const currentStop = stops[currentStopIndex] ?? null;

  // Sync etaMin from prop, then count down each second
  useEffect(() => {
    if (!currentStop) return;
    setEtaMin(currentStop.eta_min ?? null);
  }, [currentStop?.id, currentStop?.eta_min]);

  useEffect(() => {
    if (etaMin == null) return;
    const iv = setInterval(() => {
      setEtaMin((prev) => {
        if (prev == null) return null;
        const next = prev - 1 / 60; // subtract ~1 second in minutes
        return next < 0 ? 0 : next;
      });
    }, 1_000);
    return () => clearInterval(iv);
  }, [etaMin == null]);

  if (!currentStop) return null;

  const totalStops = stops.length;
  const stopNumber = currentStopIndex + 1;
  const navUrl = buildNavUrl(currentStop);
  const remainingStops = stops.filter((_, i) => i !== currentStopIndex);

  function handleNavigate() {
    onNavigate?.(currentStop!);
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Hero card */}
      <div className="rounded-2xl bg-white/10 border border-white/20 overflow-hidden">
        {/* Header: stop badge + customer name + order ref */}
        <div className="bg-white/10 px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-matcha-600 font-black text-white text-lg leading-none">
            {stopNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-300">
              Stop {stopNumber}/{totalStops}
            </div>
            <div className="text-white font-black text-xl leading-tight truncate">
              {currentStop.customer_name}
            </div>
            <div className="text-white/40 text-[11px] font-mono">#{currentStop.bestellnummer}</div>
          </div>
          {etaMin != null && (
            <div className="shrink-0">
              <EtaDisplay etaMin={etaMin} />
            </div>
          )}
        </div>

        {/* Address */}
        <div className="px-4 py-3 border-t border-white/10 flex items-start gap-2.5">
          <MapPin size={15} className="text-matcha-400 shrink-0 mt-0.5" />
          <span className="text-white font-semibold text-sm leading-snug">{currentStop.address}</span>
        </div>

        {/* Item list */}
        {currentStop.items && currentStop.items.length > 0 && (
          <div className="px-4 pb-3 border-t border-white/10 flex items-start gap-2.5">
            <Package size={14} className="text-white/40 shrink-0 mt-0.5" />
            <span className="text-white/70 text-sm leading-snug">
              {formatItems(currentStop.items)}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
          {/* Navigate button */}
          <button
            onClick={handleNavigate}
            className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-4 text-white font-black text-base active:scale-[0.98] transition"
          >
            <Navigation size={18} />
            <span>🗺️ Navigation starten</span>
          </button>

          {/* Delivered + Failed */}
          <div className="grid grid-cols-2 gap-2">
            {onMarkDelivered && (
              <button
                onClick={() => onMarkDelivered(currentStop.id)}
                className={cn(
                  'flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-matcha-500 px-4 text-white font-black text-base active:scale-[0.98] transition',
                  !onMarkFailed && 'col-span-2',
                )}
              >
                <CheckCircle2 size={18} />
                <span>✓ Zugestellt</span>
              </button>
            )}
            {onMarkFailed && (
              <button
                onClick={() => onMarkFailed(currentStop.id)}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-700/70 border border-red-500/50 px-4 text-white font-bold text-base active:scale-[0.98] transition"
              >
                <XCircle size={17} />
                <span>✕ Problem</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Remaining stops strip */}
      {remainingStops.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {remainingStops.map((stop, idx) => {
            const realIndex = stops.indexOf(stop);
            return (
              <div
                key={stop.id}
                className="flex shrink-0 w-36 flex-col gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-white/60">#{realIndex + 1}</span>
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full shrink-0',
                      STATUS_DOT[stop.status],
                    )}
                  />
                </div>
                <p className="text-white/80 text-[11px] font-semibold leading-snug line-clamp-2 break-words">
                  {stop.address}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
