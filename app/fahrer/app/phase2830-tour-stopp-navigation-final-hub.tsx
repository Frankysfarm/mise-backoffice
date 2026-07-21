'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Phone } from 'lucide-react';

interface TourStopp {
  stop_id: string;
  stop_num: number;
  adresse: string;
  kunden_name: string;
  kunden_tel: string | null;
  eta_min: number | null;
  status: 'pending' | 'active' | 'delivered';
  lat: number | null;
  lng: number | null;
}

interface ApiData {
  stopper: TourStopp[];
  tour_id: string | null;
  fortschritt_pct: number;
  aktiver_stop_idx: number;
}

const MOCK: ApiData = {
  tour_id: 't-001',
  fortschritt_pct: 40,
  aktiver_stop_idx: 1,
  stopper: [
    { stop_id: 's1', stop_num: 1, adresse: 'Musterstr. 12, München', kunden_name: 'Thomas B.', kunden_tel: '+4915112345', eta_min: null, status: 'delivered', lat: 48.137, lng: 11.576 },
    { stop_id: 's2', stop_num: 2, adresse: 'Leopoldstr. 45, München', kunden_name: 'Maria S.', kunden_tel: '+4915198765', eta_min: 4, status: 'active', lat: 48.159, lng: 11.582 },
    { stop_id: 's3', stop_num: 3, adresse: 'Schwabing Allee 7, München', kunden_name: 'Jan K.', kunden_tel: null, eta_min: 12, status: 'pending', lat: 48.162, lng: 11.591 },
  ],
};

function openGoogleMaps(adresse: string) {
  const q = encodeURIComponent(adresse);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
}

function openWaze(adresse: string) {
  const q = encodeURIComponent(adresse);
  window.open(`https://waze.com/ul?q=${q}&navigate=yes`, '_blank');
}

export function FahrerPhase2830TourStoppNavigationFinalHub({
  fahrerToken,
}: {
  fahrerToken?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [showNav, setShowNav] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const load = () => {
      if (!fahrerToken) { setData(MOCK); return; }
      fetch(`/api/delivery/fahrer/tour-stops?driver_id=${fahrerToken}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [fahrerToken]);

  if (!data) return null;

  const aktiv = data.stopper.find(s => s.status === 'active');
  const naechste = data.stopper.filter(s => s.status === 'pending');

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-3 mb-3">
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-blue-600" />
          <span className="font-semibold text-sm text-gray-800">Tour-Navigation</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
            {data.fortschritt_pct}% abgeschlossen
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Fortschrittsbalken */}
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${data.fortschritt_pct}%` }} />
          </div>
          <div className="text-[10px] text-gray-400 mb-2">
            {data.stopper.filter(s => s.status === 'delivered').length} / {data.stopper.length} Stopps
          </div>

          {/* Aktiver Stopp — Hero-Card */}
          {aktiv && (
            <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">Aktiver Stopp #{aktiv.stop_num}</span>
                {aktiv.eta_min !== null && (
                  <span className="text-[10px] font-bold text-blue-700 ml-auto">~{aktiv.eta_min} Min</span>
                )}
              </div>
              <div className="flex items-start gap-2 mb-2">
                <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">{aktiv.kunden_name}</div>
                  <div className="text-xs text-gray-600">{aktiv.adresse}</div>
                </div>
              </div>

              {/* Nav Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => openGoogleMaps(aktiv.adresse)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold py-2 active:opacity-80"
                >
                  <Navigation size={12} /> Google Maps
                </button>
                <button
                  onClick={() => openWaze(aktiv.adresse)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold py-2 active:opacity-80"
                >
                  <MapPin size={12} /> Waze
                </button>
                {aktiv.kunden_tel && (
                  <a
                    href={`tel:${aktiv.kunden_tel}`}
                    className="flex items-center justify-center gap-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold px-3 py-2"
                  >
                    <Phone size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Nächste Stopps */}
          {naechste.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Nächste Stopps</div>
              <div className="space-y-1.5">
                {naechste.slice(0, 3).map(s => (
                  <div key={s.stop_id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="text-[10px] font-bold text-gray-400 w-4 shrink-0">#{s.stop_num}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{s.kunden_name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{s.adresse}</div>
                    </div>
                    {s.eta_min !== null && (
                      <span className="text-[10px] font-semibold text-gray-500 shrink-0">~{s.eta_min} Min</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abgeschlossene Stopps */}
          {data.stopper.filter(s => s.status === 'delivered').map(s => (
            <div key={s.stop_id} className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50/60 px-3 py-1.5">
              <CheckCircle2 size={12} className="text-green-500 shrink-0" />
              <span className="text-[10px] text-gray-500 truncate">#{s.stop_num} — {s.kunden_name}</span>
              <span className="text-[9px] text-green-600 font-semibold ml-auto">Geliefert</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
