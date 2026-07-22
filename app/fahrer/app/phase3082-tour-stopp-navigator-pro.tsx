'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation, Phone } from 'lucide-react';

interface Stopp {
  nr: number;
  adresse: string;
  name: string;
  telefon: string | null;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  notiz: string | null;
}

interface ApiData {
  tour_id: string;
  aktiver_stopp: Stopp | null;
  alle_stopps: Stopp[];
  geliefert: number;
  gesamt: number;
}

const MOCK: ApiData = {
  tour_id: 't1',
  aktiver_stopp: {
    nr: 2, adresse: 'Gartenweg 8, 12345 Berlin', name: 'Max M.', telefon: '+49 170 1234567',
    status: 'unterwegs', eta_min: 6, notiz: 'Klingel kaputt, bitte klopfen',
  },
  alle_stopps: [
    { nr: 1, adresse: 'Hauptstr. 12', name: 'Julia F.', telefon: null, status: 'geliefert', eta_min: null, notiz: null },
    { nr: 2, adresse: 'Gartenweg 8', name: 'Max M.', telefon: '+49 170 1234567', status: 'unterwegs', eta_min: 6, notiz: 'Klingel kaputt' },
    { nr: 3, adresse: 'Lindenstr. 22', name: 'Sara K.', telefon: null, status: 'offen', eta_min: 18, notiz: null },
  ],
  geliefert: 1,
  gesamt: 3,
};

export function FahrerPhase3082TourStoppNavigatorPro({ isOnline, locationId }: { isOnline: boolean; locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isOnline) { setData(null); return; }
    const load = () =>
      fetch(`/api/delivery/fahrer/aktuelle-tour?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!isOnline || !data?.aktiver_stopp) return null;

  const stopp = data.aktiver_stopp;
  const weitereStopps = data.alle_stopps.filter(s => s.nr !== stopp.nr && s.status !== 'geliefert');
  const progressPct = data.gesamt > 0 ? Math.round((data.geliefert / data.gesamt) * 100) : 0;

  const openMaps = (app: 'google' | 'waze') => {
    const addr = encodeURIComponent(stopp.adresse);
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${addr}&navigate=yes`
      : `https://maps.google.com/maps?daddr=${addr}`;
    window.open(url, '_blank');
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-blue-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-white" />
            <span className="font-bold text-sm text-white">Stopp {stopp.nr}/{data.gesamt}</span>
            {stopp.eta_min && (
              <span className="text-blue-200 text-xs">~{stopp.eta_min} min</span>
            )}
          </div>
          <div className="text-xs text-blue-200">{data.geliefert}/{data.gesamt} geliefert</div>
        </div>
        <div className="mt-1.5 w-full bg-blue-800 dark:bg-blue-900 rounded-full h-1">
          <div className="h-1 rounded-full bg-white" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Aktiver Stopp */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight">{stopp.adresse}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{stopp.name}</div>
            {stopp.notiz && (
              <div className="mt-1 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded px-2 py-1 text-yellow-800 dark:text-yellow-400">
                📝 {stopp.notiz}
              </div>
            )}
          </div>
        </div>

        {/* Nav Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openMaps('google')}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            <Navigation size={14} /> Google Maps
          </button>
          <button
            onClick={() => openMaps('waze')}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            <Navigation size={14} /> Waze
          </button>
        </div>

        {stopp.telefon && (
          <a
            href={`tel:${stopp.telefon}`}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Phone size={14} /> {stopp.telefon}
          </a>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-3 transition-colors">
            ✓ Angekommen
          </button>
          <button className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-3 transition-colors">
            ✓ Zugestellt
          </button>
        </div>

        {/* Weitere Stopps */}
        {weitereStopps.length > 0 && (
          <div>
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium py-1"
            >
              {moreOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {weitereStopps.length} weitere Stopp{weitereStopps.length !== 1 ? 's' : ''}
            </button>
            {moreOpen && (
              <div className="mt-1 space-y-1">
                {weitereStopps.map(s => (
                  <div key={s.nr} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                    <span className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 shrink-0">{s.nr}</span>
                    <span className="flex-1 truncate">{s.adresse}</span>
                    {s.eta_min && <span>~{s.eta_min}m</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
