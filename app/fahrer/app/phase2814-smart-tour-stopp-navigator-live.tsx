'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, MapPin, Navigation, Phone, Timer } from 'lucide-react';

interface TourStopp {
  stopp_id: string;
  stopp_nr: number;
  adresse: string;
  empfaenger: string;
  telefon: string | null;
  distanz_m: number;
  eta_min: number;
  abgeschlossen: boolean;
  ist_aktuell: boolean;
  notiz: string | null;
}

interface ApiData {
  tour_id: string;
  stopps: TourStopp[];
  stopps_gesamt: number;
  stopps_erledigt: number;
  naechster_stopp: TourStopp | null;
  navi_url_google: string | null;
  navi_url_waze: string | null;
}

const MOCK: ApiData = {
  tour_id: 't1',
  stopps_gesamt: 4,
  stopps_erledigt: 1,
  naechster_stopp: {
    stopp_id: 's2', stopp_nr: 2,
    adresse: 'Musterstraße 12, 10115 Berlin',
    empfaenger: 'Klaus M.', telefon: '+4917600001234',
    distanz_m: 1420, eta_min: 4,
    abgeschlossen: false, ist_aktuell: true,
    notiz: 'Klingel 3. OG links',
  },
  stopps: [
    { stopp_id: 's1', stopp_nr: 1, adresse: 'Hauptstr. 5, Berlin',       empfaenger: 'Anna S.', telefon: null,            distanz_m: 0,    eta_min: 0,  abgeschlossen: true,  ist_aktuell: false, notiz: null },
    { stopp_id: 's2', stopp_nr: 2, adresse: 'Musterstraße 12, Berlin',    empfaenger: 'Klaus M.', telefon: '+4917600001234', distanz_m: 1420, eta_min: 4,  abgeschlossen: false, ist_aktuell: true,  notiz: 'Klingel 3. OG links' },
    { stopp_id: 's3', stopp_nr: 3, adresse: 'Berliner Allee 44, Berlin',  empfaenger: 'Maria L.', telefon: null,            distanz_m: 3100, eta_min: 11, abgeschlossen: false, ist_aktuell: false, notiz: null },
    { stopp_id: 's4', stopp_nr: 4, adresse: 'Gartenweg 7, Berlin',        empfaenger: 'Tom K.',   telefon: '+4917655556789', distanz_m: 5200, eta_min: 18, abgeschlossen: false, ist_aktuell: false, notiz: null },
  ],
  navi_url_google: null,
  navi_url_waze: null,
};

function fmtDist(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function FahrerPhase2814SmartTourStoppNavigatorLive({ fahrerToken }: { fahrerToken?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const load = () => {
      if (!fahrerToken) { setData(MOCK); return; }
      fetch(`/api/delivery/fahrer/tour-stopps?token=${fahrerToken}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [fahrerToken]);

  if (!data) return null;

  const naechster = data.naechster_stopp;
  const progress = (data.stopps_erledigt / data.stopps_gesamt) * 100;

  const navUrl = naechster
    ? `https://maps.google.com/?q=${encodeURIComponent(naechster.adresse)}&dirflg=d`
    : null;

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-3 mb-3">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-teal-600" />
          <span className="font-semibold text-xs text-gray-800">Smart Tour-Stopp Navigator</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
            {data.stopps_erledigt}/{data.stopps_gesamt} Stopps
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Fortschrittsleiste */}
          <div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400">Start</span>
              <span className="text-[10px] text-gray-400">Ziel</span>
            </div>
          </div>

          {/* Nächster Stopp — Fokus-Karte */}
          {naechster && (
            <div className="rounded-xl bg-teal-50 border border-teal-300 p-3">
              <div className="flex items-center gap-1 mb-1">
                <MapPin size={12} className="text-teal-600" />
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Nächster Stopp #{naechster.stopp_nr}</span>
              </div>
              <div className="text-sm font-semibold text-gray-800 leading-tight">{naechster.adresse}</div>
              <div className="text-xs text-gray-500 mt-0.5">{naechster.empfaenger}</div>
              {naechster.notiz && (
                <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1.5">{naechster.notiz}</div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <Timer size={11} className="text-teal-600" />
                  <span className="text-xs font-bold text-teal-700">{naechster.eta_min} Min.</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin size={11} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{fmtDist(naechster.distanz_m)}</span>
                </div>
                {naechster.telefon && (
                  <a href={`tel:${naechster.telefon}`} className="flex items-center gap-1 ml-auto">
                    <Phone size={11} className="text-blue-500" />
                    <span className="text-[10px] text-blue-600">Anrufen</span>
                  </a>
                )}
              </div>
              {navUrl && (
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-teal-600 text-white text-xs font-semibold rounded-lg py-2"
                >
                  <Navigation size={13} />
                  Navigation starten
                </a>
              )}
            </div>
          )}

          {/* Alle Stopps kompakt */}
          <div className="space-y-1">
            {data.stopps.map(s => (
              <div
                key={s.stopp_id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${s.ist_aktuell ? 'bg-teal-100 border border-teal-300' : 'border border-transparent'}`}
              >
                {s.abgeschlossen
                  ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  : s.ist_aktuell
                    ? <ChevronRight size={14} className="text-teal-600 flex-shrink-0" />
                    : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                }
                <span className={`text-[10px] font-semibold ${s.ist_aktuell ? 'text-teal-700' : s.abgeschlossen ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                  #{s.stopp_nr}
                </span>
                <span className={`text-[10px] flex-1 truncate ${s.abgeschlossen ? 'text-gray-400' : 'text-gray-700'}`}>
                  {s.adresse}
                </span>
                {!s.abgeschlossen && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{s.eta_min} Min.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
