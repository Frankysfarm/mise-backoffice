'use client';
import { useEffect, useState } from 'react';
import { MapPin, Phone, Navigation, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface TourStopp {
  nr: number;
  kunden_name: string;
  adresse: string;
  eta_min: number | null;
  notiz: string | null;
  telefon: string | null;
  status: 'pending' | 'on_way' | 'delivered';
  zeitfenster_start?: string | null;
  zeitfenster_ende?: string | null;
  entfernung_m?: number | null;
}

interface ApiData {
  tour_id: string;
  stopps: TourStopp[];
  aktiver_stopp_nr: number | null;
  tour_fortschritt_pct: number;
  naechster_stopp_eta_min: number | null;
}

const MOCK: ApiData = {
  tour_id: 'tour_42',
  aktiver_stopp_nr: 2,
  tour_fortschritt_pct: 40,
  naechster_stopp_eta_min: 8,
  stopps: [
    { nr: 1, kunden_name: 'Anna B.', adresse: 'Hauptstr. 12, Berlin', eta_min: null, notiz: null, telefon: '+4915123456789', status: 'delivered', entfernung_m: null },
    { nr: 2, kunden_name: 'Marco T.', adresse: 'Lindenstr. 5, Berlin', eta_min: 8, notiz: '4. OG, kein Aufzug', telefon: '+4917098765432', status: 'on_way', entfernung_m: 1200 },
    { nr: 3, kunden_name: 'Sara K.', adresse: 'Parkweg 8, Berlin', eta_min: 21, notiz: null, telefon: null, status: 'pending', entfernung_m: 2800 },
    { nr: 4, kunden_name: 'Dieter F.', adresse: 'Birkenallee 3, Berlin', eta_min: 35, notiz: 'Bitte klingeln: Müller', telefon: null, status: 'pending', entfernung_m: 4100 },
  ],
};

function statusColor(s: TourStopp['status']) {
  if (s === 'delivered') return 'bg-emerald-500';
  if (s === 'on_way') return 'bg-blue-500';
  return 'bg-stone-200';
}

function openNavigation(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.open(`maps://maps.apple.com/?daddr=${encoded}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?daddr=${encoded}`, '_blank');
  }
}

export function FahrerPhase2467TourStopsNavigationLiveKommando({
  fahrerSchichtId,
  isOnline = true,
}: {
  fahrerSchichtId?: string | null;
  isOnline?: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expandedNr, setExpandedNr] = useState<number | null>(MOCK.aktiver_stopp_nr);

  async function load() {
    if (!fahrerSchichtId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/fahrer/aktive-tour?schicht_id=${fahrerSchichtId}`);
      if (r.ok) {
        const json = await r.json();
        if (json?.stopps?.length) {
          setData(json);
          setExpandedNr(json.aktiver_stopp_nr ?? null);
        }
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fahrerSchichtId, isOnline]);

  const erledigte = data.stopps.filter(s => s.status === 'delivered').length;
  const gesamt = data.stopps.length;
  const aktiverStopp = data.stopps.find(s => s.nr === data.aktiver_stopp_nr);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-stone-600" />
          <span className="font-semibold text-sm text-stone-800">Tour-Stops</span>
          <span className="text-xs text-stone-500">{erledigte}/{gesamt} erledigt</span>
        </div>
        {data.naechster_stopp_eta_min != null && (
          <div className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            <Clock size={11} />
            <span>ETA {data.naechster_stopp_eta_min} Min</span>
          </div>
        )}
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-stone-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${data.tour_fortschritt_pct}%` }}
        />
      </div>

      {/* Stop-Dots Übersicht */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-stone-50">
        {data.stopps.map(s => (
          <button
            key={s.nr}
            onClick={() => setExpandedNr(expandedNr === s.nr ? null : s.nr)}
            className={`relative w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
              s.nr === data.aktiver_stopp_nr
                ? 'border-blue-500 bg-blue-500 text-white scale-125'
                : s.status === 'delivered'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-stone-300 bg-white text-stone-400'
            }`}
          >
            {s.status === 'delivered' ? '✓' : s.nr}
          </button>
        ))}
        <span className="text-xs text-stone-400 ml-1">{data.tour_fortschritt_pct}%</span>
      </div>

      {/* Stop List */}
      <div className="divide-y divide-stone-50">
        {data.stopps.map(stopp => {
          const isActive = stopp.nr === data.aktiver_stopp_nr;
          const isExpanded = expandedNr === stopp.nr;

          return (
            <div key={stopp.nr} className={isActive ? 'bg-blue-50' : ''}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedNr(isExpanded ? null : stopp.nr)}
              >
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${statusColor(stopp.status)}`}>
                  {stopp.status === 'delivered' ? '✓' : stopp.nr}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm truncate ${isActive ? 'text-blue-800' : 'text-stone-800'}`}>
                      {stopp.kunden_name}
                    </span>
                    {isActive && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full shrink-0">Jetzt</span>}
                    {stopp.notiz && <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-stone-500 truncate mt-0.5">{stopp.adresse}</p>
                </div>

                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {stopp.eta_min != null && stopp.status !== 'delivered' && (
                    <span className="text-xs text-stone-500">{stopp.eta_min} Min</span>
                  )}
                  {stopp.entfernung_m != null && stopp.status !== 'delivered' && (
                    <span className="text-[10px] text-stone-400">
                      {stopp.entfernung_m >= 1000 ? `${(stopp.entfernung_m / 1000).toFixed(1)} km` : `${stopp.entfernung_m} m`}
                    </span>
                  )}
                </div>

                {isExpanded ? <ChevronUp size={13} className="text-stone-400 shrink-0" /> : <ChevronDown size={13} className="text-stone-400 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 bg-stone-50">
                  {stopp.notiz && (
                    <div className="flex items-start gap-1.5 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <AlertTriangle size={11} className="text-amber-600 mt-0.5 shrink-0" />
                      <span className="text-amber-800">{stopp.notiz}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openNavigation(stopp.adresse)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg py-2 active:bg-blue-700"
                    >
                      <Navigation size={13} />
                      Navigation starten
                    </button>
                    {stopp.telefon && (
                      <a
                        href={`tel:${stopp.telefon}`}
                        className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-stone-100 text-stone-700 rounded-lg px-3 py-2 active:bg-stone-200"
                      >
                        <Phone size={13} />
                        Anrufen
                      </a>
                    )}
                  </div>
                  {stopp.zeitfenster_ende && (
                    <p className="text-xs text-stone-400">
                      Zeitfenster: {stopp.zeitfenster_start ?? '—'} – {stopp.zeitfenster_ende}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
