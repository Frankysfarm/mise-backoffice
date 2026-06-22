'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, Map, X } from 'lucide-react';

interface NaviAppWahlProps {
  lat: number | null;
  lng: number | null;
  adresse: string | null;
  onClose?: () => void;
  compact?: boolean;
}

function buildGoogleMapsUrl(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (adresse) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  return '#';
}

function buildAppleMapsUrl(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  if (adresse) return `maps://maps.apple.com/?q=${encodeURIComponent(adresse)}`;
  return '#';
}

function buildWazeUrl(lat: number | null, lng: number | null): string {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return '#';
}

function buildHereMapsUrl(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) return `https://share.here.com/r/${lat},${lng}`;
  if (adresse) return `https://share.here.com/l/${encodeURIComponent(adresse)}`;
  return '#';
}

const APPS = [
  {
    id: 'google',
    label: 'Google Maps',
    icon: '🗺️',
    color: 'bg-blue-500/15 border-blue-400/30 text-blue-200 active:bg-blue-500/30',
    buildUrl: (lat: number | null, lng: number | null, adresse: string | null) => buildGoogleMapsUrl(lat, lng, adresse),
  },
  {
    id: 'waze',
    label: 'Waze',
    icon: '🚗',
    color: 'bg-teal-500/15 border-teal-400/30 text-teal-200 active:bg-teal-500/30',
    buildUrl: (lat: number | null, lng: number | null) => buildWazeUrl(lat, lng),
  },
  {
    id: 'apple',
    label: 'Apple Maps',
    icon: '🍎',
    color: 'bg-gray-500/15 border-gray-400/30 text-gray-200 active:bg-gray-500/30',
    buildUrl: (lat: number | null, lng: number | null, adresse: string | null) => buildAppleMapsUrl(lat, lng, adresse),
    iosOnly: true,
  },
  {
    id: 'here',
    label: 'HERE Maps',
    icon: '📍',
    color: 'bg-red-500/15 border-red-400/30 text-red-200 active:bg-red-500/30',
    buildUrl: (lat: number | null, lng: number | null, adresse: string | null) => buildHereMapsUrl(lat, lng, adresse),
  },
] as const;

export function NaviAppWahl({ lat, lng, adresse, onClose, compact = false }: NaviAppWahlProps) {
  const [launched, setLaunched] = useState<string | null>(null);

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const availableApps = APPS.filter((app) => !('iosOnly' in app && app.iosOnly && !isIOS));

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {availableApps.map((app) => {
          const url = app.buildUrl(lat, lng, adresse);
          return (
            <a
              key={app.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setLaunched(app.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all active:scale-95',
                app.color,
                launched === app.id && 'opacity-60',
              )}
            >
              <span>{app.icon}</span>
              {app.label}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-matcha-600/40 bg-matcha-800/80 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-accent" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-matcha-300">
            Navigation starten
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-matcha-700/50 text-matcha-400">
            <X size={14} />
          </button>
        )}
      </div>

      {adresse && (
        <div className="mb-3 flex items-start gap-2 text-sm text-matcha-200 bg-matcha-900/50 rounded-xl px-3 py-2">
          <Map size={12} className="mt-0.5 shrink-0 text-accent" />
          <span className="leading-snug">{adresse}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {availableApps.map((app) => {
          const url = app.buildUrl(lat, lng, adresse);
          return (
            <a
              key={app.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setLaunched(app.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-all active:scale-95',
                app.color,
                launched === app.id && 'opacity-50',
              )}
            >
              <span className="text-xl leading-none">{app.icon}</span>
              <span>{app.label}</span>
            </a>
          );
        })}
      </div>

      {!lat && !lng && !adresse && (
        <p className="text-[11px] text-matcha-400 text-center mt-2">
          Kein Standort verfügbar
        </p>
      )}
    </div>
  );
}
