'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, CheckCircle, Clock, Package, Phone, ChevronRight, Zap, AlertTriangle, Map } from 'lucide-react';

interface TourStopp {
  id: string;
  stopp_nr: number;
  kunde_name: string;
  adresse: string;
  eta_min: number | null;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen' | 'verpasst';
  bestellnummer: string;
  notiz: string | null;
  distanz_km: number | null;
  telefon: string | null;
}

interface TourData {
  stopps: TourStopp[];
  aktiver_stopp_nr: number;
  tour_fortschritt_pct: number;
  gesamt_stopps: number;
  abgeschlossen: number;
  verbleibende_min: number;
  tour_id: string;
}

const MOCK: TourData = {
  tour_id: 'TOUR-0042',
  aktiver_stopp_nr: 2,
  tour_fortschritt_pct: 33,
  gesamt_stopps: 6,
  abgeschlossen: 2,
  verbleibende_min: 45,
  stopps: [
    { id: 's1', stopp_nr: 1, kunde_name: 'Müller, Anna',    adresse: 'Hauptstr. 12, Aachen',       eta_min: null, status: 'abgeschlossen', bestellnummer: 'FF-1040', notiz: null,              distanz_km: 1.2, telefon: null },
    { id: 's2', stopp_nr: 2, kunde_name: 'Schmidt, Bernd',  adresse: 'Jakobstr. 5, Aachen',        eta_min: 4,    status: 'aktiv',         bestellnummer: 'FF-1041', notiz: 'Klingel 2. OG',  distanz_km: 0.8, telefon: '+49151234567' },
    { id: 's3', stopp_nr: 3, kunde_name: 'Weber, Claudia',  adresse: 'Pontstraße 88, Aachen',      eta_min: 12,   status: 'ausstehend',    bestellnummer: 'FF-1042', notiz: null,              distanz_km: 1.9, telefon: null },
    { id: 's4', stopp_nr: 4, kunde_name: 'Fischer, David',  adresse: 'Markt 3, Aachen',            eta_min: 20,   status: 'ausstehend',    bestellnummer: 'FF-1043', notiz: 'Bitte klingeln', distanz_km: 2.3, telefon: '+49177654321' },
    { id: 's5', stopp_nr: 5, kunde_name: 'Becker, Eva',     adresse: 'Münsterplatz 7, Aachen',     eta_min: 28,   status: 'ausstehend',    bestellnummer: 'FF-1044', notiz: null,              distanz_km: 1.5, telefon: null },
    { id: 's6', stopp_nr: 6, kunde_name: 'Hoffmann, Frank', adresse: 'Römerstr. 44, Aachen',       eta_min: 36,   status: 'ausstehend',    bestellnummer: 'FF-1045', notiz: null,              distanz_km: 3.1, telefon: null },
  ],
};

const STATUS_STYLES: Record<TourStopp['status'], { border: string; bg: string; icon: JSX.Element; label: string }> = {
  abgeschlossen: { border: 'border-emerald-200', bg: 'bg-emerald-50 dark:bg-emerald-950', icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, label: 'erledigt' },
  aktiv:         { border: 'border-blue-300',    bg: 'bg-blue-50 dark:bg-blue-950',       icon: <Navigation  className="w-4 h-4 text-blue-600 animate-pulse" />, label: 'aktiv' },
  ausstehend:    { border: 'border-gray-200',    bg: 'bg-white dark:bg-gray-900',         icon: <Package     className="w-4 h-4 text-gray-400" />, label: 'offen' },
  verpasst:      { border: 'border-red-200',     bg: 'bg-red-50 dark:bg-red-950',         icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: 'verpasst' },
};

function openNavigation(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.location.href = `maps://?q=${encoded}`;
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  }
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4584TourStoppNavigationHub({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<TourData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/aktive-tour?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const j = await res.json();
        if (!j.error && j.stopps) setData(j);
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId, isOnline]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  const aktiverStopp = data.stopps.find(s => s.status === 'aktiv');
  const offeneStoppe = data.stopps.filter(s => s.status === 'ausstehend').length;

  return (
    <div className="space-y-3">
      {/* Tour-Header */}
      <div className="bg-blue-600 dark:bg-blue-700 rounded-xl p-3 text-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4" />
            <span className="text-sm font-bold">Tour {data.tour_id}</span>
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />}
          </div>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
            {data.abgeschlossen}/{data.gesamt_stopps} Stopps
          </span>
        </div>

        {/* Fortschritts-Balken */}
        <div className="space-y-1">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${data.tour_fortschritt_pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/70">
            <span>{data.tour_fortschritt_pct}% abgeschlossen</span>
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> ~{data.verbleibende_min}min verbleibend</span>
          </div>
        </div>
      </div>

      {/* Aktiver Stopp — hervorgehoben */}
      {aktiverStopp && (
        <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-400 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Jetzt anfahren</span>
            {aktiverStopp.eta_min !== null && (
              <span className="ml-auto text-xs font-black text-blue-800 dark:text-blue-200 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {aktiverStopp.eta_min} Min
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{aktiverStopp.kunde_name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{aktiverStopp.adresse}</p>
          {aktiverStopp.notiz && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
              📝 {aktiverStopp.notiz}
            </p>
          )}
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => openNavigation(aktiverStopp.adresse)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg active:bg-blue-700"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigation starten
            </button>
            {aktiverStopp.telefon && (
              <a
                href={`tel:${aktiverStopp.telefon}`}
                className="flex items-center justify-center gap-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-2 rounded-lg"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps — kompakte Liste */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Alle Stopps</p>
          <span className="text-[10px] text-gray-400">{offeneStoppe} offen</span>
        </div>

        {data.stopps.map(stopp => {
          const st = STATUS_STYLES[stopp.status];
          const isExpanded = expandedId === stopp.id;
          const isActive = stopp.status === 'aktiv';

          return (
            <div key={stopp.id} className={`rounded-xl border ${st.border} ${st.bg} overflow-hidden`}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpandedId(isExpanded ? null : stopp.id)}
              >
                {/* Nummer */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                  isActive ? 'bg-blue-600 text-white' :
                  stopp.status === 'abgeschlossen' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  {stopp.stopp_nr}
                </span>

                {/* Icon */}
                <span className="flex-shrink-0">{st.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${stopp.status === 'abgeschlossen' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                    {stopp.kunde_name}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{stopp.adresse}</p>
                </div>

                {/* ETA + Expand */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {stopp.eta_min !== null && stopp.status !== 'abgeschlossen' && (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                      {stopp.eta_min}m
                    </span>
                  )}
                  {stopp.status === 'abgeschlossen' && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Erweiterte Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      #{stopp.bestellnummer}
                    </span>
                    {stopp.distanz_km && (
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                        {stopp.distanz_km} km
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      stopp.status === 'aktiv' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                      stopp.status === 'abgeschlossen' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {st.label}
                    </span>
                  </div>
                  {stopp.notiz && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
                      📝 {stopp.notiz}
                    </p>
                  )}
                  {stopp.status !== 'abgeschlossen' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openNavigation(stopp.adresse)}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-1.5 rounded-lg"
                      >
                        <Navigation className="w-3 h-3" /> Navigieren
                      </button>
                      {stopp.telefon && (
                        <a href={`tel:${stopp.telefon}`} className="flex items-center justify-center gap-1 text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg">
                          <Phone className="w-3 h-3" /> Anrufen
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

      {!isOnline && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          <span className="text-xs text-amber-700 dark:text-amber-400">Offline — zeige letzte bekannte Tour-Daten</span>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-center">30-Sek-Polling · Mock-Fallback</p>
    </div>
  );
}
