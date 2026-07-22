'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface StoppInfo {
  nr: number;
  name: string;
  adresse: string;
  telefon: string | null;
  eta_min: number | null;
  status: 'offen' | 'unterwegs' | 'geliefert';
  notiz: string | null;
}

interface ApiData {
  aktiver_stopp: StoppInfo | null;
  weitere_stopps: StoppInfo[];
  stopps_gesamt: number;
  stopps_erledigt: number;
  lat: number | null;
  lng: number | null;
}

const MOCK: ApiData = {
  aktiver_stopp: {
    nr: 2,
    name: 'Max Müller',
    adresse: 'Gartenweg 8, 10115 Berlin',
    telefon: '+49 151 12345678',
    eta_min: 5,
    status: 'unterwegs',
    notiz: 'Hintereingang nutzen',
  },
  weitere_stopps: [
    { nr: 3, name: 'Sara K.', adresse: 'Lindenstr. 22, 10115 Berlin', telefon: null, eta_min: 14, status: 'offen', notiz: null },
    { nr: 4, name: 'Tim B.', adresse: 'Bahnhofstr. 5, 10115 Berlin', telefon: null, eta_min: 22, status: 'offen', notiz: null },
  ],
  stopps_gesamt: 4,
  stopps_erledigt: 1,
  lat: 52.52,
  lng: 13.405,
};

function mapsUrl(adresse: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}
function wazeUrl(adresse: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase3112NaechsterStoppLiveKommando() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/fahrer/naechster-stopp-live', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  const stopp = data.aktiver_stopp;
  const progress = data.stopps_gesamt > 0 ? (data.stopps_erledigt / data.stopps_gesamt) * 100 : 0;

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Hero-Stopp */}
      {stopp ? (
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="font-semibold text-sm">Stopp {stopp.nr} · ETA {stopp.eta_min !== null ? `${stopp.eta_min} Min` : '—'}</span>
            </div>
            <span className="text-xs bg-white/20 rounded px-2 py-0.5">{data.stopps_erledigt}/{data.stopps_gesamt}</span>
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">{stopp.name}</div>
            <div className="text-sm text-emerald-100">{stopp.adresse}</div>
            {stopp.notiz && (
              <div className="text-xs text-emerald-200 mt-1 italic">{stopp.notiz}</div>
            )}
          </div>
          <div className="flex gap-2">
            <a href={mapsUrl(stopp.adresse)} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-emerald-700 rounded-lg py-2 text-sm font-semibold">
              <Navigation className="w-4 h-4" /> Maps
            </a>
            <a href={wazeUrl(stopp.adresse)} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 text-white rounded-lg py-2 text-sm font-semibold">
              <Navigation className="w-4 h-4" /> Waze
            </a>
            {stopp.telefon && (
              <a href={`tel:${stopp.telefon}`}
                className="flex items-center justify-center gap-1 bg-white/20 text-white rounded-lg py-2 px-3 text-sm font-semibold">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-100 dark:bg-zinc-800 p-4 text-center text-zinc-500 text-sm">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" /> Alle Stopps erledigt
        </div>
      )}

      {/* Progress */}
      <div className="px-4 pt-3">
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-zinc-500 mt-1">{data.stopps_erledigt} von {data.stopps_gesamt} Stopps erledigt</div>
      </div>

      {/* Weitere Stopps */}
      {data.weitere_stopps.length > 0 && (
        <div className="px-4 pb-3">
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-zinc-500 mt-2 hover:text-zinc-700 dark:hover:text-zinc-300">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {data.weitere_stopps.length} weitere Stopp{data.weitere_stopps.length !== 1 ? 's' : ''}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5">
              {data.weitere_stopps.map((s) => (
                <div key={s.nr} className="flex items-center gap-2 text-xs py-1.5 border-b dark:border-zinc-800 last:border-0">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 shrink-0">{s.nr}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-zinc-400 truncate">{s.adresse}</div>
                  </div>
                  <div className="flex items-center gap-0.5 text-zinc-400 shrink-0">
                    <Clock className="w-3 h-3" /> {s.eta_min}'
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
