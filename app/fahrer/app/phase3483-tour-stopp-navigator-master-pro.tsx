'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation, MapPin, Phone, Clock, CheckCircle2, ChevronDown, ChevronUp, Package, AlertTriangle, Map } from 'lucide-react';

interface TourStop {
  stopp_id: string;
  stopp_nr: number;
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  adresse: string;
  plz: string;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  notiz: string | null;
  lieferhinweis: string | null;
  gesamtbetrag: number;
  bezahlt: boolean;
  pakete: number;
  eta_min: number | null;
  status: 'ausstehend' | 'unterwegs' | 'abgeschlossen';
}

interface ApiData {
  tour_id: string;
  stopps: TourStop[];
  aktiver_stopp_nr: number | null;
  tour_status: 'zugewiesen' | 'pickup' | 'unterwegs' | 'fertig';
  stopps_fertig: number;
  stopps_gesamt: number;
}

const MOCK_STOPPS: TourStop[] = [
  {
    stopp_id: 's1', stopp_nr: 1, order_id: 'o1', bestellnummer: '#1042',
    kunde_name: 'Marie Schmidt', adresse: 'Pontstraße 3', plz: '52062',
    lat: 50.776, lng: 6.083, telefon: '+4924112345', notiz: 'Klingel defekt — anrufen!',
    lieferhinweis: 'HG, 2. OG links', gesamtbetrag: 24.50, bezahlt: false, pakete: 2,
    eta_min: 4, status: 'unterwegs',
  },
  {
    stopp_id: 's2', stopp_nr: 2, order_id: 'o2', bestellnummer: '#1043',
    kunde_name: 'Tom Bauer', adresse: 'Jülicher Str. 7', plz: '52070',
    lat: 50.789, lng: 6.071, telefon: '+4924198765', notiz: null,
    lieferhinweis: null, gesamtbetrag: 18.90, bezahlt: true, pakete: 1,
    eta_min: 12, status: 'ausstehend',
  },
  {
    stopp_id: 's3', stopp_nr: 3, order_id: 'o3', bestellnummer: '#1044',
    kunde_name: 'Anna Koch', adresse: 'Vaalser Str. 12', plz: '52074',
    lat: 50.762, lng: 6.065, telefon: null, notiz: null,
    lieferhinweis: 'Hinterhof EG', gesamtbetrag: 32.00, bezahlt: true, pakete: 3,
    eta_min: 21, status: 'ausstehend',
  },
];

const MOCK: ApiData = {
  tour_id: 't1',
  stopps: MOCK_STOPPS,
  aktiver_stopp_nr: 1,
  tour_status: 'unterwegs',
  stopps_fertig: 0,
  stopps_gesamt: 3,
};

function mapsUrl(lat: number | null, lng: number | null, adresse: string, plz: string): string {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent(`${adresse}, ${plz}`)}`;
}

function wazeUrl(lat: number | null, lng: number | null): string | null {
  if (!lat || !lng) return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

function CountdownBadge({ eta }: { eta: number }) {
  const color = eta <= 3 ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                eta <= 7 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200' :
                           'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200';
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold border rounded px-1.5 py-0.5 ${color}`}>
      <Clock className="w-2.5 h-2.5" />
      ~{eta} Min
    </span>
  );
}

export function FahrerPhase3483TourStoppNavigatorMasterPro({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const r = await fetch(`/api/delivery/fahrer/aktive-tour?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 15 * 1000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(pollId); if (tickRef.current) clearInterval(tickRef.current); };
  }, [load]);

  if (!isOnline || !data || data.tour_status === 'fertig') return null;

  const { stopps, aktiver_stopp_nr, stopps_fertig, stopps_gesamt } = data;
  const aktiverStopp = stopps.find(s => s.stopp_nr === aktiver_stopp_nr);
  const naechsteStopps = stopps.filter(s => s.status === 'ausstehend').slice(0, 3);
  const progressPct = stopps_gesamt > 0 ? Math.round((stopps_fertig / stopps_gesamt) * 100) : 0;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-md mb-3 overflow-hidden">
      {/* Hero: Aktiver Stopp */}
      {aktiverStopp ? (
        <div className="bg-blue-600 dark:bg-blue-800 text-white p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-blue-200 mb-0.5">
                Stopp {aktiverStopp.stopp_nr} von {stopps_gesamt}
              </div>
              <div className="text-base font-bold">{aktiverStopp.kunde_name}</div>
              <div className="text-sm text-blue-100">{aktiverStopp.adresse}, {aktiverStopp.plz}</div>
            </div>
            {aktiverStopp.eta_min !== null && <CountdownBadge eta={aktiverStopp.eta_min} />}
          </div>

          {/* Alerts */}
          {aktiverStopp.notiz && (
            <div className="flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-300/40 rounded px-2 py-1 mb-2 text-[10px] text-yellow-100">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {aktiverStopp.notiz}
            </div>
          )}
          {aktiverStopp.lieferhinweis && (
            <div className="text-[10px] text-blue-200 mb-2">📦 {aktiverStopp.lieferhinweis}</div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 text-[10px] text-blue-200 mb-3">
            <span>{aktiverStopp.pakete} Paket{aktiverStopp.pakete > 1 ? 'e' : ''}</span>
            <span>·</span>
            <span className={aktiverStopp.bezahlt ? 'text-emerald-300' : 'text-yellow-300 font-bold'}>
              {aktiverStopp.bezahlt ? '✓ Bezahlt' : `€${aktiverStopp.gesamtbetrag.toFixed(2)} bar`}
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            <a
              href={mapsUrl(aktiverStopp.lat, aktiverStopp.lng, aktiverStopp.adresse, aktiverStopp.plz)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-blue-700 rounded-lg py-2 text-xs font-bold shadow"
            >
              <Map className="w-3.5 h-3.5" />
              Google Maps
            </a>
            {wazeUrl(aktiverStopp.lat, aktiverStopp.lng) && (
              <a
                href={wazeUrl(aktiverStopp.lat, aktiverStopp.lng)!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 text-white rounded-lg py-2 text-xs font-bold shadow"
              >
                <Navigation className="w-3.5 h-3.5" />
                Waze
              </a>
            )}
            {aktiverStopp.telefon && (
              <a
                href={`tel:${aktiverStopp.telefon}`}
                className="flex items-center justify-center gap-1.5 bg-emerald-500 text-white rounded-lg py-2 px-3 text-xs font-bold shadow"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Alle Stopps abgearbeitet!</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
          <span>{stopps_fertig}/{stopps_gesamt} abgeschlossen</span>
          <span>{progressPct}%</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Nächste Stopps */}
      {naechsteStopps.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-[9px] text-gray-400 uppercase tracking-wide font-bold mb-1.5">Nächste Stopps</div>
          <div className="space-y-2">
            {naechsteStopps.map(stopp => (
              <div key={stopp.stopp_id} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0 mt-0.5">
                  {stopp.stopp_nr}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">{stopp.kunde_name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{stopp.adresse}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                      <Package className="w-2.5 h-2.5" />{stopp.pakete} Pkt.
                    </span>
                    <span className={`text-[9px] font-bold ${stopp.bezahlt ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {stopp.bezahlt ? 'Bezahlt' : `€${stopp.gesamtbetrag.toFixed(2)}`}
                    </span>
                    {stopp.eta_min !== null && (
                      <span className="text-[9px] text-blue-500 font-bold flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />~{stopp.eta_min} Min
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <a
                    href={mapsUrl(stopp.lat, stopp.lng, stopp.adresse, stopp.plz)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                  >
                    <MapPin className="w-3 h-3" />
                  </a>
                  {stopp.telefon && (
                    <a
                      href={`tel:${stopp.telefon}`}
                      className="p-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
                    >
                      <Phone className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
