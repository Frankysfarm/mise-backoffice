'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, ChevronDown, ChevronUp, Phone, MapPin, Clock, CheckCircle } from 'lucide-react';

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

const MOCK_STOPS: TourStop[] = [
  { id: 's1', reihenfolge: 1, adresse: 'Musterstraße 12, 10115 Berlin', kunde_name: 'Schmidt, H.', telefon: '+49 30 12345', bestellnummer: '2401', status: 'unterwegs', eta_min: 8, notiz: null },
  { id: 's2', reihenfolge: 2, adresse: 'Hauptstr. 55, 10117 Berlin', kunde_name: 'Müller, K.', telefon: '+49 30 87654', bestellnummer: '2402', status: 'ausstehend', eta_min: 18, notiz: null },
  { id: 's3', reihenfolge: 3, adresse: 'Berliner Allee 3, 10119 Berlin', kunde_name: 'Weber, S.', telefon: null, bestellnummer: '2403', status: 'ausstehend', eta_min: 26, notiz: 'Klingel 3. OG' },
];

const STATUS_CHIP: Record<TourStop['status'], { label: string; className: string }> = {
  ausstehend: { label: 'Ausstehend', className: 'bg-gray-700 text-gray-300' },
  unterwegs: { label: 'Unterwegs', className: 'bg-blue-900 text-blue-300' },
  angekommen: { label: 'Angekommen', className: 'bg-yellow-900 text-yellow-300' },
  abgeliefert: { label: 'Abgeliefert', className: 'bg-green-900 text-green-300' },
};

interface Props {
  driverId: string;
  locationId: string;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase2052TourStoppNavigationsPro({ driverId, locationId, isOnline, className = '' }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [loading, setLoading] = useState(false);
  const [usedMock, setUsedMock] = useState(false);

  const fetchStops = useCallback(async () => {
    if (!isOnline) {
      setStops(MOCK_STOPS);
      setUsedMock(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: TourStop[] = await res.json();
      setStops(data);
      setUsedMock(false);
    } catch {
      setStops(MOCK_STOPS);
      setUsedMock(true);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    fetchStops();
    const id = setInterval(fetchStops, 15_000);
    return () => clearInterval(id);
  }, [fetchStops]);

  const active = stops.find(s => s.status === 'unterwegs' || s.status === 'angekommen') ?? stops[0] ?? null;
  const upcoming = stops.filter(s => s !== active && s.status === 'ausstehend').slice(0, 2);
  const done = stops.filter(s => s.status === 'abgeliefert').length;
  const total = stops.length;

  const mapsUrl = active ? `https://maps.google.com/?q=${encodeURIComponent(active.adresse)}` : '#';
  const wazeUrl = active ? `https://waze.com/ul?q=${encodeURIComponent(active.adresse)}` : '#';

  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 text-gray-100 shadow-lg ${className}`}>
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Navigation size={18} className="text-blue-400" />
          <span className="font-semibold text-sm tracking-wide">Tour-Stopp Navigation Pro</span>
          {loading && <span className="ml-1 h-2 w-2 rounded-full bg-blue-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{done}/{total} Stopps</span>
          {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {!isOnline && (
            <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300 font-medium">
              Offline — Letzte bekannte Daten werden angezeigt
            </div>
          )}
          {usedMock && isOnline && (
            <div className="rounded-lg bg-yellow-950 border border-yellow-800 px-3 py-2 text-xs text-yellow-300">
              Vorschaudaten (API nicht erreichbar)
            </div>
          )}

          {active && (
            <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Aktueller Stopp</p>
                  <p className="text-lg font-bold leading-tight">{active.adresse}</p>
                  {active.kunde_name && (
                    <p className="text-sm text-gray-300 mt-0.5">{active.kunde_name}</p>
                  )}
                  {active.bestellnummer && (
                    <p className="text-xs text-gray-500 mt-0.5">Bestellung #{active.bestellnummer}</p>
                  )}
                  {active.notiz && (
                    <p className="text-xs text-yellow-400 mt-1 italic">{active.notiz}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CHIP[active.status].className}`}>
                    {STATUS_CHIP[active.status].label}
                  </span>
                  {active.eta_min != null && (
                    <span className="flex items-center gap-1 text-xs text-blue-300 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">
                      <Clock size={11} />
                      {active.eta_min} Min
                    </span>
                  )}
                </div>
              </div>

              {active.telefon && (
                <a
                  href={`tel:${active.telefon}`}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Phone size={14} />
                  {active.telefon}
                </a>
              )}

              <div className="flex gap-2 pt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium py-2 text-center transition-colors"
                >
                  Google Maps
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium py-2 text-center transition-colors"
                >
                  Waze
                </a>
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Nächste Stopps</p>
              {upcoming.map(stop => (
                <div key={stop.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-800/60 border border-gray-700/60 px-3 py-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate">{stop.adresse}</p>
                      {stop.kunde_name && (
                        <p className="text-xs text-gray-500">{stop.kunde_name}</p>
                      )}
                      {stop.notiz && (
                        <p className="text-xs text-yellow-500 italic">{stop.notiz}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CHIP[stop.status].className}`}>
                      {STATUS_CHIP[stop.status].label}
                    </span>
                    {stop.eta_min != null && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={10} />
                        {stop.eta_min} Min
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Fortschritt</span>
              <span>{done} / {total} abgeliefert</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
