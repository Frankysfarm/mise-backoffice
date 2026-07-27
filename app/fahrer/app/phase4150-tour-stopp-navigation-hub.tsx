'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, CheckCircle, Clock, Phone, ChevronRight, Zap, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  name: string;
  bestellnummer: string;
  eta_min: number | null;
  distanz_km: number | null;
  status: 'offen' | 'aktiv' | 'erledigt';
  telefon?: string | null;
  hinweis?: string | null;
  betrag: number;
}

interface TourData {
  tour_id: string | null;
  stopps: Stopp[];
  gesamt_stopps: number;
  erledigt_stopps: number;
  naechster_stopp: Stopp | null;
  eta_tour_ende_min: number | null;
  tour_score: number;
}

const MOCK: TourData = {
  tour_id: 'tour-001',
  gesamt_stopps: 4,
  erledigt_stopps: 1,
  tour_score: 82,
  eta_tour_ende_min: 38,
  naechster_stopp: {
    id: 's2', nr: 2, adresse: 'Pontstraße 12, 52062 Aachen', name: 'Julia R.',
    bestellnummer: '#1043', eta_min: 7, distanz_km: 2.1, status: 'aktiv',
    telefon: '+49 151 12345678', hinweis: 'Bitte klingeln: 3. OG', betrag: 18.50,
  },
  stopps: [
    { id: 's1', nr: 1, adresse: 'Elisenstraße 5, Aachen', name: 'Tom K.', bestellnummer: '#1042', eta_min: null, distanz_km: 0, status: 'erledigt', betrag: 12.00 },
    { id: 's2', nr: 2, adresse: 'Pontstraße 12, Aachen', name: 'Julia R.', bestellnummer: '#1043', eta_min: 7, distanz_km: 2.1, status: 'aktiv', telefon: '+49 151 12345678', hinweis: 'Bitte klingeln: 3. OG', betrag: 18.50 },
    { id: 's3', nr: 3, adresse: 'Kaiserplatz 3, Aachen', name: 'Mark S.', bestellnummer: '#1044', eta_min: 18, distanz_km: 3.4, status: 'offen', betrag: 24.00 },
    { id: 's4', nr: 4, adresse: 'Bismarckstraße 1, Aachen', name: 'Anna W.', bestellnummer: '#1045', eta_min: 32, distanz_km: 4.8, status: 'offen', betrag: 9.50 },
  ],
};

function openNav(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  if (/android/i.test(navigator.userAgent)) {
    window.open(`geo:0,0?q=${encoded}`, '_blank');
  } else if (/iphone|ipad/i.test(navigator.userAgent)) {
    window.open(`maps://?q=${encoded}`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?q=${encoded}`, '_blank');
  }
}

interface Props { fahrerToken?: string | null; }

export function FahrerPhase4150TourStoppNavigationHub({ fahrerToken }: Props) {
  const [data, setData] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fahrerToken) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-status?token=${fahrerToken}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock */ }
  }, [fahrerToken]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const fortschritt = data.gesamt_stopps > 0 ? (data.erledigt_stopps / data.gesamt_stopps) * 100 : 0;

  if (!data.tour_id && data.stopps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
        Keine aktive Tour
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tour-Fortschritt */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Route className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-gray-900">Tour-Fortschritt</span>
          </div>
          <span className="text-[10px] text-gray-500">{data.erledigt_stopps}/{data.gesamt_stopps} Stopps</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${fortschritt}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-gray-400">
          <span>Score: <span className={cn('font-bold', data.tour_score >= 80 ? 'text-emerald-600' : 'text-amber-600')}>{data.tour_score}</span></span>
          {data.eta_tour_ende_min && <span>Tour-Ende in ~{data.eta_tour_ende_min} min</span>}
        </div>
      </div>

      {/* Nächster Stopp — Fokus-Karte */}
      {data.naechster_stopp && (
        <div className="bg-blue-600 rounded-xl p-4 text-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-4 h-4" />
              <span className="text-xs font-bold">Nächster Stopp</span>
            </div>
            <span className="bg-blue-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
              Stopp {data.naechster_stopp.nr}
            </span>
          </div>

          <div>
            <div className="text-base font-black">{data.naechster_stopp.name}</div>
            <div className="text-blue-200 text-xs mt-0.5">{data.naechster_stopp.adresse}</div>
            {data.naechster_stopp.hinweis && (
              <div className="mt-1 bg-blue-500 rounded-lg px-2 py-1 text-[10px] text-blue-100">
                📝 {data.naechster_stopp.hinweis}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {data.naechster_stopp.eta_min !== null && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-200" />
                <span className="text-sm font-bold">{data.naechster_stopp.eta_min} min</span>
              </div>
            )}
            {data.naechster_stopp.distanz_km !== null && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-200" />
                <span className="text-sm font-bold">{data.naechster_stopp.distanz_km} km</span>
              </div>
            )}
            <div className="text-sm font-bold ml-auto">
              {data.naechster_stopp.betrag.toFixed(2)} €
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 bg-white text-blue-600 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 active:opacity-80"
              onClick={() => openNav(data.naechster_stopp!.adresse)}
            >
              <Navigation className="w-3.5 h-3.5" /> Navigieren
            </button>
            {data.naechster_stopp.telefon && (
              <a
                href={`tel:${data.naechster_stopp.telefon}`}
                className="bg-blue-500 text-white rounded-lg py-2 px-3 text-xs font-bold flex items-center justify-center gap-1 active:opacity-80"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-bold text-gray-700">Alle Stopps</span>
        </div>
        <div className="divide-y divide-gray-50">
          {data.stopps.map(stopp => (
            <div key={stopp.id}>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === stopp.id ? null : stopp.id)}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  stopp.status === 'erledigt' ? 'bg-emerald-100 text-emerald-700' :
                  stopp.status === 'aktiv' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500',
                )}>
                  {stopp.status === 'erledigt' ? '✓' : stopp.nr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-semibold truncate', stopp.status === 'erledigt' ? 'text-gray-400 line-through' : 'text-gray-800')}>
                      {stopp.name}
                    </span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{stopp.bestellnummer}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{stopp.adresse}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {stopp.eta_min !== null && stopp.status !== 'erledigt' && (
                    <span className="text-[10px] text-gray-500">{stopp.eta_min}m</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                </div>
              </button>

              {expanded === stopp.id && stopp.status !== 'erledigt' && (
                <div className="px-3 pb-2 bg-gray-50 flex gap-2">
                  <button
                    className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1"
                    onClick={() => openNav(stopp.adresse)}
                  >
                    <Navigation className="w-3 h-3" /> Navi
                  </button>
                  {stopp.telefon && (
                    <a href={`tel:${stopp.telefon}`} className="bg-gray-200 text-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold flex items-center justify-center gap-1">
                      <Phone className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
