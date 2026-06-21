'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
  } | null;
}

interface Props {
  stops: Stop[];
  className?: string;
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

export function StopDistanzInfo({ stops, className }: Props) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const nextStop = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];

  if (!nextStop || !nextStop.order) return null;

  const { kunde_name, kunde_adresse, kunde_lat, kunde_lng } = nextStop.order;

  const distKm =
    pos && kunde_lat != null && kunde_lng != null
      ? haversineKm(pos.lat, pos.lng, kunde_lat, kunde_lng)
      : null;

  const etaMin = distKm != null ? Math.max(1, Math.round((distKm / 30) * 60)) : null;

  const urgency =
    distKm == null ? 'neutral' :
    distKm < 0.3 ? 'near' :
    distKm < 1.0 ? 'medium' :
    'far';

  const urgencyCfg = {
    near:    { ring: 'ring-matcha-400 bg-matcha-50', label: 'Fast da!',   icon: 'text-matcha-600', dot: 'bg-matcha-500' },
    medium:  { ring: 'ring-blue-300 bg-blue-50',    label: 'Unterwegs',  icon: 'text-blue-600',   dot: 'bg-blue-500' },
    far:     { ring: 'ring-amber-300 bg-amber-50',  label: 'Noch weit',  icon: 'text-amber-600',  dot: 'bg-amber-500' },
    neutral: { ring: 'ring-stone-200 bg-white',     label: 'Nächster Stopp', icon: 'text-stone-500', dot: 'bg-stone-400' },
  };

  const cfg = urgencyCfg[urgency];
  const remainingAfter = stops.filter(s => !s.geliefert_am && s.reihenfolge > nextStop.reihenfolge).length;

  return (
    <div className={cn('rounded-2xl ring-1 p-3 space-y-2', cfg.ring, className)}>
      <div className="flex items-start gap-2.5">
        <div className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0 animate-pulse', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              {cfg.label} · Stop {nextStop.reihenfolge}
            </span>
            {remainingAfter > 0 && (
              <span className="text-[9px] text-stone-400 shrink-0">+{remainingAfter} weitere</span>
            )}
          </div>
          <p className="text-sm font-bold text-stone-900 leading-tight truncate">{kunde_name}</p>
          {kunde_adresse && (
            <p className="text-[11px] text-stone-500 truncate">{kunde_adresse}</p>
          )}
        </div>
      </div>

      {(distKm != null || etaMin != null) && (
        <div className="flex items-center gap-3 pt-1 border-t border-current/10">
          {distKm != null && (
            <div className="flex items-center gap-1">
              <Navigation className={cn('h-3 w-3', cfg.icon)} />
              <span className={cn('text-xs font-black tabular-nums', cfg.icon)}>
                {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
              </span>
            </div>
          )}
          {etaMin != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-stone-400" />
              <span className="text-xs font-semibold text-stone-500">~{etaMin} Min</span>
            </div>
          )}
          {kunde_lat != null && kunde_lng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${kunde_lat},${kunde_lng}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white active:opacity-70"
            >
              <MapPin className="h-2.5 w-2.5" /> Navi
            </a>
          )}
        </div>
      )}
    </div>
  );
}
