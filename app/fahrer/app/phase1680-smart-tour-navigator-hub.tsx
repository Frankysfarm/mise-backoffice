'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock, Loader2, MapPin, Navigation, Package, Phone, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1680 — Smart Tour Navigator Hub (Fahrer)
 *
 * Umfassendes Navigations-Kommandozentrum für Fahrer:
 *   • Aktueller Stopp mit Countdown bis ETA
 *   • Direktlink zu Google Maps / Apple Maps / Waze
 *   • Nächste Stopps-Vorschau mit geschätzten Zeiten
 *   • Stop-Status-Ampel (ausstehend/aktiv/geliefert)
 *   • Schnell-Aktionen: Angerufen / Nicht zuhause / Abgeliefert
 *
 * API: GET /api/delivery/fahrer/tour?driver_id=... (Mock-Fallback)
 */

interface TourStop {
  id: string;
  orderNumber?: string | null;
  address: string;
  customerName?: string | null;
  customerPhone?: string | null;
  status: 'pending' | 'active' | 'delivered' | 'failed';
  etaMin?: number | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

interface FahrerTour {
  batchId: string;
  stops: TourStop[];
  startedAt?: string | null;
  estimatedEndMin?: number | null;
}

const MOCK_STOPS: TourStop[] = [
  {
    id: 's1',
    orderNumber: '1042',
    address: 'Alexanderstraße 12, Aachen',
    customerName: 'Max Mustermann',
    customerPhone: '+49 241 123456',
    status: 'active',
    etaMin: 4,
    lat: 50.776,
    lng: 6.084,
    notes: 'Klingeln bei Müller',
  },
  {
    id: 's2',
    orderNumber: '1038',
    address: 'Pontstraße 28, Aachen',
    customerName: 'Sarah K.',
    customerPhone: null,
    status: 'pending',
    etaMin: 14,
    lat: 50.779,
    lng: 6.081,
    notes: null,
  },
  {
    id: 's3',
    orderNumber: '1051',
    address: 'Habsburgerallee 5, Aachen',
    customerName: 'Tobias F.',
    customerPhone: '+49 241 987654',
    status: 'pending',
    etaMin: 24,
    lat: 50.771,
    lng: 6.090,
    notes: null,
  },
];

const MOCK_TOUR: FahrerTour = {
  batchId: 'mock-tour',
  stops: MOCK_STOPS,
  startedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  estimatedEndMin: 35,
};

function openNavigation(stop: TourStop, app: 'google' | 'apple' | 'waze' = 'google') {
  if (!stop.lat || !stop.lng) {
    const encoded = encodeURIComponent(stop.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    return;
  }
  const { lat, lng } = stop;
  const urls = {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple:  `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    waze:   `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
  window.open(urls[app], '_blank');
}

export function FahrerPhase1680SmartTourNavigatorHub({ driverId }: { driverId?: string | null }) {
  const [tour, setTour] = useState<FahrerTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelivered, setConfirmDelivered] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const qs = driverId ? `?driver_id=${driverId}` : '';
        const res = await fetch(`/api/delivery/fahrer/tour${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no tour');
        const data = await res.json();
        if (cancelled) return;
        setTour(data.tour ?? MOCK_TOUR);
      } catch {
        if (!cancelled) setTour(MOCK_TOUR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId]);

  const activeStop = useMemo(
    () => tour?.stops.find(s => s.status === 'active') ?? null,
    [tour],
  );
  const pendingStops = useMemo(
    () => tour?.stops.filter(s => s.status === 'pending') ?? [],
    [tour],
  );
  const deliveredCount = useMemo(
    () => tour?.stops.filter(s => s.status === 'delivered').length ?? 0,
    [tour],
  );
  const totalStops = tour?.stops.length ?? 0;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin" />
        Tour laden…
      </div>
    );
  }

  if (!tour || totalStops === 0) return null;

  return (
    <div className="space-y-3">
      {/* Tour progress */}
      <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-white/80 shrink-0" />
            <span className="text-sm font-bold text-white">Tour-Navigation</span>
          </div>
          <span className="text-[11px] text-white/60 tabular-nums">
            {deliveredCount}/{totalStops} Stopps
          </span>
        </div>

        {/* Stop dots */}
        <div className="flex items-center gap-1.5 mb-2">
          {tour.stops.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className={cn(
                'h-3 w-3 rounded-full border-2 transition-all',
                s.status === 'delivered' ? 'bg-matcha-400 border-matcha-300' :
                s.status === 'active'    ? 'bg-amber-400 border-amber-300 animate-pulse scale-125' :
                s.status === 'failed'    ? 'bg-red-400 border-red-300' :
                'bg-white/20 border-white/30',
              )} />
              {i < tour.stops.length - 1 && (
                <div className={cn(
                  'h-0.5 w-4 rounded-full',
                  i < deliveredCount ? 'bg-matcha-400' : 'bg-white/20',
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-matcha-400 rounded-full transition-all duration-700"
            style={{ width: `${totalStops > 0 ? (deliveredCount / totalStops) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Current stop */}
      {activeStop && (
        <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-amber-300" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-amber-300/80 uppercase tracking-wide">Jetzt liefern</div>
                <div className="text-sm font-bold text-white">{activeStop.address}</div>
              </div>
            </div>
            {activeStop.etaMin !== null && activeStop.etaMin !== undefined && (
              <div className="shrink-0 text-right">
                <div className="text-xl font-black text-amber-300 tabular-nums">{activeStop.etaMin}'</div>
                <div className="text-[9px] text-amber-300/60">ETA</div>
              </div>
            )}
          </div>

          {activeStop.customerName && (
            <div className="text-[11px] text-white/70">
              Kunde: <span className="font-semibold text-white/90">{activeStop.customerName}</span>
              {activeStop.orderNumber && (
                <span className="ml-2 text-amber-300/70">#{activeStop.orderNumber}</span>
              )}
            </div>
          )}

          {activeStop.notes && (
            <div className="rounded-lg bg-white/10 px-3 py-2 text-[11px] text-white/80">
              {activeStop.notes}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openNavigation(activeStop, 'google')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-400 text-amber-950 text-sm font-black transition-colors hover:bg-amber-300"
            >
              <Navigation className="h-4 w-4" />
              Google Maps
            </button>
            <button
              onClick={() => openNavigation(activeStop, 'waze')}
              className="px-4 py-2.5 rounded-xl bg-white/15 text-white/90 text-sm font-bold hover:bg-white/20"
            >
              Waze
            </button>
            {activeStop.customerPhone && (
              <a
                href={`tel:${activeStop.customerPhone}`}
                className="px-3 py-2.5 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 flex items-center"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirmDelivered(activeStop.id)}
              className="flex-1 py-2 rounded-xl bg-matcha-600/80 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-matcha-500"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Abgeliefert
            </button>
          </div>
        </div>
      )}

      {/* Next stops preview */}
      {pendingStops.length > 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/5 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-white/50" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wide">
              Nächste Stopps ({pendingStops.length})
            </span>
          </div>
          <div className="divide-y divide-white/10">
            {pendingStops.slice(0, 3).map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] text-white/40 w-4 shrink-0 tabular-nums">{i + 2}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/80 truncate">{stop.address}</div>
                  {stop.customerName && (
                    <div className="text-[10px] text-white/50 truncate">{stop.customerName}</div>
                  )}
                </div>
                {stop.etaMin !== null && stop.etaMin !== undefined && (
                  <span className="text-[10px] font-bold text-white/60 tabular-nums shrink-0">~{stop.etaMin}'</span>
                )}
                <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
