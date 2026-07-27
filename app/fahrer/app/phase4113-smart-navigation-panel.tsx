'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, ExternalLink, MapPin, Clock, Route } from 'lucide-react';

interface NavApp { name: string; schema: string; icon: string; verfuegbar: boolean; }
interface ApiData { naechste_adresse: string; lat: number; lng: number; eta_min: number; distanz_km: number; route_hinweis: string; nav_apps: NavApp[]; verkehr_level: 'leicht' | 'mittel' | 'schwer'; }

const NAV_APPS: NavApp[] = [
  { name: 'Google Maps', schema: 'https://www.google.com/maps/dir/?api=1&destination=', icon: '🗺', verfuegbar: true },
  { name: 'Waze', schema: 'https://waze.com/ul?navigate=yes&ll=', icon: '🔵', verfuegbar: true },
  { name: 'Apple Maps', schema: 'maps://maps.apple.com/?daddr=', icon: '🍎', verfuegbar: false },
];

const MOCK: ApiData = {
  naechste_adresse: 'Jülicher Str. 77, 52070 Aachen',
  lat: 50.7726,
  lng: 6.0927,
  eta_min: 6,
  distanz_km: 2.4,
  route_hinweis: 'Über Adalbertsteinweg — Baustelle Theaterstr. vermeiden.',
  nav_apps: NAV_APPS,
  verkehr_level: 'mittel',
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4113SmartNavigationPanel({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/smart-nav?driver_id=${driverId}&location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const buildNavUrl = (app: NavApp) => {
    if (app.name === 'Google Maps') return `${app.schema}${encodeURIComponent(data.naechste_adresse)}`;
    if (app.name === 'Waze') return `${app.schema}${data.lat},${data.lng}`;
    return `${app.schema}${encodeURIComponent(data.naechste_adresse)}`;
  };

  const verkehrConfig = {
    leicht: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Leichter Verkehr' },
    mittel: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Mittlerer Verkehr' },
    schwer: { color: 'text-red-600', bg: 'bg-red-50', label: 'Schwerer Stau' },
  };
  const vk = verkehrConfig[data.verkehr_level];

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
        Navigation offline nicht verfügbar
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Smart Navigation</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="bg-blue-50 rounded-xl p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm font-semibold text-blue-800">{data.naechste_adresse}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-blue-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{data.eta_min} min</span>
          <span className="flex items-center gap-1"><Route className="w-3 h-3" />{data.distanz_km} km</span>
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${vk.bg} ${vk.color}`}>{vk.label}</span>
        </div>
      </div>

      {data.route_hinweis && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <span className="text-[11px] text-amber-700">💡 {data.route_hinweis}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {data.nav_apps.filter(a => a.verfuegbar).map(app => (
          <a key={app.name} href={buildNavUrl(app)} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors active:scale-95">
            <span className="text-2xl">{app.icon}</span>
            <span className="text-[10px] text-gray-600 font-medium">{app.name.replace(' Maps', '')}</span>
            <ExternalLink className="w-2.5 h-2.5 text-gray-400" />
          </a>
        ))}
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        30-Sek-Polling · Echtzeit-Verkehr · Tippen öffnet Nav-App
      </div>
    </div>
  );
}
