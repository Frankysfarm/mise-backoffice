'use client';

// Phase 5164 — Dynamische ETA Live-Tracking V9 (Storefront)
// Nutzt /api/delivery/tracking/[bestellnummer] (Phase 107)
// ETA-Countdown-Hero mit Sekundentick; Fahrer-Annäherungs-Balken mit Puls-Dot;
// Phasen-Timeline 5-stufig animiert; Fast-da-Alert; Geliefert-Celebration;
// 20-Sek-Polling + Sekundentick; Mock-Fallback

import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Navigation2, Phone, Star, Zap } from 'lucide-react';

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
}

const MOCK: ApiResponse = {
  order_id: 'mock-v9',
  bestellnummer: '#1042',
  status: 'unterwegs',
  eta_label: '8–12 Min',
  eta_earliest: null,
  eta_latest: null,
  stops_before: 0,
  driver: { lat: null, lng: null, heading: null, speed_kmh: 18, seconds_stale: 5 },
  driver_name: 'Kai B.',
  fahrer_fahrzeug: 'E-Bike',
  kunde_name: null,
  gesamtbetrag: null,
  geo: { distance_m: 1200, almost_there: false, eta_min_remaining: 9, bearing_deg: null },
};

const PHASEN_ORDER = ['neu', 'bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];
const PHASEN_LABEL: Record<string, string> = {
  neu:             'Bestellt',
  bestaetigt:      'Bestätigt',
  in_zubereitung:  'In Zubereitung',
  fertig:          'Abholbereit',
  unterwegs:       'Unterwegs',
  geliefert:       'Geliefert',
};
const PHASEN_ICON: Record<string, string> = {
  neu:             '📋',
  bestaetigt:      '✅',
  in_zubereitung:  '👨‍🍳',
  fertig:          '📦',
  unterwegs:       '🚲',
  geliefert:       '🎉',
};

function phaseIndex(status: string): number {
  const idx = PHASEN_ORDER.indexOf(status);
  return idx === -1 ? 1 : idx;
}

function DistanceBar({ distanceM, almostThere }: { distanceM: number | null; almostThere: boolean }) {
  const maxM = 3000;
  const pct = distanceM != null ? Math.max(0, Math.min(100, 100 - (distanceM / maxM) * 100)) : 0;
  const color = almostThere ? 'bg-green-500' : 'bg-matcha-500';

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-500">Startpunkt</span>
        <span className={`text-[10px] font-semibold ${almostThere ? 'text-green-400' : 'text-gray-400'}`}>
          {distanceM != null ? `${(distanceM / 1000).toFixed(1)} km entfernt` : 'Unterwegs'}
        </span>
        <span className="text-[10px] text-gray-500">Dein Standort</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className={`absolute top-0 h-full transition-all duration-1000 flex items-center`}
          style={{ left: `calc(${pct}% - 6px)` }}
        >
          <span className={`w-3 h-3 rounded-full ${almostThere ? 'bg-green-400 animate-pulse' : 'bg-matcha-400 animate-pulse'} shadow-lg`} />
        </div>
      </div>
    </div>
  );
}

function PhasenTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = phaseIndex(currentStatus);
  const visiblePhasen = ['bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

  return (
    <div className="flex items-center gap-0 mt-3">
      {visiblePhasen.map((ph, i) => {
        const phIdx = phaseIndex(ph);
        const done = phIdx < currentIdx;
        const aktiv = phIdx === currentIdx;
        const future = phIdx > currentIdx;
        return (
          <div key={ph} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                done ? 'bg-green-700 text-green-100' :
                aktiv ? 'bg-matcha-600 text-white ring-2 ring-matcha-400 ring-offset-1 ring-offset-gray-900' :
                'bg-gray-800 text-gray-600'
              } ${aktiv ? 'animate-pulse' : ''}`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : PHASEN_ICON[ph]}
              </div>
              <span className={`text-[8px] text-center mt-0.5 leading-tight max-w-[48px] truncate ${
                done ? 'text-green-500' : aktiv ? 'text-matcha-300 font-semibold' : 'text-gray-600'
              }`}>
                {PHASEN_LABEL[ph]}
              </span>
            </div>
            {i < visiblePhasen.length - 1 && (
              <div className={`flex-1 h-0.5 mx-0.5 mb-4 ${done ? 'bg-green-700' : 'bg-gray-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarRating({ onRate }: { onRate: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  return (
    <div className="flex items-center gap-1 justify-center mt-3">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => { setSelected(n); onRate(n); }}
          className="p-1"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              n <= (hovered || selected) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function Phase5164DynamischeEtaLiveTrackingV9({
  bestellnummer,
}: {
  bestellnummer: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [secs, setSecs] = useState(0);
  const [rated, setRated] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!bestellnummer) { setData(MOCK); setUseMock(true); return; }
    try {
      const res = await fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`);
      if (!res.ok) { setData(MOCK); setUseMock(true); return; }
      const d: ApiResponse = await res.json();
      setData(d);
      setUseMock(false);
      if (d.status === 'geliefert') setShowRating(true);
    } catch {
      setData(MOCK);
      setUseMock(true);
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20 * 1000);
    tickRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellnummer]);

  if (!data) return null;

  const etaMin = data.geo.eta_min_remaining;
  const distanceM = data.geo.distance_m;
  const almostThere = data.geo.almost_there;
  const delivered = data.status === 'geliefert';

  const etaColor =
    etaMin == null ? 'text-gray-300' :
    etaMin <= 3    ? 'text-red-400' :
    etaMin <= 8    ? 'text-yellow-400' :
                     'text-green-400';

  if (delivered) {
    return (
      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 px-5 py-6 text-center mb-3">
        <div className="text-5xl mb-2">🎉</div>
        <div className="text-lg font-bold text-white mb-1">Bestellung geliefert!</div>
        <div className="text-sm text-gray-400 mb-4">Guten Appetit!</div>
        {!rated && showRating && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Wie war deine Lieferung?</div>
            <StarRating onRate={() => setRated(true)} />
          </div>
        )}
        {rated && <div className="text-sm text-yellow-400 font-semibold mt-2">Danke für deine Bewertung!</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-matcha-700/50 bg-matcha-950/20 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-900/30 border-b border-matcha-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-matcha-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-200">Live-Tracking</span>
          {useMock && (
            <span className="text-[9px] text-gray-600 bg-gray-800/60 px-1.5 py-0.5 rounded">Demo</span>
          )}
        </div>
        {almostThere && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full animate-pulse">
            <Zap className="w-3 h-3" />Fast da!
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        {/* ETA Hero */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wider">Ankunft in ca.</div>
            <div className={`text-4xl font-black tabular-nums ${etaColor}`}>
              {etaMin != null ? etaMin : '–'}
              <span className="text-lg font-semibold text-gray-500 ml-1">Min</span>
            </div>
            {data.eta_label && (
              <div className="text-[10px] text-gray-500 mt-0.5">{data.eta_label}</div>
            )}
          </div>

          {data.driver_name && (
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-2 text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <Navigation2 className="w-3 h-3 text-matcha-400" />
                <span className="text-xs font-bold text-gray-200">{data.driver_name}</span>
              </div>
              {data.fahrer_fahrzeug && (
                <span className="text-[10px] text-gray-500">{data.fahrer_fahrzeug}</span>
              )}
              {data.driver?.speed_kmh != null && (
                <div className="text-[10px] text-matcha-400 mt-0.5">{Math.round(data.driver.speed_kmh)} km/h</div>
              )}
            </div>
          )}
        </div>

        {/* Distance bar */}
        {distanceM != null && (
          <DistanceBar distanceM={distanceM} almostThere={almostThere} />
        )}

        {/* Stops before */}
        {data.stops_before != null && data.stops_before > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-900/20 rounded-lg px-2.5 py-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>{data.stops_before} {data.stops_before === 1 ? 'Stopp' : 'Stopps'} vor deiner Lieferung</span>
          </div>
        )}

        {/* Phasen-Timeline */}
        <PhasenTimeline currentStatus={data.status} />

        {/* Staleness indicator */}
        {data.driver?.seconds_stale != null && data.driver.seconds_stale > 30 && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
            <Clock className="w-3 h-3" />
            <span>Position vor {data.driver.seconds_stale}s aktualisiert</span>
          </div>
        )}
      </div>
    </div>
  );
}
