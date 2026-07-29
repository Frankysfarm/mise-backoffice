'use client';

import { useEffect, useState } from 'react';
import { Navigation2, CheckCircle2, Clock, MapPin, Phone, AlertTriangle, Zap, CreditCard, Banknote, WifiOff, Gauge, Route, ChevronDown, ChevronUp, Star, Package } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  empfaenger_name: string;
  empfaenger_tel: string | null;
  notiz: string | null;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km_bis_stopp: number;
  zahlart: 'bar' | 'karte' | 'online';
  betrag: number;
  verspaetet_min: number | null;
  navi_url_google: string;
  navi_url_apple: string;
  traffic_info: string | null;
  anweisungen: string | null;
  kundenbewertung: number | null;
}

interface ApiResponse {
  tour_id: string;
  fahrer_name: string;
  stopps: TourStop[];
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  naechster_stopp: TourStop | null;
  tour_score: number;
  alert: string | null;
  online: boolean;
  speed_kmh: number | null;
  route_effizienz_pct: number;
  verdienst_heute: number;
  trinkgeld_heute: number;
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-044',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 15.2,
  km_gefahren: 4.1,
  tour_score: 88,
  alert: null,
  online: true,
  speed_kmh: 28,
  route_effizienz_pct: 86,
  verdienst_heute: 74.50,
  trinkgeld_heute: 8.20,
  naechster_stopp: null,
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1081',
      adresse: 'Hauptstraße 12, 52062 Aachen', empfaenger_name: 'Klaus M.',
      empfaenger_tel: '+4924191234', notiz: null, status: 'geliefert',
      eta_min: null, km_bis_stopp: 1.4, zahlart: 'online', betrag: 22.90,
      verspaetet_min: null, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Hauptstra%C3%9Fe+12+Aachen',
      navi_url_apple: 'maps://?address=Hauptstra%C3%9Fe+12,Aachen',
      anweisungen: '2. Etage, Klingel M.',
      kundenbewertung: 5,
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1082',
      adresse: 'Marktplatz 5, 52062 Aachen', empfaenger_name: 'Lena K.',
      empfaenger_tel: '+4924198765', notiz: 'Klingel kaputt — anrufen!', status: 'aktiv',
      eta_min: 4, km_bis_stopp: 2.2, zahlart: 'karte', betrag: 16.50,
      verspaetet_min: null, traffic_info: 'Stau am Elisenbrunnen +3min',
      navi_url_google: 'https://maps.google.com/?q=Marktplatz+5+Aachen',
      navi_url_apple: 'maps://?address=Marktplatz+5,Aachen',
      anweisungen: null,
      kundenbewertung: null,
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1083',
      adresse: 'Bergweg 8, 52072 Aachen', empfaenger_name: 'Tom B.',
      empfaenger_tel: null, notiz: null, status: 'ausstehend',
      eta_min: 16, km_bis_stopp: 3.8, zahlart: 'bar', betrag: 9.00,
      verspaetet_min: null, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Bergweg+8+Aachen',
      navi_url_apple: 'maps://?address=Bergweg+8,Aachen',
      anweisungen: 'Kasse bar, Wechselgeld bereithalten',
      kundenbewertung: null,
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1084',
      adresse: 'Industriestr. 22, 52068 Aachen', empfaenger_name: 'Büro GmbH',
      empfaenger_tel: '+4924100001', notiz: 'Empfang EG — Rezeption fragen', status: 'ausstehend',
      eta_min: 28, km_bis_stopp: 5.5, zahlart: 'online', betrag: 38.00,
      verspaetet_min: null, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Industriestr.+22+Aachen',
      navi_url_apple: 'maps://?address=Industriestr.+22,Aachen',
      anweisungen: null,
      kundenbewertung: null,
    },
  ],
};

function statusIcon(s: TourStop['status']) {
  if (s === 'geliefert') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (s === 'verspaetet') return <AlertTriangle className="w-4 h-4 text-red-400" />;
  if (s === 'aktiv') return <Navigation2 className="w-4 h-4 text-blue-400 animate-pulse" />;
  return <MapPin className="w-4 h-4 text-gray-500" />;
}

function zahlartIcon(z: TourStop['zahlart']) {
  if (z === 'bar') return <Banknote className="w-3 h-3 text-green-400" />;
  if (z === 'karte') return <CreditCard className="w-3 h-3 text-blue-400" />;
  return <Zap className="w-3 h-3 text-purple-400" />;
}

function scoreColor(s: number) {
  if (s >= 85) return 'text-green-400';
  if (s >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4878SmartTourStoppNavV7() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['o2']));

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/fahrer/aktive-tour');
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!data.online) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Tour-Navigation nicht verfügbar</span>
      </div>
    );
  }

  const aktiv = data.stopps.find(s => s.status === 'aktiv');
  const kmProgress = data.km_gesamt > 0 ? (data.km_gefahren / data.km_gesamt) * 100 : 0;
  const stoppProgress = data.stopps_gesamt > 0 ? (data.stopps_fertig / data.stopps_gesamt) * 100 : 0;

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-blue-950/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-semibold text-blue-300">Smart-Tour-Nav V7</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {data.speed_kmh !== null && (
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" /> {data.speed_kmh} km/h
            </span>
          )}
          <span className="flex items-center gap-1">
            <Route className="w-3 h-3" /> {data.route_effizienz_pct}% Eff.
          </span>
          <span className={`font-bold ${scoreColor(data.tour_score)}`}>
            Score {data.tour_score}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-800/40 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Strip: Progress + Verdienst */}
      <div className="px-4 py-3 border-b border-slate-700 space-y-2">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Stopps: {data.stopps_fertig}/{data.stopps_gesamt}</span>
          <span>Strecke: {data.km_gefahren.toFixed(1)}/{data.km_gesamt.toFixed(1)} km</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stoppProgress}%` }} />
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${kmProgress}%` }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-400 font-semibold">Verdienst: {data.verdienst_heute.toFixed(2)} €</span>
          <span className="text-yellow-400">Trinkgeld: {data.trinkgeld_heute.toFixed(2)} €</span>
        </div>
      </div>

      {/* Active Stop Hero */}
      {aktiv && (
        <div className="px-4 py-3 border-b border-blue-800/40 bg-blue-950/20">
          <div className="text-xs text-blue-400 font-semibold mb-2 flex items-center gap-1.5">
            <Navigation2 className="w-3.5 h-3.5 animate-pulse" />
            Jetzt fahren — Stopp {aktiv.stopp_nr}
          </div>
          <div className="text-sm font-bold text-white mb-1">{aktiv.adresse}</div>
          <div className="text-xs text-slate-400 mb-2">{aktiv.empfaenger_name}</div>
          {aktiv.traffic_info && (
            <div className="flex items-center gap-1.5 text-xs text-orange-300 mb-2">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {aktiv.traffic_info}
            </div>
          )}
          {aktiv.notiz && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-300 mb-2">
              <Package className="w-3 h-3 shrink-0" />
              {aktiv.notiz}
            </div>
          )}
          {aktiv.anweisungen && (
            <div className="text-xs text-slate-400 italic mb-2">{aktiv.anweisungen}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={aktiv.navi_url_google}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs py-1.5 px-3 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              Google Maps
            </a>
            <a
              href={aktiv.navi_url_apple}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
            >
              Apple Maps
            </a>
            {aktiv.empfaenger_tel && (
              <a
                href={`tel:${aktiv.empfaenger_tel}`}
                className="p-1.5 bg-green-800/60 hover:bg-green-700/60 rounded-lg transition-colors"
              >
                <Phone className="w-4 h-4 text-green-400" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="divide-y divide-slate-800/60">
        {data.stopps.map(s => {
          const isExp = expanded.has(s.order_id);
          return (
            <div key={s.order_id}>
              <button
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800/30 transition-colors"
                onClick={() => toggle(s.order_id)}
              >
                <span className="text-xs text-slate-500 w-4">{s.stopp_nr}</span>
                {statusIcon(s.status)}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300 truncate">{s.adresse}</span>
                    {s.kundenbewertung !== null && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: s.kundenbewertung }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span>{s.bestellnummer}</span>
                    {zahlartIcon(s.zahlart)}
                    <span>{s.betrag.toFixed(2)} €</span>
                    {s.eta_min !== null && (
                      <span className={`flex items-center gap-0.5 ${s.verspaetet_min ? 'text-red-400' : 'text-blue-400'}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {s.verspaetet_min ? `+${s.verspaetet_min}m spät` : `${s.eta_min}m`}
                      </span>
                    )}
                    <span>{s.km_bis_stopp.toFixed(1)} km</span>
                  </div>
                </div>
                {isExp ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </button>

              {isExp && (
                <div className="px-4 pb-3 space-y-2">
                  {s.anweisungen && (
                    <div className="text-xs text-slate-400 italic">{s.anweisungen}</div>
                  )}
                  {s.notiz && (
                    <div className="flex items-center gap-1.5 text-xs text-yellow-300">
                      <Package className="w-3 h-3 shrink-0" /> {s.notiz}
                    </div>
                  )}
                  {s.traffic_info && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-300">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {s.traffic_info}
                    </div>
                  )}
                  {s.status !== 'geliefert' && (
                    <div className="flex gap-2">
                      <a
                        href={s.navi_url_google}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs py-1 px-3 bg-blue-700/60 text-blue-200 rounded-lg"
                      >
                        Google Maps
                      </a>
                      <a
                        href={s.navi_url_apple}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs py-1 px-3 bg-slate-700/60 text-slate-200 rounded-lg"
                      >
                        Apple Maps
                      </a>
                      {s.empfaenger_tel && (
                        <a href={`tel:${s.empfaenger_tel}`} className="p-1 bg-green-800/40 rounded-lg">
                          <Phone className="w-3.5 h-3.5 text-green-400" />
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

      <div className="px-4 py-2 bg-slate-800/20 flex justify-between items-center">
        <span className="text-[10px] text-slate-500">Tour {data.tour_id} · 20-Sek-Polling</span>
        <span className="text-[10px] text-slate-500">{data.fahrer_name}</span>
      </div>
    </div>
  );
}
