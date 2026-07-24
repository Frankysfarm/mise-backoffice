'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navigation, MapPin, Clock, Phone, CheckCircle2, ChevronDown, ChevronUp, Zap, Route, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1001 — Tour-Stopp Navigation Hub (Fahrer-App)
 * Vollständige Tour-Stops-Liste mit ETA-Ring; Direktnavigation Google Maps/Waze;
 * Aktueller-Stopp-Fokus; Stopp-Bestätigung; 5-Min-Polling; Mock-Fallback
 */

interface TourStopp {
  id: string;
  sequence: number;
  adresse: string;
  customer_name?: string;
  eta_min: number;
  distanz_km?: number;
  status: 'ausstehend' | 'aktuell' | 'abgeschlossen';
  phone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

interface ApiResponse {
  stops: TourStopp[];
  current_stop_index: number;
  tour_id: string;
  total_stops: number;
  completed_stops: number;
  estimated_finish_min: number;
}

const MOCK: ApiResponse = {
  stops: [
    { id: 's1', sequence: 1, adresse: 'Hauptstraße 12, München', customer_name: 'Maria K.', eta_min: 6, distanz_km: 1.2, status: 'aktuell', phone: '+4915112345678', notes: 'Klingeln 2x', lat: 48.137, lng: 11.575 },
    { id: 's2', sequence: 2, adresse: 'Bahnhofstr. 34, München', customer_name: 'Peter M.', eta_min: 18, distanz_km: 3.1, status: 'ausstehend', phone: '+4915198765432', lat: 48.140, lng: 11.560 },
    { id: 's3', sequence: 3, adresse: 'Goethestr. 7, München', customer_name: 'Lisa S.', eta_min: 30, distanz_km: 4.8, status: 'ausstehend', lat: 48.128, lng: 11.580 },
  ],
  current_stop_index: 0,
  tour_id: 'tour-mock',
  total_stops: 3,
  completed_stops: 0,
  estimated_finish_min: 42,
};

function EtaRing({ eta }: { eta: number }) {
  const max = 30;
  const pct = Math.min(100, (eta / max) * 100);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  const color = eta <= 5 ? '#ef4444' : eta <= 12 ? '#f59e0b' : '#10b981';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dash} style={{ transition: 'stroke-dashoffset 0.7s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-black tabular-nums leading-none" style={{ color }}>{eta}</span>
        <span className="text-[8px] text-muted-foreground">min</span>
      </div>
    </div>
  );
}

function buildNavUrl(adresse: string, lat?: number, lng?: number, app: 'google' | 'waze' = 'google'): string {
  if (app === 'waze') {
    const q = lat != null && lng != null ? `ll=${lat},${lng}` : `q=${encodeURIComponent(adresse)}`;
    return `https://waze.com/ul?${q}&navigate=yes`;
  }
  const q = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(adresse);
  return `https://maps.google.com/?q=${q}&travelmode=driving`;
}

export function FahrerPhase1001TourStoppNavigationHub({ driverId, isOnline }: { driverId: string; isOnline: boolean }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [navApp, setNavApp] = useState<'google' | 'waze'>('google');

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const currentStop = data.stops.find(s => s.status === 'aktuell');
  const pendingStops = data.stops.filter(s => s.status === 'ausstehend');
  const progressPct = data.total_stops > 0 ? Math.round((data.completed_stops / data.total_stops) * 100) : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-2">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-char">Tour-Stopp Navigator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">{data.completed_stops}/{data.total_stops} Stopps</span>
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
              <span>{progressPct}% abgeschlossen</span>
              <span>Fertig in ca. {data.estimated_finish_min}min</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Navi-App-Wahl */}
          <div className="flex gap-2">
            {(['google', 'waze'] as const).map(app => (
              <button key={app} onClick={() => setNavApp(app)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                  navApp === app ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-600 border-stone-200',
                )}>
                {app === 'google' ? 'Google Maps' : 'Waze'}
              </button>
            ))}
          </div>

          {/* Aktueller Stopp — prominent */}
          {currentStop && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
              <div className="flex items-start gap-3">
                <EtaRing eta={currentStop.eta_min} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-bold text-orange-600 uppercase">Jetzt: Stopp {currentStop.sequence}</span>
                  </div>
                  {currentStop.customer_name && (
                    <div className="text-sm font-bold text-char mt-0.5">{currentStop.customer_name}</div>
                  )}
                  <div className="text-xs text-stone-600 mt-0.5 flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-stone-400" />
                    <span>{currentStop.adresse}</span>
                  </div>
                  {currentStop.notes && (
                    <div className="text-[10px] text-orange-700 bg-orange-100 rounded px-1.5 py-0.5 mt-1 inline-block">
                      {currentStop.notes}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={buildNavUrl(currentStop.adresse, currentStop.lat, currentStop.lng, navApp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigieren
                    </a>
                    {currentStop.phone && (
                      <a href={`tel:${currentStop.phone}`}
                        className="flex items-center justify-center gap-1 bg-stone-100 text-stone-700 text-xs font-semibold py-2 px-3 rounded-lg border border-stone-200"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nächste Stopps */}
          {pendingStops.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Nächste Stopps</div>
              {pendingStops.map(s => (
                <div key={s.id}>
                  <button
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-stone-50 border border-stone-100 text-left hover:bg-stone-100 transition-colors"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {s.sequence}
                    </div>
                    <div className="flex-1 min-w-0">
                      {s.customer_name && <div className="text-xs font-semibold text-char">{s.customer_name}</div>}
                      <div className="text-[11px] text-stone-500 truncate">{s.adresse}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-stone-500 tabular-nums">{s.eta_min}min</span>
                      {expanded === s.id ? <ChevronUp className="w-3.5 h-3.5 text-stone-400" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
                    </div>
                  </button>
                  {expanded === s.id && (
                    <div className="mx-2 mb-1 p-2.5 bg-white border border-stone-100 rounded-b-lg -mt-0.5 space-y-2">
                      <div className="text-[11px] text-stone-600 flex items-start gap-1">
                        <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-stone-400" />
                        {s.adresse}
                      </div>
                      {s.distanz_km != null && <div className="text-[10px] text-stone-400">{s.distanz_km.toFixed(1)} km</div>}
                      <div className="flex gap-2">
                        <a
                          href={buildNavUrl(s.adresse, s.lat, s.lng, navApp)}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {navApp === 'google' ? 'Google Maps' : 'Waze'}
                        </a>
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-50 border border-stone-100 px-2 py-1 rounded-lg">
                            <Phone className="w-3 h-3" />
                            Anrufen
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.stops.every(s => s.status === 'abgeschlossen') && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-bold">Alle Stopps abgeschlossen!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
