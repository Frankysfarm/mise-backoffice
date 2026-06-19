'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, Map, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

type Stop = {
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  geliefert_am?: string | null;
  reihenfolge: number;
};

type NavApp = 'google' | 'waze' | 'apple';

function wazeUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  if (address) {
    return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  }
  return '#';
}

function googleUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://maps.google.com/maps?daddr=${lat},${lng}`;
  }
  if (address) {
    return `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  }
  return '#';
}

function appleUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
  if (address) {
    return `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
  }
  return '#';
}

function multiStopGoogleUrl(stops: Stop[]): string {
  const pending = stops.filter(s => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (pending.length === 0) return '#';
  if (pending.length === 1) return googleUrl(pending[0].kunde_lat, pending[0].kunde_lng, pending[0].kunde_adresse);
  const last = pending[pending.length - 1];
  const waypoints = pending.slice(0, -1).map(s => {
    if (s.kunde_lat != null && s.kunde_lng != null) return `${s.kunde_lat},${s.kunde_lng}`;
    return encodeURIComponent([s.kunde_adresse, s.kunde_plz].filter(Boolean).join(', '));
  });
  const dest = last.kunde_lat != null && last.kunde_lng != null
    ? `${last.kunde_lat},${last.kunde_lng}`
    : encodeURIComponent([last.kunde_adresse, last.kunde_plz].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints.join('|')}&travelmode=bicycling`;
}

function multiStopWazeUrl(stops: Stop[]): string {
  const pending = stops.filter(s => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (pending.length === 0) return '#';
  // Waze doesn't support multi-stop directly, navigate to first stop
  const first = pending[0];
  return wazeUrl(first.kunde_lat, first.kunde_lng, first.kunde_adresse);
}

interface Props {
  stops: Stop[];
  nextStop?: Stop | null;
  compact?: boolean;
}

const NAV_APPS: { key: NavApp; label: string; icon: string; description: string }[] = [
  { key: 'google', label: 'Google Maps', icon: '🗺️', description: 'Multi-Stop, Fahrrad-Route' },
  { key: 'waze', label: 'Waze', icon: '🚗', description: 'Echtzeit-Verkehr, Stau-Warnung' },
  { key: 'apple', label: 'Apple Maps', icon: '🍎', description: 'Optimiert für iPhone' },
];

export function TourWazeNav({ stops, nextStop, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [preferredApp, setPreferredApp] = useState<NavApp>('google');

  const pendingStops = stops.filter(s => !s.geliefert_am);
  const multiStop = pendingStops.length > 1;

  function getUrl(app: NavApp, multi: boolean): string {
    if (multi) {
      if (app === 'google' || app === 'apple') return multiStopGoogleUrl(stops);
      return multiStopWazeUrl(stops);
    }
    const stop = nextStop ?? pendingStops[0];
    if (!stop) return '#';
    if (app === 'google') return googleUrl(stop.kunde_lat, stop.kunde_lng, [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(', '));
    if (app === 'waze') return wazeUrl(stop.kunde_lat, stop.kunde_lng, [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(', '));
    return appleUrl(stop.kunde_lat, stop.kunde_lng, [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(', '));
  }

  if (compact) {
    return (
      <div className="flex gap-2">
        <a
          href={getUrl(preferredApp, false)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-accent text-matcha-900 font-black text-sm active:scale-[0.98] transition"
        >
          <Navigation className="h-4 w-4" />
          {NAV_APPS.find(a => a.key === preferredApp)?.icon} Navigation
        </a>
        <button
          onClick={() => setExpanded(v => !v)}
          className="h-10 w-10 rounded-xl bg-matcha-800 border border-matcha-700/50 text-matcha-300 flex items-center justify-center active:scale-[0.98] transition"
        >
          <Map className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main nav button */}
      <a
        href={getUrl(preferredApp, multiStop)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 h-11 w-full rounded-xl bg-accent text-matcha-900 font-black text-sm active:scale-[0.98] transition"
      >
        <Navigation className="h-4 w-4" />
        {NAV_APPS.find(a => a.key === preferredApp)?.icon}
        {multiStop
          ? `Alle ${pendingStops.length} Stopps navigieren`
          : 'Zum Ziel navigieren'}
      </a>

      {/* App switcher */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-matcha-800/60 border border-matcha-700/30 text-matcha-400 text-[11px] hover:bg-matcha-800 transition"
      >
        <span className="flex items-center gap-1.5">
          <Map className="h-3 w-3" />
          Navi-App wechseln · {NAV_APPS.find(a => a.key === preferredApp)?.label}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="rounded-xl border border-matcha-700/40 bg-matcha-900/60 divide-y divide-matcha-800/50 overflow-hidden">
          {NAV_APPS.map(app => (
            <div key={app.key} className="flex items-center gap-3 px-3 py-2.5">
              <button
                onClick={() => { setPreferredApp(app.key); setExpanded(false); }}
                className={cn(
                  'flex-1 flex items-start gap-2 text-left',
                  preferredApp === app.key && 'opacity-70',
                )}
              >
                <span className="text-base leading-none mt-0.5">{app.icon}</span>
                <div>
                  <div className="text-[12px] font-bold text-matcha-200">{app.label}</div>
                  <div className="text-[10px] text-matcha-500">{app.description}</div>
                </div>
                {preferredApp === app.key && (
                  <span className="ml-auto text-[9px] font-bold text-accent border border-accent/40 rounded-full px-1.5 py-0.5">Aktiv</span>
                )}
              </button>
              <a
                href={getUrl(app.key, false)}
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-matcha-800 border border-matcha-700/50 text-matcha-400 hover:text-matcha-200 transition active:scale-[0.97]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}

          {multiStop && (
            <div className="px-3 py-2 bg-matcha-900/80">
              <div className="text-[10px] text-matcha-500 mb-1.5">Multi-Stop Route ({pendingStops.length} Stopps):</div>
              <div className="flex gap-1.5">
                <a
                  href={multiStopGoogleUrl(stops)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[11px] font-bold active:scale-[0.97] transition"
                >
                  🗺️ Google (alle Stopps)
                </a>
                <a
                  href={multiStopWazeUrl(stops)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold active:scale-[0.97] transition"
                >
                  🚗 Waze (1. Stopp)
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
