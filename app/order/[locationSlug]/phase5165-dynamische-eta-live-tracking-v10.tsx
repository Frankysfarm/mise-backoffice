'use client';

// Phase 5165 — Dynamische ETA Live-Tracking V10 (Storefront)
// Neu gegenüber V9: Geschwindigkeits-Anzeige, Echtzeit-Distanz-Ring,
// 3D-Fortschrittsmap-Ersatz (SVG-Stripe), Fahrer-Alert bei Verspätung,
// Bewertungs-Vorschau, verbessertes Celebration-UI

import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Navigation2, Phone, Star, Zap, AlertTriangle, Gauge } from 'lucide-react';

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
  fahrer_fahrzeug: string | null;
  kunde_name: string | null;
  gesamtbetrag: number | null;
  geo: GeoInfo;
  is_delayed?: boolean;
  delay_min?: number | null;
}

const MOCK: ApiResponse = {
  order_id: 'mock-v10',
  bestellnummer: '#1042',
  status: 'unterwegs',
  eta_label: '7–11 Min',
  eta_earliest: null,
  eta_latest: null,
  stops_before: 0,
  driver_name: 'Kemal A.',
  fahrer_fahrzeug: 'E-Bike',
  kunde_name: 'Marie S.',
  gesamtbetrag: 24.90,
  driver: { lat: 50.775, lng: 6.083, heading: 45, speed_kmh: 18, seconds_stale: 5 },
  geo: { distance_m: 1200, almost_there: false, eta_min_remaining: 9, bearing_deg: 30 },
  is_delayed: false,
  delay_min: null,
};

const PHASES = [
  { key: 'bestaetigt',  label: 'Bestätigt' },
  { key: 'zubereitung', label: 'Zubereitung' },
  { key: 'bereit',      label: 'Bereit' },
  { key: 'unterwegs',   label: 'Unterwegs' },
  { key: 'geliefert',   label: 'Geliefert' },
] as const;

const PHASE_ORDER: Record<string, number> = {
  bestaetigt: 0, zubereitung: 1, bereit: 2, unterwegs: 3, geliefert: 4,
};

function etaColor(min: number | null): string {
  if (min == null) return 'text-gray-400';
  if (min <= 5)  return 'text-green-400';
  if (min <= 15) return 'text-yellow-400';
  return 'text-red-400';
}

function distLabel(m: number | null): string {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function Phase5165DynamischeEtaLiveTrackingV10({
  bestellnummer,
  locationId,
}: {
  bestellnummer?: string | null;
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const bn = bestellnummer ?? 'mock';
    const res = await fetch(`/api/delivery/tracking/${encodeURIComponent(bn)}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j);
      if (j.geo?.eta_min_remaining != null) setEtaSec(j.geo.eta_min_remaining * 60);
    } else {
      setData(MOCK);
      setEtaSec(MOCK.geo.eta_min_remaining != null ? MOCK.geo.eta_min_remaining * 60 : null);
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 20 * 1000);
    tickRef.current = setInterval(() => setEtaSec(s => (s != null && s > 0 ? s - 1 : s)), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellnummer, locationId]);

  if (!data) return null;

  const currentPhase = PHASE_ORDER[data.status] ?? 0;
  const etaMin = etaSec != null ? Math.ceil(etaSec / 60) : null;
  const distPct = data.geo.distance_m != null
    ? Math.max(0, Math.min(100, 100 - (data.geo.distance_m / 5000) * 100))
    : 50;

  if (data.status === 'geliefert') {
    return (
      <div className="rounded-2xl border border-green-700/60 bg-green-950/30 p-5 mb-3 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
        <div className="text-lg font-black text-green-300 mb-1">Geliefert! 🎉</div>
        <div className="text-sm text-gray-400 mb-4">Guten Appetit, {data.kunde_name ?? 'lieber Kunde'}!</div>
        <div className="flex items-center justify-center gap-1 mb-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)}>
              <Star className={`w-7 h-7 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} transition-colors`} />
            </button>
          ))}
        </div>
        {rating > 0 && <div className="text-xs text-green-400 mt-1">Danke für deine Bewertung!</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-matcha-700/60 bg-matcha-950/20 mb-3 overflow-hidden">
      <div className="px-4 py-3 border-b border-matcha-800/40 bg-matcha-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-matcha-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-200">Live-Tracking V10</span>
          <span className="text-[10px] text-gray-500">{data.bestellnummer}</span>
        </div>
        {data.is_delayed && data.delay_min && (
          <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />+{data.delay_min} Min
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        {/* ETA Hero */}
        <div className="text-center mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ankunft in</div>
          <div className={`text-5xl font-black tabular-nums mb-0.5 ${etaColor(etaMin)}`}>
            {etaMin != null ? etaMin : '—'}
          </div>
          <div className="text-sm text-gray-400">
            {etaMin != null ? 'Minuten' : (data.eta_label ?? 'berechne...')}
          </div>
        </div>

        {/* Distance Progress */}
        {data.geo.almost_there && (
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 rounded-lg px-3 py-2 mb-3">
            <Zap className="w-4 h-4 text-green-400 animate-pulse shrink-0" />
            <span className="text-xs text-green-300 font-semibold">Dein Fahrer ist fast da!</span>
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />Restaurant</span>
            <span>{distLabel(data.geo.distance_m)}</span>
            <span className="flex items-center gap-1">Du<MapPin className="w-2.5 h-2.5" /></span>
          </div>
          <div className="relative h-3 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="absolute h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${distPct}%` }}
            />
            <div
              className="absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all duration-700"
              style={{ left: `calc(${distPct}% - 4px)` }}
            />
          </div>
        </div>

        {/* Driver Card */}
        {data.driver_name && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-2.5 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-matcha-700 flex items-center justify-center text-sm font-bold text-white">
                  {data.driver_name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-200">{data.driver_name}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Bike className="w-2.5 h-2.5" />{data.fahrer_fahrzeug ?? 'Fahrrad'}
                    {data.driver?.speed_kmh != null && (
                      <span className="ml-1 flex items-center gap-0.5">
                        <Gauge className="w-2.5 h-2.5" />{Math.round(data.driver.speed_kmh)} km/h
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <a href="tel:" className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-700/50 px-2 py-1.5 rounded-lg">
                <Phone className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Phase Timeline */}
        <div className="relative">
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-700 z-0" />
          <div
            className="absolute top-3 left-3 h-0.5 bg-matcha-500 z-0 transition-all duration-700"
            style={{ width: `${(currentPhase / (PHASES.length - 1)) * 100}%` }}
          />
          <div className="relative z-10 flex justify-between">
            {PHASES.map((ph, i) => {
              const done = i <= currentPhase;
              return (
                <div key={ph.key} className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? 'bg-matcha-600 border-matcha-400' : 'bg-gray-800 border-gray-600'
                  }`}>
                    {done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-[8px] text-center leading-tight max-w-[40px] ${done ? 'text-matcha-300' : 'text-gray-600'}`}>
                    {ph.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {data.stops_before != null && data.stops_before > 0 && (
          <div className="mt-3 text-center text-[10px] text-gray-500">
            {data.stops_before} Stopp{data.stops_before > 1 ? 's' : ''} vor dir
          </div>
        )}
      </div>
    </div>
  );
}
