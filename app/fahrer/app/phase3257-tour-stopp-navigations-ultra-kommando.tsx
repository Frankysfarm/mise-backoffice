'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Phone, Package } from 'lucide-react';

interface Stopp {
  nr: number;
  adresse: string;
  kunde: string;
  telefon: string | null;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  pakete: number;
  bestellnummer: string;
  kommentar: string | null;
}

interface ApiData {
  stopps: Stopp[];
  tour_nr: number;
  fortschritt_pct: number;
  eta_rueckkehr_min: number | null;
  geliefert: number;
  gesamt: number;
}

const MOCK: ApiData = {
  tour_nr: 3,
  fortschritt_pct: 40,
  eta_rueckkehr_min: 35,
  geliefert: 2,
  gesamt: 5,
  stopps: [
    { nr: 1, adresse: 'Hauptstr. 12', kunde: 'Tom H.', telefon: '+49 160 1234567', status: 'geliefert', eta_min: null, pakete: 1, bestellnummer: '#5001', kommentar: null },
    { nr: 2, adresse: 'Bahnhofstr. 5', kunde: 'Lea S.', telefon: null, status: 'geliefert', eta_min: null, pakete: 2, bestellnummer: '#5002', kommentar: null },
    { nr: 3, adresse: 'Gartenweg 8', kunde: 'Kai B.', telefon: '+49 170 9876543', status: 'unterwegs', eta_min: 5, pakete: 1, bestellnummer: '#5003', kommentar: 'Klingel defekt — anrufen!' },
    { nr: 4, adresse: 'Ringstr. 22', kunde: 'Nina M.', telefon: null, status: 'offen', eta_min: 18, pakete: 3, bestellnummer: '#5004', kommentar: null },
    { nr: 5, adresse: 'Bergweg 7', kunde: 'Jan K.', telefon: null, status: 'offen', eta_min: 30, pakete: 1, bestellnummer: '#5005', kommentar: null },
  ],
};

function navUrl(adresse: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase3257TourStoppNavigationsUltraKommando({ fahrerId }: { fahrerId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/tour-stopps?fahrer_id=${fahrerId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (fahrerId) load(); else setData(MOCK);
    const p = setInterval(load, 15_000);
    return () => clearInterval(p);
  }, [fahrerId]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const aktuellerStopp = d.stopps.find(s => s.status === 'unterwegs') ?? null;
  const naechste = d.stopps.filter(s => s.status === 'offen');

  return (
    <div className="bg-gray-950 min-h-screen px-4 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tour #{d.tour_nr}</p>
          <p className="text-lg font-black text-white">{d.geliefert}/{d.gesamt} Stopps</p>
        </div>
        {d.eta_rueckkehr_min !== null && (
          <div className="text-right">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Rückkehr</p>
            <p className="text-base font-bold text-blue-400">{d.eta_rueckkehr_min} Min</p>
          </div>
        )}
      </div>

      {/* Fortschrittsbalken */}
      <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400">Tour-Fortschritt</span>
          <span className="text-[10px] font-bold text-white">{d.fortschritt_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all duration-700" style={{ width: `${d.fortschritt_pct}%` }} />
        </div>
      </div>

      {/* Aktueller Stopp (Hero) */}
      {aktuellerStopp && (
        <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Aktueller Stopp #{aktuellerStopp.nr}</span>
            {aktuellerStopp.eta_min !== null && (
              <span className="ml-auto flex items-center gap-1 text-sm font-black text-blue-300">
                <Clock className="h-4 w-4" />{aktuellerStopp.eta_min} Min
              </span>
            )}
          </div>

          <div>
            <p className="text-xl font-black text-white leading-tight">{aktuellerStopp.adresse}</p>
            <p className="text-sm text-gray-300 mt-0.5">{aktuellerStopp.kunde} · {aktuellerStopp.bestellnummer}</p>
            {aktuellerStopp.kommentar && (
              <p className="mt-1 text-xs text-amber-300 bg-amber-900/30 rounded px-2 py-1">{aktuellerStopp.kommentar}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Package className="h-3.5 w-3.5" />{aktuellerStopp.pakete} Paket{aktuellerStopp.pakete !== 1 ? 'e' : ''}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={navUrl(aktuellerStopp.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 transition-colors"
            >
              <Navigation className="h-4 w-4" />Navi
            </a>
            {aktuellerStopp.telefon && (
              <a
                href={`tel:${aktuellerStopp.telefon}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2.5 transition-colors"
              >
                <Phone className="h-4 w-4" />Anrufen
              </a>
            )}
            {!aktuellerStopp.telefon && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-700 text-white text-sm font-bold py-2.5">
                <CheckCircle2 className="h-4 w-4" />Zugestellt
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nächste Stopps */}
      {naechste.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900">
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm font-bold text-white">Nächste Stopps ({naechste.length})</span>
            {showAll ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </button>
          {showAll && (
            <div className="border-t border-gray-700 divide-y divide-gray-800">
              {naechste.map(stopp => (
                <div key={stopp.nr} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-gray-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{stopp.nr}. {stopp.adresse}</p>
                    <p className="text-[10px] text-gray-500">{stopp.bestellnummer} · {stopp.pakete} Pak.</p>
                  </div>
                  {stopp.eta_min !== null && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                      <MapPin className="h-3 w-3" />{stopp.eta_min}m
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Abgeschlossene Stopps */}
      {d.geliefert > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          {d.geliefert} Stopp{d.geliefert !== 1 ? 's' : ''} erfolgreich abgeschlossen
        </div>
      )}
    </div>
  );
}
