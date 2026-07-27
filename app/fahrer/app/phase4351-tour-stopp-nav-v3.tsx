'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, AlertTriangle, Phone, Package, ChevronRight, Route, Zap, Target } from 'lucide-react';

type StoppStatus = 'geliefert' | 'aktiv' | 'naechster' | 'ausstehend' | 'problem';

interface TourStopp {
  stopp_id: string;
  stopp_nr: number;
  adresse: string;
  kunden_name: string;
  kunden_telefon: string | null;
  pakete: number;
  anmerkung: string | null;
  eta_min: number | null;
  lieferzeit_min: number | null;
  status: StoppStatus;
  bonus: boolean;
  navi_url: string | null;
}

interface NavV3Data {
  tour_id: string;
  stopps: TourStopp[];
  aktiver_stopp_nr: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  restzeit_min: number;
  schicht_score: number;
  tour_effizienz_pct: number;
  km_gesamt: number;
  km_erledigt: number;
  pausen_empfehlung: boolean;
}

const MOCK: NavV3Data = {
  tour_id: 't_demo',
  aktiver_stopp_nr: 3,
  stopps_erledigt: 2,
  stopps_gesamt: 6,
  restzeit_min: 34,
  schicht_score: 87,
  tour_effizienz_pct: 93,
  km_gesamt: 18.4,
  km_erledigt: 7.1,
  pausen_empfehlung: false,
  stopps: [
    { stopp_id: 's1', stopp_nr: 1, adresse: 'Adalbertsteinweg 12, Aachen',  kunden_name: 'M. Schulz', kunden_telefon: null,        pakete: 1, anmerkung: null,                 eta_min: null, lieferzeit_min: 18, status: 'geliefert', bonus: false, navi_url: null },
    { stopp_id: 's2', stopp_nr: 2, adresse: 'Jülicher Str. 8, Aachen',       kunden_name: 'T. Bauer',  kunden_telefon: null,        pakete: 2, anmerkung: null,                 eta_min: null, lieferzeit_min: 23, status: 'geliefert', bonus: true,  navi_url: null },
    { stopp_id: 's3', stopp_nr: 3, adresse: 'Pontstraße 3, Aachen',          kunden_name: 'S. Koch',   kunden_telefon: '+4917112345',pakete: 1, anmerkung: '2. OG, kein Aufzug',eta_min: 3,    lieferzeit_min: null, status: 'naechster', bonus: false, navi_url: 'https://www.google.com/maps/dir/?api=1&destination=Pontstra%C3%9Fe+3+Aachen' },
    { stopp_id: 's4', stopp_nr: 4, adresse: 'Habsburgerallee 5, Aachen',     kunden_name: 'J. Fischer',kunden_telefon: null,        pakete: 3, anmerkung: null,                 eta_min: 16,   lieferzeit_min: null, status: 'ausstehend', bonus: false, navi_url: null },
    { stopp_id: 's5', stopp_nr: 5, adresse: 'Vaalser Str. 20, Aachen',       kunden_name: 'A. Weber',  kunden_telefon: null,        pakete: 1, anmerkung: null,                 eta_min: 26,   lieferzeit_min: null, status: 'ausstehend', bonus: true,  navi_url: null },
    { stopp_id: 's6', stopp_nr: 6, adresse: 'Franzstraße 15, Aachen',        kunden_name: 'L. Müller', kunden_telefon: null,        pakete: 2, anmerkung: 'Hinterhof rechts',   eta_min: 34,   lieferzeit_min: null, status: 'ausstehend', bonus: false, navi_url: null },
  ],
};

const STATUS_STYLE: Record<StoppStatus, { dot: string; label: string; textColor: string }> = {
  geliefert:  { dot: 'bg-green-500',               label: 'Geliefert',  textColor: 'text-green-600'  },
  aktiv:      { dot: 'bg-blue-500 animate-pulse',   label: 'Unterwegs',  textColor: 'text-blue-600'   },
  naechster:  { dot: 'bg-indigo-500',               label: 'Nächster',   textColor: 'text-indigo-600' },
  ausstehend: { dot: 'bg-gray-300',                 label: 'Ausstehend', textColor: 'text-gray-400'   },
  problem:    { dot: 'bg-red-500 animate-pulse',    label: 'Problem',    textColor: 'text-red-600'    },
};

function buildNaviUrl(adresse: string, naviUrl: string | null): string {
  if (naviUrl) return naviUrl;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

interface Props { locationId?: string | null; fahrerToken?: string | null; }

export function FahrerPhase4351TourStoppNavV3({ locationId, fahrerToken }: Props) {
  const [data, setData] = useState<NavV3Data>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>('s3');

  const load = useCallback(async () => {
    if (!fahrerToken) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/aktive-tour?token=${fahrerToken}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [fahrerToken]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const progress = data.stopps_gesamt > 0 ? (data.stopps_erledigt / data.stopps_gesamt) * 100 : 0;
  const kmProgress = data.km_gesamt > 0 ? (data.km_erledigt / data.km_gesamt) * 100 : 0;

  const naechsterStopp = data.stopps.find(s => s.status === 'naechster');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-200" />
            <span className="text-sm font-bold text-white">Tour Navigator V3</span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">Score</p>
              <p className="text-sm font-black text-white">{data.schicht_score}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">Restzeit</p>
              <p className="text-sm font-black text-white">{data.restzeit_min}m</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-200">{data.stopps_erledigt}/{data.stopps_gesamt}</span>
          <div className="flex-1 h-2 bg-indigo-800 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-indigo-200">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 bg-indigo-50 border-b border-indigo-100">
        <div className="px-3 py-1.5 text-center">
          <p className="text-[8px] text-gray-400">Effizienz</p>
          <p className="text-xs font-bold text-indigo-700">{data.tour_effizienz_pct}%</p>
        </div>
        <div className="px-3 py-1.5 text-center">
          <p className="text-[8px] text-gray-400">km erledigt</p>
          <p className="text-xs font-bold text-gray-700">{data.km_erledigt.toFixed(1)} / {data.km_gesamt.toFixed(1)}</p>
        </div>
        <div className="px-3 py-1.5 text-center">
          {data.pausen_empfehlung ? (
            <>
              <p className="text-[8px] text-amber-500">Pause</p>
              <p className="text-xs font-bold text-amber-600">Empfohlen</p>
            </>
          ) : (
            <>
              <p className="text-[8px] text-gray-400">Pakete</p>
              <p className="text-xs font-bold text-gray-700">{data.stopps.reduce((sum, s) => sum + s.pakete, 0)}</p>
            </>
          )}
        </div>
      </div>

      {/* Nächster Stopp CTA */}
      {naechsterStopp && (
        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Nächster Stopp</span>
              </div>
              <p className="text-sm font-bold text-gray-800 leading-tight">{naechsterStopp.adresse}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{naechsterStopp.kunden_name} · {naechsterStopp.pakete} Paket{naechsterStopp.pakete > 1 ? 'e' : ''}</p>
              {naechsterStopp.anmerkung && (
                <div className="flex items-center gap-1 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                  <span className="text-[9px] text-amber-700">{naechsterStopp.anmerkung}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <a
                href={buildNaviUrl(naechsterStopp.adresse, naechsterStopp.navi_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-indigo-700 active:scale-95 transition"
              >
                <Navigation className="w-3.5 h-3.5" />Navi
              </a>
              {naechsterStopp.kunden_telefon && (
                <a
                  href={`tel:${naechsterStopp.kunden_telefon}`}
                  className="flex items-center gap-1 bg-gray-100 text-gray-700 rounded-xl px-3 py-2 text-xs font-medium hover:bg-gray-200 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
          {naechsterStopp.eta_min != null && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-500">
              <Clock className="w-2.5 h-2.5" />
              <span>ETA ~{naechsterStopp.eta_min} Minuten</span>
            </div>
          )}
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="divide-y divide-gray-100">
        {data.stopps.map((stopp) => {
          const ss = STATUS_STYLE[stopp.status];
          const isOpen = expandedId === stopp.stopp_id;
          const isActive = stopp.status === 'naechster' || stopp.status === 'aktiv';

          return (
            <div key={stopp.stopp_id} className={isActive ? 'bg-indigo-50/30' : ''}>
              <button
                onClick={() => setExpandedId(isOpen ? null : stopp.stopp_id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 transition"
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ss.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-gray-400">#{stopp.stopp_nr}</span>
                    {stopp.bonus && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 truncate">{stopp.adresse}</p>
                  <p className="text-[10px] text-gray-400">{stopp.kunden_name} · {stopp.pakete} Pkt</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {stopp.status === 'geliefert' && stopp.lieferzeit_min != null ? (
                    <span className="text-[10px] text-green-600 font-semibold">{stopp.lieferzeit_min}m ✓</span>
                  ) : stopp.eta_min != null ? (
                    <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>~{stopp.eta_min}m</span>
                  ) : null}
                  <ChevronRight className={`w-3 h-3 text-gray-300 mt-0.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isOpen && stopp.status !== 'geliefert' && (
                <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  {stopp.anmerkung && (
                    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700">{stopp.anmerkung}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <a
                      href={buildNaviUrl(stopp.adresse, stopp.navi_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-indigo-700 active:scale-95 transition"
                    >
                      <Navigation className="w-3.5 h-3.5" />Navigation starten
                    </a>
                    {stopp.kunden_telefon && (
                      <a
                        href={`tel:${stopp.kunden_telefon}`}
                        className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-xl px-3 py-2 text-xs font-medium hover:bg-gray-200 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 text-[9px] text-gray-400 flex justify-between border-t border-gray-100">
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />20s Live-Update</span>
        <span>Tippen = Details · Navi öffnet Maps</span>
      </div>
    </div>
  );
}
