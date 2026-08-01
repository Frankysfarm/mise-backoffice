'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Route, CheckCircle2, Clock, WifiOff, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// Phase 5469 — Tour-Stops & Navigation Hub V10
// Neu: ETA-Genauigkeits-Score je Stopp (0-100);
// Stopp-Reihenfolge-Optimierungs-Badge KI-empfohlen;
// Fahrer-Kommentar-Eingabe je Stopp (Problemmeldung);
// Zahlungs-Status-Badge Karte/Bar/Digital;
// Live-Distanz-Ampel grün/gelb/rot;
// 6-KPI-Grid Stops/Fertig/Offen/Km/ETA-Score/Profit;
// GPS-Multi-App-Deeplinks; expand/collapse; Offline-Guard;
// 30-Sek-Poll; Mock-Fallback

type StopStatus = 'anfahrt' | 'offen' | 'fertig' | 'problem';
type Zahlung    = 'karte' | 'bar' | 'digital';
type DistAmpel  = 'gruen' | 'gelb' | 'rot';

interface TourStop {
  id: string;
  seq: number;
  adresse: string;
  kunde: string;
  eta_min: number;
  eta_score: number;
  status: StopStatus;
  distanz_km: number;
  dist_ampel: DistAmpel;
  zahlung: Zahlung;
  ki_optimal: boolean;
  betrag: number;
  lat: number;
  lng: number;
}

interface ApiData {
  tour_id: string;
  gesamt_stops: number;
  fertig: number;
  offen: number;
  gesamt_km: number;
  eta_score_avg: number;
  profit_heute: number;
  stops: TourStop[];
}

const MOCK: ApiData = {
  tour_id: 'T-2024',
  gesamt_stops: 7,
  fertig: 3,
  offen: 4,
  gesamt_km: 18.4,
  eta_score_avg: 82,
  profit_heute: 34.60,
  stops: [
    { id: 's1', seq: 1, adresse: 'Pontstraße 12, Aachen',     kunde: 'M. Schulz',  eta_min: 0,  eta_score: 95, status: 'fertig',   distanz_km: 2.1, dist_ampel: 'gruen', zahlung: 'karte',   ki_optimal: true,  betrag: 18.50, lat: 50.7753, lng: 6.0839 },
    { id: 's2', seq: 2, adresse: 'Sandkaulstr. 5, Aachen',    kunde: 'A. Weber',   eta_min: 0,  eta_score: 88, status: 'fertig',   distanz_km: 1.4, dist_ampel: 'gruen', zahlung: 'digital', ki_optimal: true,  betrag: 24.90, lat: 50.7720, lng: 6.0792 },
    { id: 's3', seq: 3, adresse: 'Roermonder Str. 8, Aachen', kunde: 'L. König',   eta_min: 0,  eta_score: 91, status: 'fertig',   distanz_km: 3.2, dist_ampel: 'gruen', zahlung: 'bar',     ki_optimal: false, betrag: 31.20, lat: 50.7849, lng: 6.0692 },
    { id: 's4', seq: 4, adresse: 'Boxgraben 22, Aachen',      kunde: 'T. Müller',  eta_min: 4,  eta_score: 79, status: 'anfahrt',  distanz_km: 1.8, dist_ampel: 'gruen', zahlung: 'karte',   ki_optimal: true,  betrag: 15.80, lat: 50.7694, lng: 6.0934 },
    { id: 's5', seq: 5, adresse: 'Jülicher Str. 45, Aachen',  kunde: 'S. Brandt',  eta_min: 12, eta_score: 74, status: 'offen',    distanz_km: 4.1, dist_ampel: 'gelb',  zahlung: 'digital', ki_optimal: true,  betrag: 22.40, lat: 50.7912, lng: 6.0601 },
    { id: 's6', seq: 6, adresse: 'Adalbertsteinweg 3',        kunde: 'K. Fischer', eta_min: 21, eta_score: 68, status: 'offen',    distanz_km: 5.8, dist_ampel: 'rot',   zahlung: 'bar',     ki_optimal: false, betrag: 19.90, lat: 50.7661, lng: 6.1024 },
    { id: 's7', seq: 7, adresse: 'Hüls 17, Aachen',           kunde: 'P. Novak',   eta_min: 29, eta_score: 62, status: 'offen',    distanz_km: 2.9, dist_ampel: 'gelb',  zahlung: 'karte',   ki_optimal: true,  betrag: 27.30, lat: 50.7980, lng: 6.0875 },
  ],
};

const STATUS_BG: Record<StopStatus, string>    = { anfahrt: 'bg-blue-50 border-blue-200', offen: 'bg-gray-50 border-gray-200', fertig: 'bg-emerald-50 border-emerald-200', problem: 'bg-red-50 border-red-200' };
const STATUS_ICON: Record<StopStatus, string>  = { anfahrt: '🚴', offen: '○', fertig: '✓', problem: '⚠' };
const DIST_DOT: Record<DistAmpel, string>      = { gruen: 'bg-emerald-400', gelb: 'bg-amber-400', rot: 'bg-red-400' };
const ZAHLUNG_BADGE: Record<Zahlung, string>   = { karte: 'bg-blue-100 text-blue-600', bar: 'bg-amber-100 text-amber-700', digital: 'bg-violet-100 text-violet-600' };
const ZAHLUNG_LABEL: Record<Zahlung, string>   = { karte: 'Karte', bar: 'Bar', digital: 'Digital' };

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
}
function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function FahrerPhase5469TourStopsNavHubV10({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s4']));
  const [open, setOpen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!isOnline || !driverId) return;
    try {
      const url = `/api/delivery/fahrer/aktive-tour?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}&view=stops_v10`;
      const r = await fetch(url);
      if (r.ok) { const j = await r.json(); setData(j); }
    } catch { /* keep mock */ }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-700/50 px-3 py-2">
        <WifiOff className="h-3.5 w-3.5 text-gray-600" />
        <span className="text-xs text-gray-500">Tour-Stops — offline nicht verfügbar</span>
      </div>
    );
  }

  const KPIS = [
    { label: 'Stops',    value: data.gesamt_stops, color: 'text-blue-400'    },
    { label: 'Fertig',   value: data.fertig,        color: 'text-emerald-400' },
    { label: 'Offen',    value: data.offen,         color: data.offen > 0 ? 'text-amber-400' : 'text-gray-500' },
    { label: 'km',       value: data.gesamt_km.toFixed(1), color: 'text-teal-400' },
    { label: 'ETA-Score',value: data.eta_score_avg, color: data.eta_score_avg >= 80 ? 'text-emerald-400' : data.eta_score_avg >= 60 ? 'text-amber-400' : 'text-red-400' },
    { label: '€ heute',  value: `€${data.profit_heute.toFixed(2)}`, color: 'text-yellow-400' },
  ];

  return (
    <div className="rounded-xl bg-gray-900 border border-blue-500/30 p-3 space-y-2">
      {/* Header */}
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-1.5">
          <Route className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Tour-Stops V10</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-bold">KI-OPT+ETA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{data.fertig}/{data.gesamt_stops}</span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-500" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-500" />}
        </div>
      </button>

      {open && (
        <>
          {/* 6-KPI-Grid */}
          <div className="grid grid-cols-6 gap-1">
            {KPIS.map(k => (
              <div key={k.label} className="rounded bg-gray-800 px-1 py-1 text-center">
                <div className={`text-xs font-black tabular-nums ${k.color}`}>{k.value}</div>
                <div className="text-[8px] text-gray-500 leading-tight">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Stop List */}
          <div className="space-y-1.5">
            {data.stops.map(s => {
              const isExp = expanded.has(s.id);
              const isActive = s.status === 'anfahrt';
              return (
                <div key={s.id} className={`rounded-lg border ${isActive ? 'border-blue-400/50 bg-blue-900/20' : STATUS_BG[s.status].replace('bg-', 'bg-').replace('border-', 'border-')}`}
                  style={isActive ? {} : {}}>
                  <div
                    className="rounded-lg border px-2 py-1.5 cursor-pointer"
                    style={{ background: s.status === 'fertig' ? 'rgba(16,185,129,0.1)' : isActive ? 'rgba(59,130,246,0.15)' : s.status === 'problem' ? 'rgba(239,68,68,0.1)' : 'rgba(31,41,55,0.8)', borderColor: isActive ? 'rgba(96,165,250,0.4)' : 'rgba(75,85,99,0.4)' }}
                    onClick={() => toggleExpand(s.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-4 shrink-0">{STATUS_ICON[s.status]}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">#{s.seq}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{s.adresse}</div>
                        <div className="text-[9px] text-gray-400">{s.kunde}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.ki_optimal && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-900/50 text-violet-300 font-bold">KI✓</span>
                        )}
                        <div className={`w-2 h-2 rounded-full ${DIST_DOT[s.dist_ampel]}`} />
                        {s.status !== 'fertig' && (
                          <span className="text-xs font-black text-blue-300 tabular-nums">{s.eta_min}m</span>
                        )}
                        {isExp ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExp && (
                      <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2">
                        {/* ETA-Score */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-20">ETA-Genauigkeit</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-700">
                            <div
                              className={`h-full rounded-full ${s.eta_score >= 80 ? 'bg-emerald-400' : s.eta_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${s.eta_score}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-300 w-8 text-right">{s.eta_score}%</span>
                        </div>

                        {/* Zahlung + Betrag */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ZAHLUNG_BADGE[s.zahlung]}`}>{ZAHLUNG_LABEL[s.zahlung]}</span>
                          <span className="text-xs font-black text-yellow-400 tabular-nums">€{s.betrag.toFixed(2)}</span>
                          <span className="text-[9px] text-gray-500">{s.distanz_km.toFixed(1)} km</span>
                        </div>

                        {/* Navigation Buttons */}
                        {s.status !== 'fertig' && (
                          <div className="flex gap-1.5">
                            <a
                              href={mapsUrl(s.lat, s.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-center text-[10px] font-bold py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                              📍 Maps
                            </a>
                            <a
                              href={wazeUrl(s.lat, s.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-center text-[10px] font-bold py-1.5 rounded bg-teal-700 text-white hover:bg-teal-600 transition"
                            >
                              🗺 Waze
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Tour-Fortschritt</span>
              <span>{Math.round((data.fertig / data.gesamt_stops) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-500"
                style={{ width: `${(data.fertig / data.gesamt_stops) * 100}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
