'use client';

/**
 * AktiveLieferungLiveBoard — Phase 421
 *
 * Zeigt alle aktuell aktiven Lieferungen (Touren mit Status on_route/at_restaurant)
 * als Live-Board mit Timing-Ampel und ETA-Countdown.
 * Nutzt: GET /api/delivery/tours?location_id=...
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  order_id: string;
  sequence: number;
  address: string | null;
  order: { bestellnummer: string; eta_earliest: string | null; eta_latest: string | null; status: string } | null;
}

interface Driver {
  id: string;
  name: string | null;
  vehicle: string | null;
  state: string;
}

interface Tour {
  id: string;
  state: string;
  zone: string | null;
  dispatch_score: number | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  stop_count: number | null;
  driver: Driver | null;
  stops: Stop[];
}

type ZeitHealth = 'ok' | 'knapp' | 'spaet';

function etaHealth(etaLatest: string | null): ZeitHealth {
  if (!etaLatest) return 'ok';
  const diffMin = (new Date(etaLatest).getTime() - Date.now()) / 60_000;
  if (diffMin < 0) return 'spaet';
  if (diffMin < 5) return 'knapp';
  return 'ok';
}

function formatEta(iso: string | null): string {
  if (!iso) return '—';
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (diffMin < 0) return `${Math.abs(diffMin)}m über`;
  if (diffMin === 0) return 'jetzt';
  return `in ${diffMin}m`;
}

const HEALTH_STYLE: Record<ZeitHealth, { dot: string; text: string; badge: string; label: string }> = {
  ok:    { dot: 'bg-matcha-500',  text: 'text-matcha-600',  badge: 'bg-matcha-100 text-matcha-700',  label: 'Pünktlich' },
  knapp: { dot: 'bg-amber-400',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Knapp' },
  spaet: { dot: 'bg-red-500',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700',      label: 'Verspätet' },
};

function useTick(ms = 10_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export function AktiveLieferungLiveBoard({ locationId }: { locationId: string | null }) {
  const [tours, setTours]   = useState<Tour[]>([]);
  const [open, setOpen]     = useState(true);
  const [loading, setLoading] = useState(true);
  useTick();

  const laden = useCallback(() => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/tours?location_id=${encodeURIComponent(locationId)}&state=active`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.tours) setTours(d.tours as Tour[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    laden();
    const iv = setInterval(laden, 30_000);
    return () => clearInterval(iv);
  }, [laden]);

  const active = tours.filter(t => ['assigned', 'at_restaurant', 'on_route'].includes(t.state));

  if (!locationId || (!loading && active.length === 0)) return null;

  const spaetCount = active.filter(t =>
    t.stops.some(s => s.order && etaHealth(s.order.eta_latest) === 'spaet')
  ).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition border-b"
      >
        <Truck className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider">
          Aktive Lieferungen · Live
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {!loading && (
          <>
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {active.length} Tour{active.length !== 1 ? 'en' : ''}
            </span>
            {spaetCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                {spaetCount} verspätet
              </span>
            )}
          </>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {loading && active.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lädt Touren…
            </div>
          )}

          {active.map(tour => {
            const driverName = tour.driver?.name ?? 'Fahrer';
            const openStops  = tour.stops.filter(s => s.order && !['geliefert', 'storniert'].includes(s.order.status));
            const nextStop   = openStops.sort((a, b) => a.sequence - b.sequence)[0] ?? null;
            const health     = nextStop?.order ? etaHealth(nextStop.order.eta_latest) : 'ok';
            const hs         = HEALTH_STYLE[health];
            const stateLabel = tour.state === 'at_restaurant' ? 'Wartet auf Pickup' : tour.state === 'on_route' ? 'Unterwegs' : 'Zugewiesen';

            return (
              <div key={tour.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                {/* Gesundheits-Dot */}
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', hs.dot)} />

                {/* Fahrer + Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold truncate">{driverName}</span>
                    {tour.zone && (
                      <span className="text-[9px] font-bold rounded-full bg-muted px-1.5 py-0.5 border">
                        {tour.zone}
                      </span>
                    )}
                    <span className="text-[9px] font-medium text-muted-foreground">{stateLabel}</span>
                  </div>
                  {nextStop && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {nextStop.address ?? nextStop.order?.bestellnummer ?? 'Nächster Stopp'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ETA + Stop-Count */}
                <div className="shrink-0 text-right space-y-0.5">
                  {nextStop?.order?.eta_latest && (
                    <div className={cn('text-[11px] font-black tabular-nums', hs.text)}>
                      {formatEta(nextStop.order.eta_latest)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 justify-end">
                    <Package className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {openStops.length}/{tour.stop_count ?? tour.stops.length}
                    </span>
                  </div>
                </div>

                {/* Score */}
                {tour.dispatch_score !== null && (
                  <div className="shrink-0 text-center w-8">
                    <div className={cn('text-[11px] font-black tabular-nums',
                      tour.dispatch_score >= 70 ? 'text-matcha-600' : tour.dispatch_score >= 40 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {Math.round(tour.dispatch_score)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">Score</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Keine Touren */}
          {!loading && active.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" />
              Keine aktiven Lieferungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
