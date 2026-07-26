'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, Package, ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  name: string;
  adresse: string;
  status: 'ausstehend' | 'angefahren' | 'geliefert';
  eta_min: number | null;
  telefon?: string;
  notiz?: string;
  lat?: number;
  lon?: number;
}

interface TourData {
  tour_id: string;
  stopps: Stopp[];
  geliefert: number;
  gesamt: number;
  fahrer_id: string;
}

const MOCK: TourData = {
  tour_id: 'T-4821',
  fahrer_id: 'f1',
  geliefert: 2,
  gesamt: 5,
  stopps: [
    { id: 's1', nr: 1, name: 'Müller, K.',   adresse: 'Hauptstr. 12, Aachen',   status: 'geliefert',  eta_min: null, telefon: '+49 241 12345' },
    { id: 's2', nr: 2, name: 'Schmidt, A.',  adresse: 'Gartenweg 7, Aachen',    status: 'geliefert',  eta_min: null },
    { id: 's3', nr: 3, name: 'Weber, T.',    adresse: 'Lindenstr. 45, Aachen',  status: 'angefahren', eta_min: 4,   telefon: '+49 241 67890', notiz: 'Klingeln 2x, 3. OG' },
    { id: 's4', nr: 4, name: 'Becker, R.',  adresse: 'Am Bach 2, Aachen',      status: 'ausstehend', eta_min: 16 },
    { id: 's5', nr: 5, name: 'Fischer, M.', adresse: 'Seestr. 14, Aachen',     status: 'ausstehend', eta_min: 28,  telefon: '+49 241 11111' },
  ],
};

function statusDot(s: Stopp['status']) {
  if (s === 'geliefert')  return 'bg-emerald-500';
  if (s === 'angefahren') return 'bg-indigo-500 ring-2 ring-indigo-300 animate-pulse';
  return 'bg-gray-300';
}

function mapsUrl(adresse: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

function wazeUrl(adresse: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`;
}

export function FahrerPhase3850TourStoppLiveNavigation({ fahrerId }: { fahrerId: string | null }) {
  const [data, setData] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(MOCK.stopps.find(s => s.status === 'angefahren')?.id ?? null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!fahrerId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/active-tour?fahrer_id=${fahrerId}`);
      if (r.ok) setData(await r.json());
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [fahrerId]);

  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  const aktiv = data.stopps.find(s => s.status === 'angefahren');
  const fortschritt = Math.round((data.geliefert / data.gesamt) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Fortschritt-Header */}
      <div className="bg-indigo-600 px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">Tour {data.tour_id}</span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
          </div>
          <span className="text-xs font-semibold text-indigo-100">{data.geliefert}/{data.gesamt} Stopps</span>
        </div>
        <div className="h-2 bg-indigo-500 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-700"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Aktiver Stopp — Hero */}
      {aktiv && (
        <div className="mx-3 mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Aktueller Stopp</span>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate">{aktiv.name}</p>
              <p className="text-xs text-gray-600 truncate">{aktiv.adresse}</p>
              {aktiv.notiz && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />{aktiv.notiz}
                </p>
              )}
            </div>
            {aktiv.eta_min && (
              <div className="flex flex-col items-center bg-white border border-indigo-200 rounded-lg px-2 py-1 shrink-0">
                <span className="text-[10px] text-indigo-400">ETA</span>
                <span className="text-lg font-black text-indigo-700">{aktiv.eta_min}m</span>
              </div>
            )}
          </div>
          {/* Navi-Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mapsUrl(aktiv.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> Google Maps
            </a>
            <a
              href={wazeUrl(aktiv.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" /> Waze
            </a>
          </div>
          {aktiv.telefon && (
            <a
              href={`tel:${aktiv.telefon}`}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg transition-colors"
            >
              <Phone className="w-3 h-3" /> {aktiv.telefon} anrufen
            </a>
          )}
        </div>
      )}

      {/* Alle Stopps */}
      <div className="px-3 py-2 space-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Alle Stopps</span>
        {data.stopps.map(s => {
          const isOpen = expanded === s.id;
          const isAktiv = s.status === 'angefahren';
          return (
            <div key={s.id} className={`rounded-lg border ${isAktiv ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'} overflow-hidden`}>
              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(s.status)}`} />
                <span className="text-[10px] text-gray-400 w-3 shrink-0">{s.nr}</span>
                <span className={`flex-1 text-xs font-medium truncate ${s.status === 'geliefert' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {s.name}
                </span>
                {s.eta_min && s.status !== 'geliefert' && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5 shrink-0">
                    <Clock className="w-2.5 h-2.5" />{s.eta_min}m
                  </span>
                )}
                {s.status === 'geliefert' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                )}
                {s.status !== 'angefahren' && (s.telefon || s.notiz) && (
                  isOpen ? <ChevronUp className="w-3 h-3 text-gray-300 shrink-0" /> : <ChevronDown className="w-3 h-3 text-gray-300 shrink-0" />
                )}
              </button>
              {isOpen && s.status !== 'angefahren' && (
                <div className="px-2.5 pb-2 space-y-1 text-[10px]">
                  <p className="text-gray-500">{s.adresse}</p>
                  {s.notiz && <p className="text-amber-700">{s.notiz}</p>}
                  {s.status === 'ausstehend' && (
                    <div className="flex gap-2 mt-1.5">
                      <a href={mapsUrl(s.adresse)} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium flex items-center gap-1">
                        <Navigation className="w-2.5 h-2.5" />Maps
                      </a>
                      {s.telefon && (
                        <a href={`tel:${s.telefon}`} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-medium flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />Anrufen
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

      <div className="px-3 pb-2.5 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Tour-Stopps Live</span>
        <span>10-Sek-Polling · Mock-Fallback</span>
      </div>
    </div>
  );
}
