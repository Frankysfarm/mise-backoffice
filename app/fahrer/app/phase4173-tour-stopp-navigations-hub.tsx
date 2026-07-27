'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Phone, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface Stopp {
  stopp_nr: number;
  adresse: string;
  kunde_name: string;
  kunden_telefon: string | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  notiz: string | null;
  bestellnummer: string;
}

interface ApiData {
  tour_id: string | null;
  fahrer_name: string;
  stopps: Stopp[];
  aktiver_stopp_nr: number | null;
  gesamt_stopps: number;
  geliefert: number;
  naechste_adresse: string | null;
  naechste_eta_min: number | null;
}

const MOCK: ApiData = {
  tour_id: 'tour-42',
  fahrer_name: 'Max M.',
  aktiver_stopp_nr: 2,
  gesamt_stopps: 3,
  geliefert: 1,
  naechste_adresse: 'Gartenweg 5, 52064 Aachen',
  naechste_eta_min: 4,
  stopps: [
    { stopp_nr: 1, adresse: 'Hauptstr. 12', kunde_name: 'Müller, A.', kunden_telefon: '+49 151 1234567', status: 'geliefert', eta_min: null, notiz: null, bestellnummer: 'FF-1041' },
    { stopp_nr: 2, adresse: 'Gartenweg 5, 52064 Aachen', kunde_name: 'Schmidt, B.', kunden_telefon: '+49 172 9876543', status: 'unterwegs', eta_min: 4, notiz: 'Klingel defekt – anrufen', bestellnummer: 'FF-1042' },
    { stopp_nr: 3, adresse: 'Am Berg 17', kunde_name: 'Weber, C.', kunden_telefon: null, status: 'ausstehend', eta_min: 14, notiz: null, bestellnummer: 'FF-1043' },
  ],
};

interface Props { driverId: string; activeBatchId: string | null; }

export function FahrerPhase4173TourStoppNavigationsHub({ driverId, activeBatchId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeBatchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stopps?driver_id=${driverId}&batch_id=${activeBatchId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, activeBatchId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const aktiv = data.stopps.find(s => s.stopp_nr === data.aktiver_stopp_nr);

  function openNavi(adresse: string) {
    const url = `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-white" />
          <span className="text-sm font-black text-white">Tour-Stopps</span>
          {loading && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        </div>
        <div className="text-xs text-blue-200 font-medium">
          {data.geliefert}/{data.gesamt_stopps} geliefert
        </div>
      </div>

      {/* Aktiver Stopp (Hauptcall-to-Action) */}
      {aktiv && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">{aktiv.stopp_nr}</span>
            <span className="text-xs font-bold text-blue-800">Aktueller Stopp</span>
            {aktiv.eta_min !== null && (
              <span className="ml-auto text-xs text-blue-700 font-medium flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{aktiv.eta_min} min
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">{aktiv.adresse}</p>
          <p className="text-xs text-gray-500 truncate">{aktiv.kunde_name} · {aktiv.bestellnummer}</p>
          {aktiv.notiz && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{aktiv.notiz}</span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => openNavi(aktiv.adresse)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-xl py-2.5 text-xs font-bold active:scale-95 transition"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigation
            </button>
            {aktiv.kunden_telefon && (
              <a
                href={`tel:${aktiv.kunden_telefon}`}
                className="flex items-center justify-center gap-1 bg-white border border-blue-300 text-blue-700 rounded-xl px-3 py-2.5 text-xs font-bold active:scale-95 transition"
              >
                <Phone className="w-3.5 h-3.5" /> Anrufen
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="divide-y divide-gray-100">
        {data.stopps.map(s => {
          const isGeliefert = s.status === 'geliefert';
          const isAktiv = s.stopp_nr === data.aktiver_stopp_nr;
          const isOpen = expanded === s.stopp_nr;

          return (
            <div key={s.stopp_nr} className={isAktiv ? 'bg-blue-50' : ''}>
              <button
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                onClick={() => setExpanded(isOpen ? null : s.stopp_nr)}
              >
                {/* Stopp-Nummer Badge */}
                <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 ${
                  isGeliefert ? 'bg-emerald-500 text-white' : isAktiv ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {isGeliefert ? <CheckCircle className="w-3 h-3" /> : s.stopp_nr}
                </span>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isGeliefert ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{s.adresse}</p>
                  <p className="text-[10px] text-gray-500 truncate">{s.kunde_name}</p>
                </div>
                {/* ETA */}
                {s.eta_min !== null && !isGeliefert && (
                  <span className="text-[10px] text-blue-600 font-medium flex-shrink-0">{s.eta_min}min</span>
                )}
                {isOpen ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
              </button>

              {/* Expanded Detail */}
              {isOpen && (
                <div className="px-4 pb-3 pt-0 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Package className="w-3 h-3" />
                    <span>Bestellung: {s.bestellnummer}</span>
                  </div>
                  {s.notiz && (
                    <div className="flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{s.notiz}
                    </div>
                  )}
                  {!isGeliefert && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openNavi(s.adresse)}
                        className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold"
                      >
                        <MapPin className="w-3 h-3" /> Navi öffnen
                      </button>
                      {s.kunden_telefon && (
                        <a href={`tel:${s.kunden_telefon}`} className="flex items-center gap-1 border border-blue-300 text-blue-700 rounded-lg px-3 py-1.5 text-[10px] font-bold">
                          <Phone className="w-3 h-3" /> {s.kunden_telefon}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex justify-between text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
        <span>Fortschritt: {data.geliefert}/{data.gesamt_stopps}</span>
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
