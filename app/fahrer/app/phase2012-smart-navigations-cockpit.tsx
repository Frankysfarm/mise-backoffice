'use client';

import { Navigation, ExternalLink } from 'lucide-react';

/**
 * Phase 2012 — Smart-Navigations-Cockpit (Fahrer-App)
 *
 * Wähle die Navi-App direkt: Google Maps, Waze, Apple Maps.
 * Keine API-Anfrage. Nur sichtbar wenn adresse vorhanden.
 */

interface Props {
  adresse: string | null;
  isOnline: boolean;
}

interface NavApp {
  label: string;
  emoji: string;
  buildUrl: (addr: string) => string;
  bg: string;
  hoverBg: string;
}

const NAV_APPS: NavApp[] = [
  {
    label: 'Google Maps',
    emoji: '🗺️',
    buildUrl: (addr) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`,
    bg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-600 active:bg-blue-700',
  },
  {
    label: 'Waze',
    emoji: '🚗',
    buildUrl: (addr) => `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`,
    bg: 'bg-cyan-500',
    hoverBg: 'hover:bg-cyan-600 active:bg-cyan-700',
  },
  {
    label: 'Apple Maps',
    emoji: '🍎',
    buildUrl: (addr) => `maps://maps.apple.com/?daddr=${encodeURIComponent(addr)}`,
    bg: 'bg-slate-700',
    hoverBg: 'hover:bg-slate-800 active:bg-slate-900',
  },
];

export function FahrerPhase2012SmartNavigationsCockpit({ adresse, isOnline }: Props) {
  if (!adresse) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden border shadow-lg bg-gradient-to-br from-matcha-50 to-emerald-50 dark:from-matcha-950/40 dark:to-emerald-950/40 border-matcha-200 dark:border-matcha-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-500 to-emerald-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          <span className="font-bold text-sm">In Navi öffnen</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Address display */}
        <div className="flex items-start gap-2 rounded-xl bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <Navigation className="h-4 w-4 mt-0.5 shrink-0 text-matcha-500" />
          <span className="text-sm font-medium leading-snug">{adresse}</span>
        </div>

        {/* Nav app buttons */}
        <div className="space-y-2">
          {NAV_APPS.map((app) => (
            <a
              key={app.label}
              href={app.buildUrl(adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 rounded-xl ${app.bg} ${app.hoverBg} text-white px-4 py-3.5 transition-colors`}
            >
              <span className="text-xl leading-none">{app.emoji}</span>
              <span className="flex-1 font-semibold text-sm">{app.label}</span>
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
