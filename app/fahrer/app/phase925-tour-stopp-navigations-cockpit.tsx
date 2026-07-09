'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Check, CheckCircle2, Clock, Loader2, MapPin, Navigation, Package,
} from 'lucide-react';

/**
 * Phase 925 — Tour-Stopp-Navigations-Cockpit (Fahrer-App)
 *
 * Zeigt alle Stopps der aktiven Tour mit:
 * - Status-Ampel je Stopp (ausstehend/angefahren/erledigt)
 * - ETA zum nächsten Stopp
 * - Kunden-Info + Adresse
 * - Ein-Klick Navigation starten
 *
 * Mobile-first, matcha-Theme.
 */

interface Stop {
  id: string;
  sequence: number;
  address?: string | null;
  customer_name?: string | null;
  eta_min?: number | null;
  status: 'pending' | 'en_route' | 'completed' | 'skipped';
  items_count?: number;
  order_number?: string | null;
}

interface Props {
  driverId: string;
  activeBatchId?: string | null;
  stops?: Stop[];
  isOnline?: boolean;
}

const MOCK_STOPS: Stop[] = [
  { id: 's1', sequence: 1, address: 'Musterstraße 12, 10115 Berlin', customer_name: 'Maria K.', eta_min: 8, status: 'en_route', items_count: 2, order_number: '1042' },
  { id: 's2', sequence: 2, address: 'Berliner Str. 45, 10117 Berlin', customer_name: 'Hans P.', eta_min: 14, status: 'pending', items_count: 1, order_number: '1043' },
  { id: 's3', sequence: 3, address: 'Parkweg 3, 10119 Berlin', customer_name: 'Sophie L.', eta_min: 22, status: 'pending', items_count: 3, order_number: '1044' },
];

type StopStatus = 'pending' | 'en_route' | 'completed' | 'skipped';

const STATUS_STYLES: Record<StopStatus, {
  bg: string; border: string; badge: string; label: string;
}> = {
  en_route:  { bg: 'bg-matcha-50',  border: 'border-matcha-300', badge: 'bg-matcha-500 text-white',  label: 'Unterwegs' },
  pending:   { bg: 'bg-stone-50',   border: 'border-stone-200',  badge: 'bg-stone-400 text-white',   label: 'Ausstehend' },
  completed: { bg: 'bg-stone-50/50', border: 'border-stone-100', badge: 'bg-stone-300 text-white',   label: 'Erledigt' },
  skipped:   { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-400 text-white',     label: 'Übersprungen' },
};

function openNavigation(address: string) {
  const encoded = encodeURIComponent(address);
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.open(`maps://maps.apple.com/?q=${encoded}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
  }
}

export function FahrerPhase925TourStoppNavigationsCockpit({
  driverId,
  activeBatchId,
  stops: externalStops,
  isOnline = true,
}: Props) {
  const [stops, setStops] = useState<Stop[]>(externalStops ?? []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!activeBatchId || externalStops) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/tour-stops?batch_id=${activeBatchId}&driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStops((json.stops as Stop[]) ?? MOCK_STOPS);
    } catch {
      setStops(MOCK_STOPS);
    } finally {
      setLoading(false);
    }
  }, [activeBatchId, driverId, externalStops]);

  useEffect(() => {
    if (externalStops) { setStops(externalStops); return; }
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load, externalStops]);

  const displayStops = stops.length > 0 ? stops : (activeBatchId ? [] : MOCK_STOPS);

  const activeStop = useMemo(() =>
    displayStops.find((s) => s.status === 'en_route'), [displayStops]);

  const completedCount = displayStops.filter((s) => s.status === 'completed').length;
  const totalCount = displayStops.filter((s) => s.status !== 'skipped').length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!isOnline || displayStops.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Stopps
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {completedCount}/{totalCount}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-stone-500">
              <span>Fortschritt</span>
              <span className="text-matcha-600">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stops */}
          <div className="space-y-2">
            {displayStops
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop, idx) => {
                const s = STATUS_STYLES[stop.status];
                const isCompleted = stop.status === 'completed';
                return (
                  <div
                    key={stop.id}
                    className={cn(
                      'rounded-xl border p-3 transition-opacity',
                      s.bg, s.border,
                      isCompleted && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Sequence number */}
                      <div className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black mt-0.5',
                        isCompleted ? 'bg-stone-300 text-white' : s.badge,
                      )}>
                        {isCompleted
                          ? <Check className="h-3.5 w-3.5" />
                          : idx + 1
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            'text-sm font-bold truncate',
                            isCompleted ? 'text-stone-400 line-through' : 'text-stone-800',
                          )}>
                            {stop.customer_name ?? `Stop ${stop.sequence}`}
                          </span>
                          {stop.order_number && (
                            <span className="text-[10px] text-stone-400 font-mono shrink-0">
                              #{stop.order_number}
                            </span>
                          )}
                        </div>

                        {stop.address && (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-stone-400 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-stone-500 leading-tight">
                              {stop.address}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-3 text-[10px] text-stone-400">
                            {stop.items_count != null && (
                              <span className="flex items-center gap-0.5">
                                <Package className="h-2.5 w-2.5" />
                                {stop.items_count} Artikel
                              </span>
                            )}
                            {stop.eta_min != null && !isCompleted && (
                              <span className="flex items-center gap-0.5 font-semibold text-matcha-600">
                                <Clock className="h-2.5 w-2.5" />
                                ~{stop.eta_min} Min
                              </span>
                            )}
                          </div>

                          {/* Navigation button */}
                          {stop.address && !isCompleted && (
                            <button
                              onClick={() => openNavigation(stop.address!)}
                              className={cn(
                                'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition',
                                stop.status === 'en_route'
                                  ? 'bg-matcha-600 text-white hover:bg-matcha-700'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                              )}
                            >
                              <Navigation className="h-3 w-3" />
                              Navi
                            </button>
                          )}

                          {isCompleted && (
                            <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {activeStop?.address && (
            <button
              onClick={() => openNavigation(activeStop.address!)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white py-3 text-sm font-bold hover:bg-matcha-700 transition active:scale-95"
            >
              <Navigation className="h-4 w-4" />
              Navigation starten → {activeStop.customer_name ?? 'Nächster Stopp'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
