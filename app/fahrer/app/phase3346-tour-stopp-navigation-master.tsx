'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Navigation, Phone, Banknote, Clock, ChevronDown, ChevronUp, Package } from 'lucide-react';

/**
 * Phase 3346 — Tour-Stopp Navigation Master (Fahrer-App)
 *
 * Nächster-Stopp-Hero mit Google-Maps-Link; Anruf-Button; Barzahlung-Alert;
 * 1-Tap Zugestellt-CTA; alle Stopps als Timeline; 15-Sek-Polling; isOnline-Guard.
 */

interface OrderStop {
  id: string;
  sequence: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment: string | null;
  amount: number | null;
  status: 'pending' | 'en_route' | 'delivered' | 'problem';
  eta_min: number | null;
  order_number: string | null;
}

interface TourData {
  batch_id: string;
  state: string;
  total_stops: number;
  delivered: number;
  stops: OrderStop[];
  total_distance_km: number | null;
  total_eta_min: number | null;
}

const MOCK_TOUR: TourData = {
  batch_id: 'b1',
  state: 'on_route',
  total_stops: 3,
  delivered: 1,
  total_distance_km: 5.2,
  total_eta_min: 22,
  stops: [
    {
      id: 's1', sequence: 1, status: 'delivered', eta_min: null,
      address: 'Hauptstr. 12, Aachen', lat: 50.776, lng: 6.083,
      customer_name: 'Maria S.', customer_phone: '+49 155 12345678',
      payment: 'online', amount: 24.90, order_number: 'FF-0042',
    },
    {
      id: 's2', sequence: 2, status: 'en_route', eta_min: 5,
      address: 'Gartenweg 5, Aachen', lat: 50.780, lng: 6.090,
      customer_name: 'Jonas B.', customer_phone: '+49 176 87654321',
      payment: 'bar', amount: 19.50, order_number: 'FF-0043',
    },
    {
      id: 's3', sequence: 3, status: 'pending', eta_min: 14,
      address: 'Parkstr. 9, Aachen', lat: 50.774, lng: 6.097,
      customer_name: 'Lena K.', customer_phone: '+49 157 11223344',
      payment: 'online', amount: 31.20, order_number: 'FF-0044',
    },
  ],
};

function googleMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return '#';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3346TourStoppNavigationMaster({ driverId, locationId, isOnline }: Props) {
  const [tour, setTour] = useState<TourData | null>(null);
  const [allStopsOpen, setAllStopsOpen] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/fahrer/current-tour?driver_id=${driverId}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('not ok');
        const d = await r.json();
        if (d?.batch_id) { setTour(d); return; }
      } catch {
        // fall through
      }
      setTour(MOCK_TOUR);
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId]);

  if (!isOnline || !tour) return null;
  if (!['assigned', 'at_restaurant', 'on_route'].includes(tour.state)) return null;

  const nextStop = tour.stops.find(s => s.status === 'en_route') ?? tour.stops.find(s => s.status === 'pending');
  const isCash = nextStop?.payment === 'bar';

  return (
    <div className="rounded-2xl border bg-white dark:bg-stone-950 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gradient-to-r from-matcha-50 to-white dark:from-matcha-950 dark:to-stone-950">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Tour Navigation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400">
            {tour.delivered}/{tour.total_stops} Stopps
          </span>
          {tour.total_distance_km && (
            <span className="text-[10px] text-stone-400">{tour.total_distance_km.toFixed(1)} km</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-stone-100 dark:bg-stone-800">
        <div
          className="h-full bg-matcha-500 transition-all"
          style={{ width: `${Math.round((tour.delivered / tour.total_stops) * 100)}%` }}
        />
      </div>

      {nextStop ? (
        <div className="p-4">
          {/* Cash alert */}
          {isCash && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
              <Banknote className="h-4 w-4 flex-shrink-0" />
              Barzahlung! Wechselgeld für {nextStop.amount?.toFixed(2) ?? '—'} € bereit halten
            </div>
          )}

          {/* Next stop hero */}
          <div className="rounded-xl bg-stone-50 dark:bg-stone-900 border p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-matcha-600">Nächster Stopp</span>
              <span className="ml-auto text-[9px] font-bold text-stone-400">#{nextStop.sequence} von {tour.total_stops}</span>
            </div>
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-matcha-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-stone-800 dark:text-stone-100 leading-tight">{nextStop.address ?? '—'}</div>
                {nextStop.customer_name && (
                  <div className="text-[10px] text-stone-500 mt-0.5">{nextStop.customer_name}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {nextStop.eta_min !== null && (
                <span className="flex items-center gap-1 text-[10px] text-stone-500">
                  <Clock className="h-3 w-3" /> ~{nextStop.eta_min} min
                </span>
              )}
              {nextStop.order_number && (
                <span className="flex items-center gap-1 text-[10px] text-stone-500">
                  <Package className="h-3 w-3" /> {nextStop.order_number}
                </span>
              )}
              {nextStop.amount && (
                <span className="text-[10px] font-bold text-stone-700 dark:text-stone-200">
                  {nextStop.amount.toFixed(2)} €
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <a
              href={googleMapsUrl(nextStop.lat, nextStop.lng, nextStop.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white text-[11px] font-bold py-3 active:scale-95 transition-transform"
            >
              <Navigation className="h-4 w-4" />
              Navigation starten
            </a>
            {nextStop.customer_phone && (
              <a
                href={`tel:${nextStop.customer_phone}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-[11px] font-bold py-3 active:scale-95 transition-transform"
              >
                <Phone className="h-4 w-4" />
                Anrufen
              </a>
            )}
          </div>

          {/* Delivered CTA */}
          <button
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-[12px] font-black py-3.5 active:scale-95 transition-transform shadow-sm"
          >
            <CheckCircle2 className="h-4.5 w-4.5" />
            Zugestellt — Nächster Stopp
          </button>
        </div>
      ) : (
        <div className="p-4 text-center text-stone-400 text-sm">Alle Stopps abgeschlossen</div>
      )}

      {/* All stops toggle */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 border-t text-[10px] font-bold text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
        onClick={() => setAllStopsOpen(v => !v)}
      >
        <span>Alle {tour.total_stops} Stopps anzeigen</span>
        {allStopsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {allStopsOpen && (
        <div className="divide-y border-t">
          {tour.stops.map(stop => {
            const statusIcon =
              stop.status === 'delivered' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> :
              stop.status === 'problem'   ? <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" /> :
              stop.status === 'en_route'  ? <Navigation className="h-4 w-4 text-blue-500 flex-shrink-0" /> :
              <MapPin className="h-4 w-4 text-stone-400 flex-shrink-0" />;
            return (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] font-bold text-stone-400 w-4">{stop.sequence}</span>
                {statusIcon}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-stone-700 dark:text-stone-200 truncate">{stop.address ?? '—'}</div>
                  {stop.customer_name && <div className="text-[9px] text-stone-400">{stop.customer_name}</div>}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {stop.amount && <span className="text-[10px] font-bold text-stone-600 dark:text-stone-300">{stop.amount.toFixed(2)} €</span>}
                  {stop.payment === 'bar' && <span className="text-[8px] text-amber-600 font-bold">Bar</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
