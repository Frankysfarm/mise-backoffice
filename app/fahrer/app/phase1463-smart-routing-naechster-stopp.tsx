'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation2, Clock, Phone, TrendingDown, Zap } from 'lucide-react';

interface RouteOption {
  label: string;
  eta_min: number;
  distance_km: number;
  via: string;
  recommended: boolean;
}

interface StopData {
  stop_sequence: number;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  eta_min: number | null;
  route_options: RouteOption[];
  time_saving_min: number;
}

const MOCK: StopData = {
  stop_sequence: 2,
  address: 'Musterstraße 12, 52062 Aachen',
  customer_name: 'Maria S.',
  customer_phone: '+49 160 1234567',
  notes: 'Hinterhof, Klingel links',
  lat: 50.7753,
  lng: 6.0839,
  eta_min: 8,
  route_options: [
    { label: 'Schnellste Route', eta_min: 8,  distance_km: 2.4, via: 'B1 / Trierer Str.', recommended: true  },
    { label: 'Kürzeste Strecke', eta_min: 11, distance_km: 1.9, via: 'Altstadt',          recommended: false },
  ],
  time_saving_min: 3,
};

interface Props {
  driverId: string;
  isOnline: boolean;
  activeBatchId?: string | null;
  stopSequence?: number;
}

export function FahrerPhase1463SmartRoutingNaechsterStopp({ driverId, isOnline, activeBatchId, stopSequence }: Props) {
  const [data, setData] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<number>(0);

  const load = useCallback(async () => {
    if (!isOnline || !activeBatchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/fahrer/smart-routing?driver_id=${driverId}&batch_id=${activeBatchId}&seq=${stopSequence ?? 1}`
      );
      if (res.ok) {
        const json = await res.json();
        if (!json.error) setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline, activeBatchId, stopSequence]);

  useEffect(() => {
    if (isOnline && activeBatchId) {
      load();
    } else {
      setData(MOCK);
    }
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, isOnline, activeBatchId]);

  const stop = data ?? MOCK;
  const chosenRoute = stop.route_options[selectedRoute] ?? stop.route_options[0];

  function openNavigation() {
    if (!stop.lat || !stop.lng) {
      window.open(`https://maps.google.com/maps?q=${encodeURIComponent(stop.address)}`, '_blank');
      return;
    }
    window.open(`https://maps.google.com/maps?daddr=${stop.lat},${stop.lng}`, '_blank');
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-800">Nächster Stopp #{stop.stop_sequence}</span>
        </div>
        {loading && (
          <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
        )}
        {stop.eta_min !== null && (
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
            <Clock className="w-3 h-3" /> {stop.eta_min} min
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Address */}
        <div>
          <p className="text-xs font-semibold text-gray-900 leading-snug">{stop.address}</p>
          {stop.notes && (
            <p className="text-[10px] text-amber-600 mt-0.5">📝 {stop.notes}</p>
          )}
        </div>

        {/* Customer Info */}
        {(stop.customer_name || stop.customer_phone) && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{stop.customer_name}</span>
            {stop.customer_phone && (
              <a
                href={`tel:${stop.customer_phone}`}
                className="flex items-center gap-1 text-[10px] text-blue-600 font-medium"
              >
                <Phone className="w-3 h-3" /> Anrufen
              </a>
            )}
          </div>
        )}

        {/* Route Options */}
        {stop.route_options.length > 1 && (
          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">Route wählen</p>
            {stop.route_options.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedRoute(i)}
                className={`w-full text-left rounded-lg border px-2 py-1.5 transition-all ${
                  selectedRoute === i
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-800 flex items-center gap-1">
                    {r.recommended && <Zap className="w-3 h-3 text-amber-500" />}
                    {r.label}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">{r.eta_min} min</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">{r.distance_km} km · via {r.via}</p>
              </button>
            ))}
          </div>
        )}

        {/* Time saving chip */}
        {stop.time_saving_min > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
            <TrendingDown className="w-3 h-3" />
            Empfohlene Route spart {stop.time_saving_min} min
          </div>
        )}

        {/* Navigation CTA */}
        <button
          onClick={openNavigation}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
        >
          <Navigation2 className="w-4 h-4" />
          Navigation starten
          {chosenRoute && <span className="text-xs font-normal opacity-80">· {chosenRoute.eta_min} min</span>}
        </button>
      </div>

      {/* Footer note */}
      <p className="text-[8px] text-gray-300 text-center pb-1">
        {/* API: /api/delivery/fahrer/smart-routing */}
      </p>
    </div>
  );
}
