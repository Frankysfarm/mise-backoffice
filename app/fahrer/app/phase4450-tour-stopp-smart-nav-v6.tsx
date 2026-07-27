'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, Clock, Phone, Package, CheckCircle2, AlertTriangle, ChevronRight, Zap, Route } from 'lucide-react';

interface TourStopp {
  stop_id: string;
  position: number;
  adresse: string;
  kunde_name: string;
  telefon: string | null;
  artikel: { name: string; menge: number }[];
  notiz: string | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
  bar_betrag: number | null;
}

interface TourInfo {
  tour_id: string;
  fahrer_name: string;
  gesamtstopps: number;
  geliefert: number;
  verbleibend_min: number | null;
  effizienz_score: number;
  stopps: TourStopp[];
}

const MOCK: TourInfo = {
  tour_id: 'tour-42',
  fahrer_name: 'Marco',
  gesamtstopps: 4,
  geliefert: 1,
  verbleibend_min: 38,
  effizienz_score: 88,
  stopps: [
    { stop_id: 's1', position: 1, adresse: 'Pontstraße 14, Aachen',     kunde_name: 'L. Wagner',  telefon: '+49 151 1234567', artikel: [{ name: 'Margherita', menge: 1 }, { name: 'Cola', menge: 2 }], notiz: null,               status: 'geliefert',  eta_min: null, lat: 50.776, lng: 6.084, bar_betrag: null     },
    { stop_id: 's2', position: 2, adresse: 'Jakobstraße 55, Aachen',    kunde_name: 'P. Müller',  telefon: '+49 176 9876543', artikel: [{ name: 'Pasta Arrabbiata', menge: 1 }],                      notiz: '2. OG, kein Lift', status: 'unterwegs',  eta_min: 4,    lat: 50.771, lng: 6.097, bar_betrag: 12.50    },
    { stop_id: 's3', position: 3, adresse: 'Kaiserplatz 3, Aachen',     kunde_name: 'A. Schulze', telefon: null,              artikel: [{ name: 'Salat', menge: 2 }, { name: 'Wasser', menge: 1 }],   notiz: null,               status: 'ausstehend', eta_min: 14,   lat: 50.775, lng: 6.091, bar_betrag: null     },
    { stop_id: 's4', position: 4, adresse: 'Elisabethstraße 7, Aachen', kunde_name: 'K. Braun',   telefon: '+49 160 5551234', artikel: [{ name: 'Burger Deluxe', menge: 1 }],                         notiz: 'Bitte klingeln', status: 'ausstehend', eta_min: 22,   lat: 50.768, lng: 6.105, bar_betrag: 8.90     },
  ],
};

function buildNavUrl(lat: number, lng: number, adresse: string): string {
  const isAndroid = /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIOS = /iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (isAndroid) return `google.navigation:q=${lat},${lng}`;
  if (isIOS) return `maps://?daddr=${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

const STATUS_STYLE = {
  geliefert:  { dot: 'bg-green-400',  bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700'  },
  unterwegs:  { dot: 'bg-blue-500',   bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-700'   },
  ausstehend: { dot: 'bg-gray-300',   bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-600'   },
  problem:    { dot: 'bg-red-500',    bg: 'bg-red-50',     border: 'border-red-300',    text: 'text-red-700'    },
} as const;

interface Props { driverId: string; isOnline: boolean; }

export function FahrerPhase4450TourStoppSmartNavV6({ driverId, isOnline }: Props) {
  const [tour, setTour] = useState<TourInfo>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setTour(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, isOnline]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const aktiv = tour.stopps.find((s) => s.status === 'unterwegs') ?? tour.stopps.find((s) => s.status === 'ausstehend');
  const fortschritt = Math.round((tour.geliefert / Math.max(1, tour.gesamtstopps)) * 100);

  if (!isOnline) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
        <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
        <p className="text-xs text-amber-700 font-medium">Offline – Tour zuletzt synchronisiert</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm space-y-2.5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <Route className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Tour-Stopp Navigator V6</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            Eff. <span className="font-bold text-gray-700">{tour.effizienz_score}</span>
          </span>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-3">
        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
          <span>{tour.geliefert}/{tour.gesamtstopps} Stopps</span>
          {tour.verbleibend_min !== null && (
            <span className="flex items-center gap-0.5 text-indigo-600 font-medium">
              <Clock className="w-3 h-3" />noch ca. {tour.verbleibend_min} min
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Aktiver Stopp – CTA */}
      {aktiv && (
        <div className="mx-3 rounded-xl bg-indigo-600 text-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                {aktiv.status === 'unterwegs' ? 'Aktueller Stopp' : 'Nächster Stopp'}
              </p>
              <p className="text-sm font-bold leading-tight">{aktiv.adresse}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{aktiv.kunde_name}</p>
            </div>
            {aktiv.eta_min !== null && (
              <div className="flex-shrink-0 bg-white/20 rounded-lg px-2 py-1 text-center">
                <p className="text-lg font-black leading-none">{aktiv.eta_min}</p>
                <p className="text-[8px] opacity-80">min</p>
              </div>
            )}
          </div>

          {aktiv.notiz && (
            <div className="bg-amber-400/20 rounded-lg px-2 py-1">
              <p className="text-[10px] font-medium">📋 {aktiv.notiz}</p>
            </div>
          )}

          {aktiv.bar_betrag && (
            <div className="bg-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-yellow-300" />
              <p className="text-[10px] font-bold">Bar kassieren: {aktiv.bar_betrag.toFixed(2)} €</p>
            </div>
          )}

          <div className="flex gap-2">
            {aktiv.lat !== null && aktiv.lng !== null && (
              <a
                href={buildNavUrl(aktiv.lat, aktiv.lng, aktiv.adresse)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white text-indigo-700 rounded-lg py-2 text-xs font-bold"
              >
                <Navigation className="w-4 h-4" />Navigieren
              </a>
            )}
            {aktiv.telefon && (
              <a
                href={`tel:${aktiv.telefon}`}
                className="flex items-center justify-center gap-1 bg-white/20 rounded-lg px-3 py-2"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="px-3 pb-3 space-y-1.5">
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Alle Stopps</p>
        {tour.stopps.map((s) => {
          const st = STATUS_STYLE[s.status];
          const isExp = expandedStop === s.stop_id;
          const isAktiv = s.stop_id === aktiv?.stop_id;

          return (
            <div key={s.stop_id} className={`rounded-lg border ${st.border} ${st.bg} overflow-hidden`}>
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                onClick={() => setExpandedStop(isExp ? null : s.stop_id)}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot} ${s.status === 'unterwegs' ? 'animate-pulse' : ''}`} />
                <span className="text-[9px] font-bold text-gray-400 w-4">{s.position}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-800 truncate">{s.adresse}</p>
                  <p className="text-[9px] text-gray-500">{s.kunde_name} · {s.artikel.length} Artikel</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.eta_min !== null && !isAktiv && (
                    <span className="text-[9px] text-blue-600 font-medium">~{s.eta_min}min</span>
                  )}
                  {s.status === 'geliefert' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  {s.status !== 'geliefert' && <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${isExp ? 'rotate-90' : ''}`} />}
                </div>
              </button>

              {isExp && (
                <div className="border-t border-white/60 bg-white/60 px-3 py-2 space-y-1.5">
                  <div className="space-y-0.5">
                    {s.artikel.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-700">{a.menge}× {a.name}</span>
                      </div>
                    ))}
                  </div>
                  {s.notiz && (
                    <p className="text-[9px] text-amber-700 bg-amber-50 rounded px-1.5 py-1">📋 {s.notiz}</p>
                  )}
                  <div className="flex gap-2">
                    {s.lat !== null && s.lng !== null && (
                      <a href={buildNavUrl(s.lat, s.lng, s.adresse)}
                        className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 text-white rounded-lg py-1.5 text-[10px] font-bold">
                        <Navigation className="w-3 h-3" />Navi
                      </a>
                    )}
                    {s.telefon && (
                      <a href={`tel:${s.telefon}`}
                        className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 text-[10px] font-bold">
                        <Phone className="w-3 h-3" />Anrufen
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
  );
}
