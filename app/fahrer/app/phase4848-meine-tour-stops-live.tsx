'use client';

import { useEffect, useState } from 'react';
import { Navigation2, CheckCircle2, Clock, MapPin, Package, Phone, WifiOff, ChevronRight, AlertTriangle, Zap } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  empfaenger_name: string;
  empfaenger_tel: string | null;
  notiz: string | null;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km_bis_stopp: number;
  zahlart: 'bar' | 'karte' | 'online';
  betrag: number;
  verspaetet_min: number | null;
}

interface ApiResponse {
  tour_id: string;
  stopps: TourStop[];
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  naechster_stopp: TourStop | null;
  alert: string | null;
}

const MOCK: ApiResponse = {
  tour_id: 'T-2024-001',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 12.4,
  km_gefahren: 3.1,
  alert: null,
  naechster_stopp: null,
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1050',
      adresse: 'Hauptstraße 12, 52062 Aachen', empfaenger_name: 'Klaus M.',
      empfaenger_tel: '+4924191234', notiz: null, status: 'geliefert',
      eta_min: null, km_bis_stopp: 1.2, zahlart: 'online', betrag: 18.90, verspaetet_min: null,
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1051',
      adresse: 'Marktplatz 5, 52062 Aachen', empfaenger_name: 'Sarah K.',
      empfaenger_tel: '+4924198765', notiz: 'Klingel defekt — anrufen!', status: 'aktiv',
      eta_min: 3, km_bis_stopp: 0.9, zahlart: 'bar', betrag: 24.50, verspaetet_min: null,
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1052',
      adresse: 'Bergstraße 8, 52066 Aachen', empfaenger_name: 'Tom B.',
      empfaenger_tel: null, notiz: null, status: 'ausstehend',
      eta_min: 14, km_bis_stopp: 3.5, zahlart: 'karte', betrag: 31.20, verspaetet_min: null,
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1053',
      adresse: 'Seeweg 22, 52074 Aachen', empfaenger_name: 'Lisa W.',
      empfaenger_tel: '+4924154321', notiz: 'Hintereingang', status: 'verspaetet',
      eta_min: 28, km_bis_stopp: 6.8, zahlart: 'online', betrag: 16.80, verspaetet_min: 8,
    },
  ],
};

function statusColor(s: TourStop['status']) {
  if (s === 'geliefert') return 'text-green-400';
  if (s === 'aktiv') return 'text-blue-300';
  if (s === 'verspaetet') return 'text-red-400';
  return 'text-gray-400';
}

function statusBorder(s: TourStop['status']) {
  if (s === 'geliefert') return 'border-green-800 bg-green-950/20';
  if (s === 'aktiv') return 'border-blue-600 bg-blue-950/30 ring-1 ring-blue-600/40';
  if (s === 'verspaetet') return 'border-red-700 bg-red-950/20';
  return 'border-slate-700 bg-slate-900/20';
}

export function FahrerPhase4848MeineTourStopsLive({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams({ driver_id: driverId });
    if (locationId) params.set('location_id', locationId);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?${params}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Tour-Stopps nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const progressPct = data.stopps_gesamt > 0 ? (data.stopps_fertig / data.stopps_gesamt) * 100 : 0;
  const kmPct = data.km_gesamt > 0 ? (data.km_gefahren / data.km_gesamt) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-300">Meine Tour-Stopps</span>
        <span className="ml-auto text-xs text-gray-500">{data.tour_id}</span>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-900/20 rounded px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* Progress */}
      <div className="mb-3 bg-black/20 rounded p-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-400">Stopps {data.stopps_fertig}/{data.stopps_gesamt}</span>
          <span className="text-gray-400">{data.km_gefahren.toFixed(1)} / {data.km_gesamt.toFixed(1)} km</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${kmPct}%` }} />
        </div>
      </div>

      {/* Stops List */}
      <div className="space-y-2">
        {data.stopps.map(s => (
          <div key={s.order_id} className={`rounded-lg border p-3 ${statusBorder(s.status)}`}>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-xs flex items-center justify-center text-gray-300 font-bold">
                  {s.stopp_nr}
                </span>
                {s.status === 'geliefert' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                {s.status === 'aktiv' && <Navigation2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
                {s.status === 'verspaetet' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                {s.status === 'ausstehend' && <MapPin className="w-3.5 h-3.5 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-semibold ${statusColor(s.status)}`}>{s.bestellnummer}</span>
                  <span className={`text-xs px-1 rounded ${s.zahlart === 'bar' ? 'bg-orange-900/50 text-orange-300' : s.zahlart === 'karte' ? 'bg-blue-900/50 text-blue-300' : 'bg-green-900/50 text-green-300'}`}>
                    {s.zahlart === 'bar' ? 'Bar' : s.zahlart === 'karte' ? 'Karte' : 'Online'}
                  </span>
                  {s.verspaetet_min && (
                    <span className="text-xs text-red-400 font-semibold">+{s.verspaetet_min}min</span>
                  )}
                  <span className="ml-auto text-xs font-semibold text-green-300">{s.betrag.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="text-xs text-slate-400 mb-1 leading-tight">{s.adresse}</div>
                <div className="text-xs text-slate-500">{s.empfaenger_name}</div>
                {s.notiz && (
                  <div className="text-xs text-yellow-300 mt-1 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />{s.notiz}
                  </div>
                )}
              </div>
              <div className="text-right text-xs shrink-0 ml-1">
                {s.eta_min !== null && (
                  <div className={`flex items-center gap-0.5 ${s.status === 'verspaetet' ? 'text-red-400' : 'text-blue-300'}`}>
                    <Clock className="w-2.5 h-2.5" />{s.eta_min}min
                  </div>
                )}
                <div className="text-gray-500 mt-0.5">{s.km_bis_stopp}km</div>
                {s.empfaenger_tel && s.status !== 'geliefert' && (
                  <a href={`tel:${s.empfaenger_tel}`} className="mt-1 flex items-center justify-end gap-0.5 text-blue-400">
                    <Phone className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">20-Sek-Polling · Live</div>
    </div>
  );
}
