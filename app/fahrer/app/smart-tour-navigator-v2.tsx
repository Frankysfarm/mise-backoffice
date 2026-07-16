'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronRight, Clock, MapPin, Navigation, Package,
  Phone, Star, TrendingUp, Zap,
} from 'lucide-react';

interface TourStop {
  id: string;
  index: number;
  address: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: 'pending' | 'arrived' | 'delivered' | 'failed';
  eta_min?: number | null;
  distance_km?: number | null;
  order_id?: string | null;
  bestellnummer?: string | null;
  betrag?: number | null;
  payment_method?: 'cash' | 'card' | 'online';
  notes?: string | null;
}

interface Props {
  stops?: TourStop[];
  tourId?: string | null;
  driverName?: string | null;
  onStopComplete?: (stopId: string) => void;
  onNavigate?: (stop: TourStop) => void;
}

const MOCK_STOPS: TourStop[] = [
  {
    id: 's1',
    index: 1,
    address: 'Hauptstr. 12, 52062 Aachen',
    customer_name: 'Martina S.',
    customer_phone: '+49 1511 234567',
    status: 'delivered',
    eta_min: 0,
    distance_km: 0,
    bestellnummer: 'A-1042',
    betrag: 18.9,
    payment_method: 'online',
  },
  {
    id: 's2',
    index: 2,
    address: 'Pontstr. 47, 52062 Aachen',
    customer_name: 'Thomas K.',
    customer_phone: '+49 1522 345678',
    status: 'arrived',
    eta_min: 0,
    distance_km: 0.4,
    bestellnummer: 'A-1043',
    betrag: 24.5,
    payment_method: 'cash',
    notes: 'Klingel 2. OG links',
  },
  {
    id: 's3',
    index: 3,
    address: 'Boxgraben 99, 52064 Aachen',
    customer_name: 'Lisa M.',
    status: 'pending',
    eta_min: 12,
    distance_km: 2.1,
    bestellnummer: 'A-1044',
    betrag: 31.8,
    payment_method: 'card',
  },
  {
    id: 's4',
    index: 4,
    address: 'Junkersdorf 5, 50858 Köln',
    customer_name: 'Stefan R.',
    status: 'pending',
    eta_min: 28,
    distance_km: 4.7,
    bestellnummer: 'A-1045',
    betrag: 15.2,
    payment_method: 'online',
  },
];

function paymentLabel(m?: string | null) {
  if (m === 'cash') return 'Bar';
  if (m === 'card') return 'EC-Karte';
  return 'Online';
}

function paymentColor(m?: string | null) {
  if (m === 'cash') return 'bg-amber-100 text-amber-700';
  if (m === 'card') return 'bg-blue-100 text-blue-700';
  return 'bg-matcha-100 text-matcha-700';
}

export function SmartTourNavigatorV2({ stops: propStops, tourId, driverName, onStopComplete, onNavigate }: Props) {
  const [stops, setStops] = useState<TourStop[]>(propStops ?? MOCK_STOPS);

  useEffect(() => {
    if (propStops && propStops.length > 0) setStops(propStops);
  }, [propStops]);

  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const total = stops.length;
  const nextStop = stops.find((s) => s.status === 'pending' || s.status === 'arrived');
  const progressPct = total > 0 ? (delivered / total) * 100 : 0;

  function handleMarkDelivered(stopId: string) {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, status: 'delivered' } : s)),
    );
    onStopComplete?.(stopId);
  }

  function openMaps(stop: TourStop) {
    const query = encodeURIComponent(stop.address);
    const url = `https://maps.google.com/?q=${query}`;
    window.open(url, '_blank');
    onNavigate?.(stop);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-matcha-600 text-white">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-white/80" />
          <span className="font-bold text-sm">Smart Tour Navigator</span>
          {driverName && <span className="text-white/70 text-xs">· {driverName}</span>}
        </div>
        <div className="text-sm font-bold">
          {delivered}/{total} Stopps
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-matcha-100 overflow-hidden">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Next stop highlight */}
      {nextStop && (
        <div className="border-b border-stone-100 bg-saffron/8 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-saffron mb-1">
            Nächster Stopp
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-char text-sm">{nextStop.customer_name ?? 'Kunde'}</div>
              <div className="text-xs text-stone-500 mt-0.5">{nextStop.address}</div>
              {nextStop.notes && (
                <div className="text-xs text-amber-700 mt-1 italic">{nextStop.notes}</div>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {nextStop.eta_min !== null && nextStop.eta_min !== undefined && nextStop.eta_min > 0 && (
                  <span className="flex items-center gap-1 text-xs text-stone-500">
                    <Clock className="h-3 w-3" />
                    ca. {nextStop.eta_min} Min
                  </span>
                )}
                {nextStop.distance_km !== null && nextStop.distance_km !== undefined && nextStop.distance_km > 0 && (
                  <span className="flex items-center gap-1 text-xs text-stone-500">
                    <MapPin className="h-3 w-3" />
                    {nextStop.distance_km.toFixed(1)} km
                  </span>
                )}
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', paymentColor(nextStop.payment_method))}>
                  {paymentLabel(nextStop.payment_method)}
                  {nextStop.betrag && ` · ${nextStop.betrag.toFixed(2)} €`}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => openMaps(nextStop)}
                className="flex items-center gap-1.5 rounded-xl bg-saffron text-white px-3 py-2 text-xs font-bold shadow-sm hover:bg-saffron-dark transition"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navi
              </button>
              {nextStop.customer_phone && (
                <a
                  href={`tel:${nextStop.customer_phone}`}
                  className="flex items-center gap-1.5 rounded-xl bg-stone-100 text-stone-700 px-3 py-2 text-xs font-bold hover:bg-stone-200 transition"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Anruf
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All stops */}
      <div className="divide-y divide-stone-100">
        {stops.map((stop) => {
          const isDone = stop.status === 'delivered';
          const isActive = stop.status === 'arrived';

          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                isDone && 'opacity-50',
                isActive && 'bg-saffron/5',
              )}
            >
              {/* Index / check */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  isDone ? 'bg-matcha-500 text-white' : isActive ? 'bg-saffron text-white' : 'bg-stone-100 text-stone-600',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  stop.index
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-char truncate">
                    {stop.customer_name ?? 'Kunde'}
                  </span>
                  <span className="text-[10px] text-stone-400 tabular-nums">#{stop.bestellnummer}</span>
                  {stop.betrag && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', paymentColor(stop.payment_method))}>
                      {stop.betrag.toFixed(2)} €
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-500 truncate mt-0.5">{stop.address}</div>
              </div>

              {/* Actions */}
              {!isDone && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {stop.status !== 'arrived' && (
                    <button
                      onClick={() => openMaps(stop)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-saffron hover:text-white transition"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleMarkDelivered(stop.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 hover:bg-matcha-500 hover:text-white transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      {delivered === total && total > 0 && (
        <div className="flex items-center justify-center gap-2 border-t border-stone-100 bg-matcha-50 px-4 py-3 text-sm font-bold text-matcha-700">
          <Star className="h-4 w-4 text-saffron" />
          Tour abgeschlossen! Alle {total} Stopps beliefert.
        </div>
      )}
    </div>
  );
}
