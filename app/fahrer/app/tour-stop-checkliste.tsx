'use client';

/**
 * Phase 423 – TourStopCheckliste
 * A mobile-first checklist for the driver's current tour stops.
 * Shows each stop in sequence with:
 *  - Status (pending / current / done)
 *  - Customer name + address
 *  - ETA per stop
 *  - One-tap navigation button
 *  - Quick-complete action
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Package,
  User,
} from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_stadt: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

interface Props {
  stops: Stop[];
  currentOrderId?: string | null;
  onComplete?: (stopId: string, orderId: string) => void;
  onNavigate?: (address: string) => void;
  totalEtaMin?: number | null;
  batchStartedAt?: string | null;
}

function etaLabel(earliestIso: string | null, latestIso: string | null): string {
  if (!earliestIso && !latestIso) return '';
  const t = earliestIso ? new Date(earliestIso) : new Date(latestIso!);
  const now = new Date();
  const diffMin = Math.round((t.getTime() - now.getTime()) / 60_000);
  if (diffMin <= 0) return 'jetzt';
  if (diffMin < 60) return `~${diffMin} Min`;
  return t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function buildAddress(stop: Stop): string {
  const o = stop.order;
  if (!o) return '';
  const parts = [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean);
  return parts.join(', ');
}

export function TourStopCheckliste({ stops, currentOrderId, onComplete, onNavigate, totalEtaMin, batchStartedAt }: Props) {
  const [completingId, setCompletingId] = useState<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter((s) => s.geliefert_am !== null).length;
  const totalCount = sorted.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const elapsedMin = batchStartedAt
    ? Math.round((Date.now() - new Date(batchStartedAt).getTime()) / 60_000)
    : null;
  const remainMin = totalEtaMin && elapsedMin !== null ? Math.max(0, totalEtaMin - elapsedMin) : null;

  const handleComplete = useCallback(
    async (stop: Stop) => {
      if (!onComplete || stop.geliefert_am || completingId) return;
      setCompletingId(stop.id);
      try {
        await onComplete(stop.id, stop.order_id);
      } finally {
        setCompletingId(null);
      }
    },
    [onComplete, completingId],
  );

  const handleNav = useCallback(
    (stop: Stop) => {
      const addr = buildAddress(stop);
      if (!addr) return;
      if (onNavigate) {
        onNavigate(addr);
      } else {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [onNavigate],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl bg-gray-900/95 border border-white/10 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-matcha-400" />
            <span className="text-sm font-bold text-white">Tour-Stopps</span>
            <span className="text-xs text-gray-400">{doneCount}/{totalCount} erledigt</span>
          </div>
          {remainMin !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-300">
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="font-bold text-amber-300 tabular-nums">~{remainMin} Min</span>
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stops list */}
      <div className="divide-y divide-white/5">
        {sorted.map((stop, idx) => {
          const isDone = stop.geliefert_am !== null;
          const isCurrent = !isDone && (stop.order_id === currentOrderId || (!currentOrderId && stop.reihenfolge === sorted.find((s) => !s.geliefert_am)?.reihenfolge));
          const isPending = !isDone && !isCurrent;
          const isCompleting = completingId === stop.id;
          const address = buildAddress(stop);
          const eta = etaLabel(stop.order?.eta_earliest ?? null, stop.order?.eta_latest ?? null);

          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 transition-colors',
                isDone ? 'opacity-50' : isCurrent ? 'bg-white/5' : '',
              )}
            >
              {/* Status indicator */}
              <div className="shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-matcha-400" />
                ) : isCurrent ? (
                  <div className="relative">
                    <div className="h-5 w-5 rounded-full border-2 border-amber-400 animate-pulse" />
                    <div className="absolute inset-[3px] rounded-full bg-amber-400" />
                  </div>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center">
                    <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                  </div>
                )}
              </div>

              {/* Stop content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className={cn('text-sm font-bold truncate', isDone ? 'text-gray-500' : 'text-white')}>
                        {stop.order?.kunde_name ?? 'Kunde'}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">#{stop.order?.bestellnummer}</span>
                    </div>
                    {address && (
                      <div className="flex items-start gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-gray-500" />
                        <span className="truncate">{address}</span>
                      </div>
                    )}
                    {eta && !isDone && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400 font-semibold">
                        <Clock className="h-2.5 w-2.5" /> ETA {eta}
                      </div>
                    )}
                    {isDone && stop.geliefert_am && (
                      <div className="text-[10px] text-matcha-400 mt-0.5">
                        ✓ geliefert {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isDone && (
                    <div className="flex gap-2 shrink-0">
                      {address && (
                        <button
                          onClick={() => handleNav(stop)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          aria-label="Navigation starten"
                        >
                          <Navigation className="h-4 w-4" />
                        </button>
                      )}
                      {isCurrent && onComplete && (
                        <button
                          onClick={() => handleComplete(stop)}
                          disabled={isCompleting}
                          className={cn(
                            'flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors border',
                            isCompleting
                              ? 'bg-matcha-500/20 border-matcha-500/30 text-matcha-400 opacity-60 cursor-not-allowed'
                              : 'bg-matcha-500/20 border-matcha-500/30 text-matcha-400 hover:bg-matcha-500/30',
                          )}
                        >
                          {isCompleting ? (
                            <span className="animate-pulse">…</span>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Fertig</span>
                            </>
                          )}
                        </button>
                      )}
                      {isPending && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-gray-600">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
