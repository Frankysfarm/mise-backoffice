'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, AlertTriangle, Phone, Package, ChevronRight, Route, Zap } from 'lucide-react';

type StoppStatus = 'geliefert' | 'unterwegs' | 'naechster' | 'ausstehend' | 'problem';

interface TourStopp {
  stopp_id: string;
  stopp_nr: number;
  adresse: string;
  kunden_name: string;
  kunden_telefon: string | null;
  pakete: number;
  anmerkung: string | null;
  eta_min: number | null;
  wartezeit_min: number | null;
  status: StoppStatus;
  bonus: boolean;
}

interface NavHubData {
  tour_id: string;
  stopps: TourStopp[];
  aktiver_stopp_nr: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  restzeit_min: number;
  schicht_score: number;
  tour_effizienz_pct: number;
  pausen_empfehlung: boolean;
}

const MOCK: NavHubData = {
  tour_id: 't_demo',
  aktiver_stopp_nr: 3,
  stopps_erledigt: 2,
  stopps_gesamt: 5,
  restzeit_min: 28,
  schicht_score: 84,
  tour_effizienz_pct: 91,
  pausen_empfehlung: false,
  stopps: [
    { stopp_id: 's1', stopp_nr: 1, adresse: 'Adalbertsteinweg 12, Aachen',     kunden_name: 'M. Schulz', kunden_telefon: null,            pakete: 1, anmerkung: null,           eta_min: null, wartezeit_min: 1.2, status: 'geliefert', bonus: false },
    { stopp_id: 's2', stopp_nr: 2, adresse: 'Jülicher Str. 8, Aachen',          kunden_name: 'T. Bauer',  kunden_telefon: null,            pakete: 2, anmerkung: null,           eta_min: null, wartezeit_min: 2.5, status: 'geliefert', bonus: true  },
    { stopp_id: 's3', stopp_nr: 3, adresse: 'Pontstraße 3, Aachen',             kunden_name: 'S. Koch',   kunden_telefon: '+49171...',     pakete: 1, anmerkung: '2. OG, kein Aufzug', eta_min: 2, wartezeit_min: null, status: 'naechster', bonus: false },
    { stopp_id: 's4', stopp_nr: 4, adresse: 'Habsburgerallee 5, Aachen',        kunden_name: 'J. Fischer',kunden_telefon: null,            pakete: 3, anmerkung: null,           eta_min: 14, wartezeit_min: null, status: 'ausstehend', bonus: false },
    { stopp_id: 's5', stopp_nr: 5, adresse: 'Vaalser Str. 20, Aachen',          kunden_name: 'A. Weber',  kunden_telefon: null,            pakete: 1, anmerkung: null,           eta_min: 28, wartezeit_min: null, status: 'ausstehend', bonus: true  },
  ],
};

const STATUS_STYLE: Record<StoppStatus, { dot: string; bg: string; border: string; label: string }> = {
  geliefert:  { dot: 'bg-green-500',  bg: 'bg-green-50',   border: 'border-green-200',  label: 'Geliefert'  },
  unterwegs:  { dot: 'bg-blue-500 animate-pulse',  bg: 'bg-blue-50',    border: 'border-blue-300',   label: 'Unterwegs'  },
  naechster:  { dot: 'bg-indigo-500', bg: 'bg-indigo-50',  border: 'border-indigo-400', label: 'Nächster'   },
  ausstehend: { dot: 'bg-gray-300',   bg: 'bg-white',      border: 'border-gray-200',   label: 'Ausstehend' },
  problem:    { dot: 'bg-red-500',    bg: 'bg-red-50',     border: 'border-red-300',    label: 'Problem'    },
};

function openNavi(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
}

interface Props { locationId?: string | null; fahrerToken?: string | null; }

export function FahrerPhase4305SmartTourStoppNavHub({ locationId, fahrerToken }: Props) {
  const [data, setData] = useState<NavHubData>(MOCK);
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
  const scoreColor = data.schicht_score >= 85 ? 'text-green-600' : data.schicht_score >= 70 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-200" />
            <span className="text-sm font-bold text-white">Smart Tour Navigator</span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">Score</p>
              <p className={`text-sm font-black text-white`}>{data.schicht_score}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">Restzeit</p>
              <p className="text-sm font-black text-white">{data.restzeit_min}m</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-200 font-medium">{data.stopps_erledigt}/{data.stopps_gesamt}</span>
          <div className="flex-1 h-2 bg-indigo-800 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-indigo-200 font-medium">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Efficiency Strip */}
      <div className="flex items-center gap-2 bg-indigo-50 border-b border-indigo-100 px-4 py-1.5">
        <Zap className="w-3 h-3 text-indigo-400" />
        <span className="text-[10px] text-indigo-600 font-medium">Tour-Effizienz: {data.tour_effizienz_pct}%</span>
        {data.pausen_empfehlung && (
          <span className="ml-auto text-[10px] text-amber-600 font-medium bg-amber-50 rounded-full px-2 py-0.5">
            ☕ Pause empfohlen
          </span>
        )}
      </div>

      {/* Stopp List */}
      <div className="divide-y divide-gray-100">
        {data.stopps.map((stopp) => {
          const ss = STATUS_STYLE[stopp.status];
          const isActive = stopp.status === 'naechster';
          const isOpen = expandedId === stopp.stopp_id;

          return (
            <div key={stopp.stopp_id} className={`${isActive ? 'bg-indigo-50/50' : ''}`}>
              <button
                onClick={() => setExpandedId(isOpen ? null : stopp.stopp_id)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                {/* Status Dot + Line */}
                <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
                  <span className={`w-3 h-3 rounded-full border-2 border-white shadow ${ss.dot}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400">#{stopp.stopp_nr}</span>
                    <span className={`text-[9px] font-semibold px-1 rounded ${ss.bg} ${stopp.status === 'naechster' ? 'text-indigo-600' : stopp.status === 'geliefert' ? 'text-green-600' : 'text-gray-500'}`}>
                      {ss.label}
                    </span>
                    {stopp.bonus && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                  </div>
                  <p className="text-xs font-semibold text-gray-800 truncate">{stopp.adresse}</p>
                  <p className="text-[10px] text-gray-500">{stopp.kunden_name} · {stopp.pakete} Paket{stopp.pakete > 1 ? 'e' : ''}</p>
                </div>

                {/* ETA / Time */}
                <div className="flex-shrink-0 text-right">
                  {stopp.status === 'geliefert' && stopp.wartezeit_min != null && (
                    <span className="text-[9px] text-green-600 font-medium">{stopp.wartezeit_min}m <CheckCircle2 className="inline w-2.5 h-2.5" /></span>
                  )}
                  {stopp.eta_min != null && stopp.status !== 'geliefert' && (
                    <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>~{stopp.eta_min}m</span>
                  )}
                  {stopp.status === 'problem' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <ChevronRight className={`w-3.5 h-3.5 text-gray-300 mt-0.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Expanded Detail */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-2 bg-gray-50 border-t border-gray-100">
                  {stopp.anmerkung && (
                    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700">{stopp.anmerkung}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {stopp.status !== 'geliefert' && (
                      <button
                        onClick={() => openNavi(stopp.adresse)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-indigo-700 active:scale-95 transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />Navigation starten
                      </button>
                    )}
                    {stopp.kunden_telefon && (
                      <a
                        href={`tel:${stopp.kunden_telefon}`}
                        className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-xl px-3 py-2 text-xs font-medium hover:bg-gray-200 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />Anrufen
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-center">
                    <div className="bg-white rounded-lg p-1.5 border border-gray-100">
                      <p className="text-[8px] text-gray-400">Pakete</p>
                      <p className="text-sm font-bold text-gray-700">{stopp.pakete}</p>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 border border-gray-100">
                      <p className="text-[8px] text-gray-400">ETA</p>
                      <p className="text-sm font-bold text-gray-700">{stopp.eta_min != null ? `${stopp.eta_min}m` : '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 text-[9px] text-gray-400 flex items-center justify-between border-t border-gray-100">
        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />20s Live-Update</span>
        <span>Tippen = Details · Navi öffnet Maps</span>
      </div>
    </div>
  );
}
