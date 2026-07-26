'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Package, ChevronRight, Zap } from 'lucide-react';

interface TourStop {
  stopp_id: string;
  stopp_nr: number;
  adresse: string;
  kunden_name: string;
  eta_min: number | null;
  entfernung_km: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  artikel_count: number;
  kommentar: string | null;
}

interface ApiData {
  tour_id: string;
  naechster_stopp: TourStop | null;
  alle_stopps: TourStop[];
  geliefert_count: number;
  restzeit_tour_min: number;
  tour_score: number;
}

const MOCK: ApiData = {
  tour_id: 't_001',
  geliefert_count: 1,
  restzeit_tour_min: 28,
  tour_score: 88,
  naechster_stopp: {
    stopp_id: 's2',
    stopp_nr: 2,
    adresse: 'Bahnhofsplatz 5, 52062 Aachen',
    kunden_name: 'Laura M.',
    eta_min: 4,
    entfernung_km: 1.2,
    status: 'unterwegs',
    artikel_count: 2,
    kommentar: 'Klingel defekt – anrufen',
  },
  alle_stopps: [
    { stopp_id: 's1', stopp_nr: 1, adresse: 'Hauptstr. 12', kunden_name: 'Jonas K.', eta_min: null, entfernung_km: 0, status: 'geliefert', artikel_count: 3, kommentar: null },
    { stopp_id: 's2', stopp_nr: 2, adresse: 'Bahnhofsplatz 5', kunden_name: 'Laura M.', eta_min: 4,   entfernung_km: 1.2, status: 'unterwegs', artikel_count: 2, kommentar: 'Klingel defekt' },
    { stopp_id: 's3', stopp_nr: 3, adresse: 'Kirchgasse 8',   kunden_name: 'Paul S.',  eta_min: 12,  entfernung_km: 2.8, status: 'ausstehend', artikel_count: 1, kommentar: null },
  ],
};

const NAV_APPS = [
  { name: 'Google Maps', icon: '🗺️', url: (addr: string) => `https://maps.google.com/?q=${encodeURIComponent(addr)}` },
  { name: 'Waze',        icon: '🚗', url: (addr: string) => `https://waze.com/ul?q=${encodeURIComponent(addr)}` },
  { name: 'Apple Maps',  icon: '🍎', url: (addr: string) => `http://maps.apple.com/?q=${encodeURIComponent(addr)}` },
];

export function FahrerPhase3805TourStoppNavigationSmartHub({ fahrerToken }: { fahrerToken?: string }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [showNavi, setShowNavi] = useState(false);

  const load = useCallback(async () => {
    if (!fahrerToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stopp?token=${fahrerToken}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [fahrerToken]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const ns = data.naechster_stopp;
  const progress = data.alle_stopps.length > 0
    ? Math.round((data.geliefert_count / data.alle_stopps.length) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Nächster Stopp – Fokus-Card */}
      {ns && (
        <div className="bg-indigo-600 rounded-xl p-4 text-white space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-indigo-200 text-xs">
                <Zap className="w-3 h-3" /> Stopp {ns.stopp_nr} · {ns.artikel_count} Artikel
                {loading && <span className="w-2 h-2 border border-indigo-300 border-t-transparent rounded-full animate-spin" />}
              </div>
              <p className="text-base font-bold leading-tight">{ns.adresse}</p>
              <p className="text-sm text-indigo-200">{ns.kunden_name}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {ns.eta_min !== null && (
                <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm font-bold">{ns.eta_min} min</span>
                </div>
              )}
              <span className="text-xs text-indigo-200">{ns.entfernung_km.toFixed(1)} km</span>
            </div>
          </div>

          {/* Kommentar */}
          {ns.kommentar && (
            <div className="bg-white/10 rounded-lg px-3 py-2 text-xs text-indigo-100 flex items-center gap-1.5">
              <span>⚠️</span> {ns.kommentar}
            </div>
          )}

          {/* Navigations-Buttons */}
          <div className="flex gap-2">
            {NAV_APPS.map(app => (
              <a
                key={app.name}
                href={app.url(ns.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-lg py-2 text-xs font-medium transition-colors"
              >
                <span>{app.icon}</span>
                <span className="hidden sm:inline">{app.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tour-Fortschritt */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Tour-Fortschritt
          </span>
          <span className="text-gray-500">{data.geliefert_count}/{data.alle_stopps.length} · ~{data.restzeit_tour_min} min</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{progress}% abgeschlossen</span>
          <span>Score {data.tour_score}/100</span>
        </div>
      </div>

      {/* Alle Stopps – Kompaktliste */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-gray-500" /> Alle Stopps
        </span>
        <div className="space-y-1.5">
          {data.alle_stopps.map(s => (
            <div
              key={s.stopp_id}
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs
                ${s.status === 'geliefert'  ? 'bg-emerald-50 border-emerald-200'  :
                  s.status === 'unterwegs'  ? 'bg-indigo-50  border-indigo-200 ring-1 ring-indigo-300' :
                                              'bg-gray-50    border-gray-200'}`}
            >
              {s.status === 'geliefert'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                : s.status === 'unterwegs'
                ? <Navigation className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
                : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
              <span className="flex-1 font-medium text-gray-800 truncate">{s.adresse}</span>
              <span className="text-gray-400 shrink-0">
                {s.status === 'unterwegs' && s.eta_min !== null ? `${s.eta_min} min` :
                 s.status === 'ausstehend' && s.eta_min !== null ? `~${s.eta_min} min` : ''}
              </span>
              {s.status !== 'geliefert' && (
                <a
                  href={NAV_APPS[0].url(s.adresse)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1 rounded-md hover:bg-indigo-100"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
