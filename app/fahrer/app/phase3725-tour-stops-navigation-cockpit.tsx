'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, Route, ChevronDown, ChevronUp, Phone } from 'lucide-react';

interface TourStop {
  id: string;
  nr: number;
  adresse: string;
  kunde_name: string;
  telefon: string | null;
  bestellnummer: string;
  eta_min: number;
  entfernung_km: number;
  notiz: string | null;
  status: 'ausstehend' | 'anfahrt' | 'geliefert';
  bezahlung: 'bar' | 'karte' | 'bereits_bezahlt';
  betrag_eur: number;
}

interface TourInfo {
  tour_id: string;
  gesamt_stopps: number;
  erledigt: number;
  rest_km: number;
  rest_min: number;
  einnahmen_bisher: number;
}

const MOCK_STOPS: TourStop[] = [
  {
    id: 's1', nr: 1, adresse: 'Hauptstraße 12, 52062 Aachen', kunde_name: 'Max Müller',
    telefon: '+49 170 1234567', bestellnummer: 'FF-4201', eta_min: 0, entfernung_km: 0,
    notiz: null, status: 'geliefert', bezahlung: 'bereits_bezahlt', betrag_eur: 18.50,
  },
  {
    id: 's2', nr: 2, adresse: 'Pontstraße 47, 52062 Aachen', kunde_name: 'Anna Schmidt',
    telefon: '+49 151 9876543', bestellnummer: 'FF-4202', eta_min: 6, entfernung_km: 1.8,
    notiz: '3. Etage, kein Aufzug', status: 'anfahrt', bezahlung: 'karte', betrag_eur: 24.90,
  },
  {
    id: 's3', nr: 3, adresse: 'Elisenbrunnen 3, 52062 Aachen', kunde_name: 'Klaus Weber',
    telefon: null, bestellnummer: 'FF-4203', eta_min: 16, entfernung_km: 3.2,
    notiz: 'Klingeln bei "Weber/Meier"', status: 'ausstehend', bezahlung: 'bar', betrag_eur: 31.20,
  },
  {
    id: 's4', nr: 4, adresse: 'Kaiserplatz 9, 52062 Aachen', kunde_name: 'Lisa Braun',
    telefon: '+49 160 5554433', bestellnummer: 'FF-4204', eta_min: 26, entfernung_km: 5.1,
    notiz: null, status: 'ausstehend', bezahlung: 'bereits_bezahlt', betrag_eur: 15.80,
  },
];

const MOCK_TOUR: TourInfo = {
  tour_id: 'T-2024-001', gesamt_stopps: 4, erledigt: 1, rest_km: 8.3, rest_min: 32, einnahmen_bisher: 18.50,
};

const NAV_APPS = [
  { name: 'Google Maps', icon: '🗺️', scheme: (addr: string) => `https://maps.google.com/?q=${encodeURIComponent(addr)}` },
  { name: 'Waze', icon: '🚗', scheme: (addr: string) => `https://waze.com/ul?q=${encodeURIComponent(addr)}` },
  { name: 'Apple Maps', icon: '🍎', scheme: (addr: string) => `maps://maps.apple.com/?q=${encodeURIComponent(addr)}` },
];

export function FahrerPhase3725TourStopsNavigationCockpit({ fahrerSchichtId }: { fahrerSchichtId: string | null }) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [tour, setTour] = useState<TourInfo>(MOCK_TOUR);
  const [expanded, setExpanded] = useState<string | null>('s2'); // Aktueller Stopp offen
  const [navMenuId, setNavMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fahrerSchichtId) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?schicht_id=${fahrerSchichtId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.stops) setStops(d.stops);
        if (d.tour) setTour(d.tour);
      }
    } catch {
      // Mock-Fallback
    }
  }, [fahrerSchichtId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const nextStop = stops.find(s => s.status !== 'geliefert');
  const pct = tour.gesamt_stopps > 0 ? Math.round((tour.erledigt / tour.gesamt_stopps) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3 overflow-hidden">
      {/* Tour-Übersicht Header */}
      <div className="bg-gradient-to-r from-saffron/10 to-amber-50 p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-saffron" />
            <span className="font-bold text-gray-900">Tour-Stopps</span>
          </div>
          <span className="text-sm font-bold text-saffron">{tour.erledigt}/{tour.gesamt_stopps} erledigt</span>
        </div>

        {/* Fortschrittsbalken */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-saffron rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs mt-2">
          <div>
            <div className="font-bold text-gray-900">{tour.rest_km.toFixed(1)} km</div>
            <div className="text-gray-500">verbleibend</div>
          </div>
          <div>
            <div className="font-bold text-gray-900">~{tour.rest_min}min</div>
            <div className="text-gray-500">bis fertig</div>
          </div>
          <div>
            <div className="font-bold text-emerald-600">+{tour.einnahmen_bisher.toFixed(2)}€</div>
            <div className="text-gray-500">Einnahmen</div>
          </div>
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="px-3 pb-3 space-y-2">
        {stops.map(s => {
          const isExpanded = expanded === s.id;
          const isCurrent = s.status === 'anfahrt';
          const isDone = s.status === 'geliefert';

          return (
            <div key={s.id} className={`rounded-xl border overflow-hidden transition-all ${
              isCurrent ? 'border-saffron shadow-sm' :
              isDone ? 'border-gray-100 opacity-70' :
              'border-gray-200'
            }`}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpanded(isExpanded ? null : s.id)}
              >
                {/* Status-Icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  isDone ? 'bg-emerald-100' :
                  isCurrent ? 'bg-saffron/20' :
                  'bg-gray-100'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className={`text-sm font-black ${isCurrent ? 'text-saffron' : 'text-gray-500'}`}>{s.nr}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold truncate ${isCurrent ? 'text-saffron' : isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {s.kunde_name}
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 text-[10px] bg-saffron text-white px-1.5 py-0.5 rounded-full font-bold">Jetzt</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{s.adresse}</div>
                </div>

                {/* ETA / Status */}
                <div className="text-right shrink-0">
                  {isDone ? (
                    <span className="text-xs text-emerald-600 font-medium">✓ geliefert</span>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-gray-800">~{s.eta_min}min</div>
                      <div className="text-[10px] text-gray-500">{s.entfernung_km.toFixed(1)} km</div>
                    </>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1 ml-auto" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1 ml-auto" />}
                </div>
              </button>

              {/* Expandiert: Stopp-Details + Navigation */}
              {isExpanded && !isDone && (
                <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50">
                  {/* Bestellnummer & Betrag */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Bestellung: <strong className="text-gray-800">{s.bestellnummer}</strong></span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                      s.bezahlung === 'bereits_bezahlt' ? 'bg-emerald-100 text-emerald-700' :
                      s.bezahlung === 'karte' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {s.bezahlung === 'bereits_bezahlt' ? '✓ bezahlt' : s.bezahlung === 'karte' ? '💳 Karte' : `💶 Bar: ${s.betrag_eur.toFixed(2)}€`}
                    </span>
                  </div>

                  {/* Notiz */}
                  {s.notiz && (
                    <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
                      <span className="text-amber-800">{s.notiz}</span>
                    </div>
                  )}

                  {/* Aktionen */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Navigation */}
                    <div className="relative">
                      <button
                        className="w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg"
                        onClick={() => setNavMenuId(navMenuId === s.id ? null : s.id)}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Navigieren
                      </button>
                      {navMenuId === s.id && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                          {NAV_APPS.map(app => (
                            <a
                              key={app.name}
                              href={app.scheme(s.adresse)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-800 hover:bg-gray-50"
                              onClick={() => setNavMenuId(null)}
                            >
                              <span>{app.icon}</span>
                              <span>{app.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Anrufen */}
                    {s.telefon ? (
                      <a
                        href={`tel:${s.telefon}`}
                        className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-bold py-2.5 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Anrufen
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 bg-gray-50 text-gray-400 text-xs py-2.5 rounded-lg">
                        <Phone className="w-3.5 h-3.5" />
                        Kein Tel.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
