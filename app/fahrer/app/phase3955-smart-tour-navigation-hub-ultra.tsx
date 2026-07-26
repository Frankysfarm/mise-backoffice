'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, Clock, Phone, CheckCircle2, AlertTriangle, Package, ChevronDown, ChevronUp, Route } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  adresse_kurz: string;
  kunde: string;
  telefon: string | null;
  sonderwunsch: string | null;
  eta_min: number | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'verpasst';
  lat: number | null;
  lng: number | null;
  bestellnr: string;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  geliefert: number;
  score: number;
  stopps: Stopp[];
}

const MOCK: TourData = {
  tour_id: 'tour-7001',
  fahrer_name: 'Max M.',
  gesamt_stopps: 4,
  geliefert: 1,
  score: 88,
  stopps: [
    {
      id: 's1', nr: 1, adresse: 'Pontstraße 12, 52062 Aachen', adresse_kurz: 'Pontstr. 12', kunde: 'Anna B.',
      telefon: '+4924112345', sonderwunsch: null, eta_min: null, status: 'geliefert', lat: 50.7751, lng: 6.0836, bestellnr: 'FF-7101',
    },
    {
      id: 's2', nr: 2, adresse: 'Habsburgerallee 2, 52064 Aachen', adresse_kurz: 'Habsburgerallee 2', kunde: 'Lena K.',
      telefon: '+4924198765', sonderwunsch: 'Klingeln! 3. Stock links', eta_min: 7, status: 'unterwegs', lat: 50.7765, lng: 6.0921, bestellnr: 'FF-7102',
    },
    {
      id: 's3', nr: 3, adresse: 'Trierer Straße 5, 52078 Aachen', adresse_kurz: 'Trierer Str. 5', kunde: 'Tom R.',
      telefon: null, sonderwunsch: null, eta_min: 19, status: 'ausstehend', lat: 50.7812, lng: 6.0743, bestellnr: 'FF-7103',
    },
    {
      id: 's4', nr: 4, adresse: 'Jakobstraße 9, 52064 Aachen', adresse_kurz: 'Jakobstr. 9', kunde: 'Maria S.',
      telefon: '+4924155555', sonderwunsch: 'Bitte klingeln', eta_min: 31, status: 'ausstehend', lat: 50.7698, lng: 6.0889, bestellnr: 'FF-7104',
    },
  ],
};

function openMaps(lat: number, lng: number, adresse: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (typeof window !== 'undefined') window.open(url, '_blank');
}

function openWaze(lat: number, lng: number) {
  const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  if (typeof window !== 'undefined') window.open(url, '_blank');
}

export function FahrerPhase3955SmartTourNavigationHubUltra({ driverId }: { driverId: string | null }) {
  const [tour, setTour] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>('s2');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/active-tour?driver_id=${driverId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.tour) setTour(d.tour);
      }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [driverId]);

  useEffect(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id); }, [load]);

  const aktiverStopp = tour.stopps.find(s => s.status === 'unterwegs') ?? tour.stopps.find(s => s.status === 'ausstehend');
  const fortschrittPct = Math.round((tour.geliefert / Math.max(1, tour.gesamt_stopps)) * 100);

  return (
    <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            <span className="font-semibold text-sm">Tour Navigation · Ultra Hub</span>
            {loading && <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />}
          </div>
          <div className="text-right text-xs">
            <div className="font-bold">{tour.geliefert}/{tour.gesamt_stopps} Stopps</div>
            <div className="opacity-80">Score: {tour.score}</div>
          </div>
        </div>
        {/* Fortschrittsbalken */}
        <div className="mt-2 h-1.5 bg-white/30 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${fortschrittPct}%` }} />
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Aktiver Stopp Hero */}
        {aktiverStopp && (
          <div className={`rounded-xl border-2 p-3 ${aktiverStopp.status === 'unterwegs' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${aktiverStopp.status === 'unterwegs' ? 'bg-blue-500' : 'bg-slate-400'}`}>
                    {aktiverStopp.nr}
                  </div>
                  <span className="text-sm font-bold text-slate-800">{aktiverStopp.kunde}</span>
                  {aktiverStopp.status === 'unterwegs' && (
                    <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold">Jetzt</span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{aktiverStopp.adresse}</div>
                <div className="text-[10px] text-slate-400">{aktiverStopp.bestellnr}</div>
              </div>
              {aktiverStopp.eta_min != null && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600 tabular-nums">{aktiverStopp.eta_min}</div>
                  <div className="text-[10px] text-slate-500">min</div>
                </div>
              )}
            </div>

            {aktiverStopp.sonderwunsch && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-2">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700">{aktiverStopp.sonderwunsch}</span>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2">
              {aktiverStopp.lat && aktiverStopp.lng && (
                <>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white active:bg-blue-700"
                    onClick={() => openMaps(aktiverStopp.lat!, aktiverStopp.lng!, aktiverStopp.adresse)}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Google Maps
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-semibold text-white active:bg-sky-600"
                    onClick={() => openWaze(aktiverStopp.lat!, aktiverStopp.lng!)}
                  >
                    <MapPin className="h-3.5 w-3.5" /> Waze
                  </button>
                </>
              )}
              {aktiverStopp.telefon && (
                <a
                  href={`tel:${aktiverStopp.telefon}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white active:bg-emerald-600"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Alle Stopps Liste */}
        <div className="space-y-1.5">
          {tour.stopps.map((s) => {
            const isExpanded = expanded === s.id;
            const isActive = s.id === aktiverStopp?.id;

            return (
              <div
                key={s.id}
                className={`rounded-lg border cursor-pointer transition-all ${
                  s.status === 'geliefert' ? 'border-emerald-200 bg-emerald-50 opacity-70' :
                  isActive ? 'border-blue-300 bg-blue-50' :
                  'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
                onClick={() => setExpanded(isExpanded ? null : s.id)}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    s.status === 'geliefert' ? 'bg-emerald-500 text-white' :
                    s.status === 'unterwegs' ? 'bg-blue-500 text-white' :
                    s.status === 'verpasst' ? 'bg-red-500 text-white' :
                    'bg-slate-300 text-slate-600'
                  }`}>
                    {s.status === 'geliefert' ? <CheckCircle2 className="h-3 w-3" /> : s.nr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-700 truncate block">{s.adresse_kurz}</span>
                    <span className="text-[10px] text-slate-400">{s.kunde}</span>
                  </div>
                  {s.eta_min != null && s.status !== 'geliefert' && (
                    <span className="text-xs font-semibold text-blue-600 shrink-0">~{s.eta_min} min</span>
                  )}
                  {s.sonderwunsch && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="px-3 pb-2 border-t border-slate-100 pt-2 space-y-2">
                    <div className="text-xs text-slate-600">{s.adresse}</div>
                    {s.sonderwunsch && (
                      <div className="flex items-start gap-1.5 bg-amber-50 rounded px-2 py-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-amber-700">{s.sonderwunsch}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {s.lat && s.lng && (
                        <>
                          <button
                            className="flex-1 flex items-center justify-center gap-1 rounded bg-blue-500 py-1.5 text-[11px] font-semibold text-white"
                            onClick={(e) => { e.stopPropagation(); openMaps(s.lat!, s.lng!, s.adresse); }}
                          >
                            <Navigation className="h-3 w-3" /> Maps
                          </button>
                          <button
                            className="flex-1 flex items-center justify-center gap-1 rounded bg-sky-400 py-1.5 text-[11px] font-semibold text-white"
                            onClick={(e) => { e.stopPropagation(); openWaze(s.lat!, s.lng!); }}
                          >
                            <MapPin className="h-3 w-3" /> Waze
                          </button>
                        </>
                      )}
                      {s.telefon && (
                        <a
                          href={`tel:${s.telefon}`}
                          className="flex items-center justify-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
