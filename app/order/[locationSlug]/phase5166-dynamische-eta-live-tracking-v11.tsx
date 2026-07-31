'use client';

// Phase 5166 — Dynamische ETA Live-Tracking V11 (Storefront)
// Neu gegenüber V10: Schritt-für-Schritt Status-Timeline; Wetter-Einfluss-Hinweis;
// Fahrer-Bewertungs-Snippet nach Lieferung; Fortschritts-Pulse-Ring;
// Stop-Count-Countdown; verbessertes Delay-Alert-UI

import { useEffect, useRef, useState } from 'react';
import {
  Bike, CheckCircle2, Clock, MapPin, Navigation2, Phone, Star,
  Zap, AlertTriangle, Gauge, Package, Thermometer, MessageSquare,
} from 'lucide-react';

interface DriverInfo {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed_kmh: number | null;
  seconds_stale: number | null;
}

interface GeoInfo {
  distance_m: number | null;
  almost_there: boolean;
  eta_min_remaining: number | null;
  bearing_deg: number | null;
}

interface ApiResponse {
  order_id: string;
  bestellnummer: string;
  status: string;
  eta_label: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  stops_before: number | null;
  driver: DriverInfo | null;
  driver_name: string | null;
  driver_rating: number | null;
  fahrer_fahrzeug: string | null;
  kunde_name: string | null;
  gesamtbetrag: number | null;
  geo: GeoInfo;
  is_delayed?: boolean;
  delay_min?: number | null;
  wetter_einfluss?: string | null;
}

const MOCK: ApiResponse = {
  order_id: 'mock-v11',
  bestellnummer: '#1052',
  status: 'unterwegs',
  eta_label: '6–10 Min',
  eta_earliest: null,
  eta_latest: null,
  stops_before: 1,
  driver_name: 'Julia F.',
  driver_rating: 4.9,
  fahrer_fahrzeug: 'E-Bike',
  kunde_name: 'Marie S.',
  gesamtbetrag: 24.90,
  driver: { lat: 50.775, lng: 6.083, heading: 45, speed_kmh: 20, seconds_stale: 3 },
  geo: { distance_m: 980, almost_there: false, eta_min_remaining: 8, bearing_deg: 30 },
  is_delayed: false,
  delay_min: null,
  wetter_einfluss: null,
};

type OrderStatus = 'neu' | 'angenommen' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'abgeholt';

const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'neu',            label: 'Bestellung eingegangen', icon: <Package size={12} />  },
  { key: 'in_zubereitung', label: 'Wird zubereitet',        icon: <Zap size={12} />      },
  { key: 'fertig',         label: 'Fertig zum Abholen',     icon: <CheckCircle2 size={12} /> },
  { key: 'unterwegs',      label: 'Unterwegs zu dir',       icon: <Bike size={12} />     },
  { key: 'geliefert',      label: 'Geliefert!',             icon: <CheckCircle2 size={12} /> },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

function vehicleIcon(fz: string | null): string {
  if (!fz) return '🚴';
  const f = fz.toLowerCase();
  if (f.includes('e-bike')) return '⚡';
  if (f.includes('motorrad')) return '🏍️';
  if (f.includes('auto')) return '🚗';
  return '🚴';
}

function fmtDist(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function StorefrontPhase5166DynamischeEtaLiveTrackingV11({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus?: string;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState(false);
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const res = await fetch(`/api/delivery/tracking/${orderId}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j);
      setError(false);
    } else {
      setData(MOCK);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    pollRef.current = setInterval(load, 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const d = data ?? { ...MOCK, status: initialStatus ?? 'unterwegs' };
  const stepIdx = getStepIndex(d.status);
  const isDelivered = d.status === 'geliefert' || d.status === 'abgeholt';
  const isUnderway = d.status === 'unterwegs';
  const etaMin = d.geo?.eta_min_remaining;
  const almostThere = d.geo?.almost_there;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden text-sm">
      {/* Mock-Indicator */}
      {error && (
        <div className="px-4 py-1 bg-amber-50 border-b border-amber-200">
          <p className="text-xs text-amber-600">Demo-Ansicht</p>
        </div>
      )}

      {/* Celebration für "Geliefert" */}
      {isDelivered && (
        <div className="px-4 pt-5 pb-3 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="font-bold text-green-700 text-lg">Guten Appetit!</p>
          <p className="text-gray-500 text-xs mt-1">Deine Bestellung {d.bestellnummer} wurde geliefert.</p>

          {/* Bewertungs-Snippet */}
          {!rated && d.driver_name && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-2">Wie war dein Fahrer <strong>{d.driver_name}</strong>?</p>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => { setRating(n); setRated(true); }}
                    className="text-2xl hover:scale-110 transition-transform"
                  >
                    {n <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {rated && (
            <p className="mt-3 text-green-600 text-xs font-medium flex items-center justify-center gap-1">
              <CheckCircle2 size={12} /> Danke für deine Bewertung!
            </p>
          )}
        </div>
      )}

      {/* Active Tracking */}
      {!isDelivered && (
        <>
          {/* ETA Header */}
          <div className="px-4 pt-4 pb-3 text-center">
            {/* Pulse Ring */}
            <div className="relative inline-flex items-center justify-center mb-3">
              <div className="w-20 h-20 rounded-full border-4 border-indigo-100 flex items-center justify-center">
                {isUnderway && <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping" />}
                <div className="text-2xl">{vehicleIcon(d.fahrer_fahrzeug)}</div>
              </div>
            </div>

            <p className="text-gray-500 text-xs mb-0.5">Voraussichtliche Lieferung</p>
            <p className="font-bold text-2xl text-gray-900">
              {almostThere ? 'Gleich da!' : (d.eta_label ?? `${etaMin} Min`)}
            </p>

            {/* Delay Alert */}
            {d.is_delayed && d.delay_min && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1">
                <AlertTriangle size={12} className="text-orange-500" />
                <span className="text-xs text-orange-700">Ca. {d.delay_min} Min später als geplant</span>
              </div>
            )}

            {/* Wetter-Hinweis */}
            {d.wetter_einfluss && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600">
                <Thermometer size={11} /> {d.wetter_einfluss}
              </div>
            )}
          </div>

          {/* Driver Info */}
          {d.driver_name && (
            <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                {d.driver_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{d.driver_name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {d.fahrer_fahrzeug && <span>{vehicleIcon(d.fahrer_fahrzeug)} {d.fahrer_fahrzeug}</span>}
                  {d.driver_rating && (
                    <span className="flex items-center gap-0.5">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" /> {d.driver_rating.toFixed(1)}
                    </span>
                  )}
                  {d.driver?.speed_kmh && (
                    <span className="flex items-center gap-0.5">
                      <Gauge size={10} /> {d.driver.speed_kmh} km/h
                    </span>
                  )}
                </div>
              </div>
              {d.geo?.distance_m && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 flex items-center gap-0.5 justify-end">
                    <Navigation2 size={10} /> {fmtDist(d.geo.distance_m)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stop-Count */}
          {d.stops_before !== null && d.stops_before > 0 && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <MapPin size={12} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-700">
                {d.stops_before} {d.stops_before === 1 ? 'Lieferung' : 'Lieferungen'} vor dir
              </span>
            </div>
          )}
          {d.stops_before === 0 && isUnderway && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <Zap size={12} className="text-green-600 flex-shrink-0" />
              <span className="text-xs text-green-700 font-medium">Du bist die nächste Lieferung!</span>
            </div>
          )}
        </>
      )}

      {/* Status-Timeline */}
      <div className="px-4 pb-4">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-3.5 top-3 bottom-3 w-px bg-gray-200" />
          <div className="space-y-3">
            {STATUS_STEPS.map((step, i) => {
              const done   = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={step.key} className="flex items-center gap-3 relative">
                  <div className={`z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-100 text-gray-400'}`}>
                    {done ? <CheckCircle2 size={14} /> : step.icon}
                  </div>
                  <span className={`text-sm ${done ? 'text-green-600' : active ? 'text-indigo-700 font-semibold' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                  {active && (
                    <span className="ml-auto text-xs text-indigo-500 font-medium animate-pulse">Aktiv</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
