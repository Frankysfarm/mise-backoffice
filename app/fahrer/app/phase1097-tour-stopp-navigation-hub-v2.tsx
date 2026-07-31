'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation2, CheckCircle2, Clock, Phone, MessageSquare, AlertTriangle, ChevronRight, Bike, Package, Home } from 'lucide-react';

// Phase 1097 — Tour-Stopp-Navigations-Hub V2
// Tour-Stopps-Liste nummeriert; GPS-Navigation-Deeplinks;
// Stopp-Status: ausstehend/aktiv/abgeschlossen; Fahrer-ETA je Stopp;
// Kundentelefon-Schnellzugriff; Lieferungsbestätigung; Mock-Fallback

type StoppStatus = 'abgeschlossen' | 'aktiv' | 'ausstehend';

interface TourStopp {
  stopp_id: string;
  stopp_nr: number;
  kunde_name: string;
  adresse: string;
  plz: string;
  ort: string;
  eta_min: number | null;
  status: StoppStatus;
  telefon: string | null;
  bestellnummer: string;
  betrag_eur: number;
  notiz: string | null;
  lat: number;
  lng: number;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  stopps: TourStopp[];
  gesamt_stopps: number;
  fertig_stopps: number;
  aktiver_stopp: number | null;
}

const MOCK: TourData = {
  tour_id: 'tour_demo',
  fahrer_name: 'Max M.',
  gesamt_stopps: 5,
  fertig_stopps: 2,
  aktiver_stopp: 3,
  stopps: [
    {
      stopp_id: 's1', stopp_nr: 1, kunde_name: 'Anna Müller', adresse: 'Hauptstraße 12', plz: '52062', ort: 'Aachen',
      eta_min: null, status: 'abgeschlossen', telefon: '+49 241 1234567', bestellnummer: '#1091', betrag_eur: 24.80, notiz: null,
      lat: 50.7753, lng: 6.0839,
    },
    {
      stopp_id: 's2', stopp_nr: 2, kunde_name: 'Klaus Schmidt', adresse: 'Parkring 7', plz: '52064', ort: 'Aachen',
      eta_min: null, status: 'abgeschlossen', telefon: '+49 241 7654321', bestellnummer: '#1092', betrag_eur: 18.50, notiz: 'Klingel kaputt – anrufen',
      lat: 50.7771, lng: 6.0870,
    },
    {
      stopp_id: 's3', stopp_nr: 3, kunde_name: 'Sara Koch', adresse: 'Mühlenweg 3', plz: '52066', ort: 'Aachen',
      eta_min: 4, status: 'aktiv', telefon: '+49 241 9876543', bestellnummer: '#1093', betrag_eur: 31.20, notiz: '2. Etage links',
      lat: 50.7699, lng: 6.0912,
    },
    {
      stopp_id: 's4', stopp_nr: 4, kunde_name: 'Tom Berger', adresse: 'Feldgasse 9', plz: '52068', ort: 'Aachen',
      eta_min: 14, status: 'ausstehend', telefon: null, bestellnummer: '#1094', betrag_eur: 42.60, notiz: null,
      lat: 50.7812, lng: 6.0851,
    },
    {
      stopp_id: 's5', stopp_nr: 5, kunde_name: 'Lisa Kranz', adresse: 'Sonnenallee 5', plz: '52070', ort: 'Aachen',
      eta_min: 23, status: 'ausstehend', telefon: '+49 241 1122334', bestellnummer: '#1095', betrag_eur: 19.90, notiz: null,
      lat: 50.7834, lng: 6.0799,
    },
  ],
};

function openNavigation(lat: number, lng: number, adresse: string) {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIos) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }
}

function statusStyle(status: StoppStatus) {
  if (status === 'abgeschlossen') return 'border-green-700 bg-green-950/50';
  if (status === 'aktiv')         return 'border-orange-500 bg-orange-950/60 ring-1 ring-orange-500';
  return 'border-gray-700 bg-gray-800';
}

function numBadge(nr: number, status: StoppStatus) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0';
  if (status === 'abgeschlossen') return <div className={`${base} bg-green-600 text-white`}><CheckCircle2 className="w-4 h-4" /></div>;
  if (status === 'aktiv')         return <div className={`${base} bg-orange-500 text-white animate-pulse`}>{nr}</div>;
  return <div className={`${base} bg-gray-700 text-gray-400`}>{nr}</div>;
}

export function Phase1097TourStoppNavigationHubV2({ driverId }: { driverId: string | null }) {
  const [data, setData] = useState<TourData | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    if (!driverId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/fahrer/aktuelle-tour?fahrer_id=${driverId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  async function confirmDelivery(stoppId: string) {
    setConfirming(stoppId);
    try {
      await fetch('/api/delivery/fahrer/stopp-bestaetigen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopp_id: stoppId }),
      });
      await load();
    } finally {
      setConfirming(null);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [driverId]);

  if (!data) return <div className="text-gray-400 text-sm p-4 text-center">Lade Tour…</div>;

  const progressPct = data.gesamt_stopps > 0
    ? Math.round((data.fertig_stopps / data.gesamt_stopps) * 100)
    : 0;

  return (
    <div className="bg-gray-950 min-h-screen p-4 space-y-4">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-orange-400" />
            <span className="text-white font-semibold">{data.fahrer_name}</span>
          </div>
          <span className="text-sm text-orange-400 font-mono">{data.fertig_stopps}/{data.gesamt_stopps} Stopps</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 text-right mt-1">{progressPct}% abgeschlossen</p>
      </div>

      {/* Stopp-Liste */}
      <div className="space-y-3">
        {data.stopps.map(stopp => (
          <div key={stopp.stopp_id} className={`rounded-xl border p-3 ${statusStyle(stopp.status)}`}>
            {/* Top Row */}
            <div className="flex items-start gap-3">
              {numBadge(stopp.stopp_nr, stopp.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">{stopp.kunde_name}</p>
                  <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">{stopp.bestellnummer}</span>
                </div>
                <p className="text-[11px] text-gray-400 truncate">{stopp.adresse}, {stopp.plz} {stopp.ort}</p>
                {stopp.notiz && (
                  <p className="text-[10px] text-yellow-400 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {stopp.notiz}
                  </p>
                )}
              </div>
            </div>

            {/* ETA + Betrag */}
            {stopp.status !== 'abgeschlossen' && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                {stopp.eta_min !== null && (
                  <span className="flex items-center gap-1 text-[11px] text-orange-400">
                    <Clock className="w-3.5 h-3.5" /> {stopp.eta_min} min
                  </span>
                )}
                <span className="text-[11px] text-green-400 font-semibold ml-auto">
                  {stopp.betrag_eur.toFixed(2)} €
                </span>
              </div>
            )}

            {/* Action Buttons */}
            {stopp.status !== 'abgeschlossen' && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => openNavigation(stopp.lat, stopp.lng, stopp.adresse)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg font-medium"
                >
                  <Navigation2 className="w-3.5 h-3.5" /> Navigieren
                </button>
                {stopp.telefon && (
                  <a
                    href={`tel:${stopp.telefon}`}
                    className="flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded-lg"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                {stopp.status === 'aktiv' && (
                  <button
                    onClick={() => confirmDelivery(stopp.stopp_id)}
                    disabled={confirming === stopp.stopp_id}
                    className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {stopp.status === 'abgeschlossen' && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-green-500">
                <CheckCircle2 className="w-3 h-3" /> Zugestellt
                <span className="ml-auto text-gray-500">{stopp.betrag_eur.toFixed(2)} €</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alle Stopps fertig */}
      {data.fertig_stopps === data.gesamt_stopps && data.gesamt_stopps > 0 && (
        <div className="bg-green-900 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-300 font-semibold">Tour abgeschlossen!</p>
          <p className="text-[11px] text-green-500 mt-1">Alle {data.gesamt_stopps} Stopps zugestellt</p>
          <button
            onClick={() => window.location.href = '/fahrer/app'}
            className="mt-3 flex items-center justify-center gap-1.5 mx-auto bg-green-700 hover:bg-green-600 text-white text-xs px-4 py-2 rounded-lg"
          >
            <Home className="w-3.5 h-3.5" /> Zur Basis
          </button>
        </div>
      )}
    </div>
  );
}
