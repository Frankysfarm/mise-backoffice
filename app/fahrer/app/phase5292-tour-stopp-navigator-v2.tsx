'use client';

import { useEffect, useState } from 'react';
import { MapPin, Phone, Navigation, CheckCircle2, Clock, WifiOff, ChevronRight } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min: number | null;
  notiz: string | null;
}

const MOCK: TourStop[] = [
  { id: '1', reihenfolge: 1, adresse: 'Pontstraße 3, 52062 Aachen', kunde_name: 'Marie Schmidt', telefon: '+4924112345', bestellnummer: '#1042', status: 'angekommen', eta_min: 0, notiz: 'Klingel defekt — anrufen!' },
  { id: '2', reihenfolge: 2, adresse: 'Jülicher Str. 7, 52070 Aachen', kunde_name: 'Tom Bauer', telefon: '+4924198765', bestellnummer: '#1043', status: 'ausstehend', eta_min: 8, notiz: null },
  { id: '3', reihenfolge: 3, adresse: 'Berliner Ring 12, 52072 Aachen', kunde_name: 'Lena Weber', telefon: null, bestellnummer: '#1044', status: 'ausstehend', eta_min: 18, notiz: '3. OG links' },
];

function statusLabel(s: TourStop['status']): { label: string; color: string; bg: string } {
  switch (s) {
    case 'abgeliefert': return { label: 'Abgeliefert', color: 'text-green-400', bg: 'bg-green-900/30' };
    case 'angekommen':  return { label: 'Angekommen', color: 'text-yellow-300', bg: 'bg-yellow-900/30' };
    case 'unterwegs':   return { label: 'Unterwegs', color: 'text-blue-300', bg: 'bg-blue-900/30' };
    default:            return { label: 'Ausstehend', color: 'text-gray-400', bg: 'bg-gray-800/40' };
  }
}

function openMaps(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  window.open(`https://maps.google.com/?q=${encoded}`, '_blank', 'noopener');
}

export function FahrerPhase5292TourStoppNavigatorV2({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [stops, setStops] = useState<TourStop[] | null>(null);

  async function load() {
    const params = new URLSearchParams({ driver_id: driverId });
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/fahrer/tour-stops?${params}`).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setStops(Array.isArray(json) ? json : json.stops ?? json.stopps ?? MOCK);
    } else {
      setStops(MOCK);
    }
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Tour-Stopps — offline</span>
      </div>
    );
  }

  if (!stops?.length) return null;

  const pending = stops.filter(s => s.status !== 'abgeliefert');
  const done = stops.filter(s => s.status === 'abgeliefert').length;
  const next = stops.find(s => s.status === 'angekommen' || s.status === 'unterwegs' || s.status === 'ausstehend');

  return (
    <div className="rounded-2xl border border-matcha-700/60 bg-matcha-950/30 mb-3 overflow-hidden">
      <div className="px-4 py-3 border-b border-matcha-800/40 bg-matcha-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-matcha-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-200">Tour-Stopps Navigator</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-full">
          {done}/{stops.length} erledigt
        </span>
      </div>

      <div className="px-4 py-2">
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden mb-3 mt-1">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${stops.length ? (done / stops.length) * 100 : 0}%` }}
          />
        </div>

        {next && (
          <div className="rounded-xl border border-yellow-700/60 bg-yellow-950/30 px-3 py-2.5 mb-3">
            <div className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider mb-1">Nächster Stopp</div>
            <div className="text-sm font-bold text-gray-100 mb-0.5">{next.kunde_name ?? 'Kunde'}</div>
            <div className="text-xs text-gray-400 mb-2">{next.adresse}</div>
            {next.notiz && (
              <div className="text-xs text-yellow-300 bg-yellow-900/20 rounded px-2 py-1 mb-2">{next.notiz}</div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openMaps(next.adresse)}
                className="flex items-center gap-1.5 bg-matcha-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-matcha-600"
              >
                <Navigation className="w-3.5 h-3.5" />
                Navigation starten
              </button>
              {next.telefon && (
                <a
                  href={`tel:${next.telefon}`}
                  className="flex items-center gap-1.5 bg-gray-700 text-gray-200 text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-gray-600"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Anrufen
                </a>
              )}
              {next.eta_min != null && next.eta_min > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                  <Clock className="w-3 h-3" />{next.eta_min} Min
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {stops.map((stop, i) => {
            const st = statusLabel(stop.status);
            const isActive = stop.status === 'angekommen' || stop.status === 'unterwegs';
            return (
              <div
                key={stop.id}
                className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${
                  isActive ? 'bg-yellow-900/20 border border-yellow-800/40' : 'bg-gray-800/30'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                  stop.status === 'abgeliefert' ? 'bg-green-700 text-green-100' :
                  isActive ? 'bg-yellow-700 text-yellow-100' : 'bg-gray-700 text-gray-400'
                }`}>
                  {stop.status === 'abgeliefert' ? <CheckCircle2 className="w-3.5 h-3.5" /> : stop.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200 truncate">{stop.kunde_name ?? stop.bestellnummer}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${st.color} ${st.bg}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">{stop.adresse}</div>
                  {stop.notiz && (
                    <div className="text-[10px] text-yellow-400 mt-0.5 truncate">{stop.notiz}</div>
                  )}
                </div>
                {!isActive && stop.status !== 'abgeliefert' && (
                  <button
                    onClick={() => openMaps(stop.adresse)}
                    className="shrink-0 p-1 rounded-lg bg-gray-700/50 text-gray-400 active:bg-gray-600"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
