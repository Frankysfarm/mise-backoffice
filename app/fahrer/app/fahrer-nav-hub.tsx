'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, Navigation2, Package } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  driverPos: { lat: number; lng: number } | null;
  onArrived?: (stopId: string) => void;
  onDelivered?: (stopId: string) => void;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_LABELS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatEta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function StopBadge({ stop, isCurrent, distKm }: { stop: Stop; isCurrent: boolean; distKm: number | null }) {
  const done = !!stop.geliefert_am;
  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all',
      done ? 'opacity-50' : isCurrent ? 'bg-matcha-900 text-matcha-50' : 'bg-matcha-800/60 text-matcha-200',
    )}>
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
        done ? 'bg-green-500/30 text-green-400' : isCurrent ? 'bg-[#4AE68A] text-matcha-900' : 'bg-matcha-700 text-matcha-300',
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : stop.reihenfolge}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{stop.order.kunde_name}</div>
        <div className="text-[10px] opacity-70 truncate">
          {[stop.order.kunde_adresse, stop.order.kunde_plz].filter(Boolean).join(', ')}
        </div>
      </div>
      {distKm !== null && isCurrent && !done && (
        <div className="text-xs font-bold text-[#4AE68A] shrink-0">{formatDist(distKm)}</div>
      )}
      {done && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
    </div>
  );
}

export function FahrerNavHub({ stops, driverPos, onArrived, onDelivered }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(iv);
  }, []);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find(s => !s.geliefert_am);
  const completedCount = sorted.filter(s => !!s.geliefert_am).length;
  const totalCount = sorted.length;

  if (!nextStop) {
    return (
      <div className="rounded-2xl bg-matcha-900 border border-matcha-700 p-5 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-[#4AE68A] mx-auto" />
        <div className="text-matcha-50 font-bold text-lg">Tour abgeschlossen!</div>
        <div className="text-matcha-400 text-sm">{totalCount} von {totalCount} Stops geliefert</div>
      </div>
    );
  }

  const order = nextStop.order;
  const hasCoords = driverPos !== null && order.kunde_lat !== null && order.kunde_lng !== null;

  let distKm: number | null = null;
  let deg: number | null = null;
  let compassLabel: string | null = null;
  let isNear = false;

  if (hasCoords && driverPos && order.kunde_lat !== null && order.kunde_lng !== null) {
    distKm = haversineKm(driverPos.lat, driverPos.lng, order.kunde_lat, order.kunde_lng);
    deg = bearing(driverPos.lat, driverPos.lng, order.kunde_lat, order.kunde_lng);
    compassLabel = COMPASS_LABELS[Math.round(deg / 45) % 8];
    isNear = distKm < 0.12;
  }

  const address = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');
  const mapsUrl = order.kunde_lat !== null && order.kunde_lng !== null
    ? `https://maps.google.com/maps?daddr=${order.kunde_lat},${order.kunde_lng}`
    : `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  const wazeUrl = order.kunde_lat !== null && order.kunde_lng !== null
    ? `https://waze.com/ul?ll=${order.kunde_lat},${order.kunde_lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;

  // ETA countdown
  let etaText: string | null = null;
  let etaRemainMin: number | null = null;
  if (order.eta_earliest) {
    const etaMs = new Date(order.eta_earliest).getTime() - now;
    etaRemainMin = Math.ceil(etaMs / 60_000);
    etaText = formatEta(order.eta_earliest);
  }

  return (
    <div className="space-y-3">
      {/* Main nav card */}
      <div className="rounded-2xl bg-matcha-900 border border-matcha-700 overflow-hidden">
        {/* Progress strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-matcha-700">
          <Navigation2 className="h-4 w-4 text-[#4AE68A] shrink-0" />
          <span className="text-matcha-300 text-xs font-bold flex-1">Stop {nextStop.reihenfolge} von {totalCount}</span>
          <div className="flex gap-1">
            {sorted.map(s => (
              <div
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  s.geliefert_am ? 'bg-[#4AE68A] w-4' : s.id === nextStop.id ? 'bg-[#4AE68A] w-4 animate-pulse' : 'bg-matcha-700 w-2',
                )}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer + urgency */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-matcha-50 font-black text-lg leading-tight truncate">{order.kunde_name}</div>
              <div className="text-matcha-400 text-xs mt-0.5 truncate">{address}</div>
              <div className="text-matcha-300 text-[11px] mt-1">
                #{order.bestellnummer} · {euro(order.gesamtbetrag)}
                {order.zahlungsart && (
                  <span className={cn(
                    'ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold',
                    order.bezahlt ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400',
                  )}>
                    {order.bezahlt ? 'Bezahlt' : order.zahlungsart?.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            {isNear && (
              <div className="shrink-0 bg-green-500/20 border border-green-500/30 rounded-xl px-2.5 py-1.5 text-center">
                <div className="text-green-400 font-black text-xs animate-pulse">Fast da!</div>
              </div>
            )}
          </div>

          {/* Distance + compass */}
          {hasCoords && distKm !== null && deg !== null && (
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black text-matcha-50 tabular-nums">{formatDist(distKm)}</div>
              <div className="flex flex-col items-center gap-0.5">
                <div style={{ transform: `rotate(${deg}deg)` }} className="transition-transform duration-500">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-[#4AE68A]">
                    <path d="M12 2L8 20l4-3 4 3z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-matcha-400">{compassLabel}</span>
              </div>
              {etaRemainMin !== null && (
                <div className="ml-auto text-right">
                  <div className={cn(
                    'text-lg font-black tabular-nums',
                    etaRemainMin < 0 ? 'text-red-400' : etaRemainMin < 3 ? 'text-amber-400' : 'text-[#4AE68A]',
                  )}>
                    {etaRemainMin < 0 ? `+${Math.abs(etaRemainMin)}` : etaRemainMin} Min
                  </div>
                  <div className="text-[10px] text-matcha-500">ETA {etaText}</div>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#4AE68A] text-matcha-900 font-bold text-sm py-3 px-3 active:scale-95 transition-transform"
            >
              <Navigation className="h-4 w-4" />
              Google Maps
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-700 text-matcha-100 font-bold text-sm py-3 px-3 active:scale-95 transition-transform"
            >
              <MapPin className="h-4 w-4" />
              Waze
            </a>
          </div>

          {/* Action buttons */}
          {onArrived && !nextStop.angekommen_am && (
            <button
              onClick={() => onArrived(nextStop.id)}
              className="w-full rounded-xl border border-matcha-600 text-matcha-200 text-sm font-bold py-2.5 flex items-center justify-center gap-2 hover:bg-matcha-800 active:scale-95 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Angekommen
            </button>
          )}
          {onDelivered && nextStop.angekommen_am && !nextStop.geliefert_am && (
            <button
              onClick={() => onDelivered(nextStop.id)}
              className="w-full rounded-xl bg-[#4AE68A] text-matcha-900 text-sm font-black py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Package className="h-4 w-4" />
              Geliefert bestätigen
            </button>
          )}
        </div>
      </div>

      {/* Stop list */}
      {sorted.length > 1 && (
        <div className="rounded-2xl bg-matcha-900 border border-matcha-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-700">
            <Package className="h-4 w-4 text-matcha-400" />
            <span className="text-matcha-300 text-xs font-bold">Alle Stops ({completedCount}/{totalCount})</span>
          </div>
          <div className="p-2 space-y-1">
            {sorted.map(s => (
              <StopBadge
                key={s.id}
                stop={s}
                isCurrent={s.id === nextStop.id}
                distKm={s.id === nextStop.id ? distKm : null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
