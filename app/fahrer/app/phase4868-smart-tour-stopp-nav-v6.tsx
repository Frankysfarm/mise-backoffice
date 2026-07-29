'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navigation2, CheckCircle2, Clock, MapPin, Phone, AlertTriangle, Zap, Package, CreditCard, Banknote, Wifi, WifiOff, ChevronRight, Gauge, Route } from 'lucide-react';

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
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-043',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 14.2,
  km_gefahren: 3.6,
  tour_score: 90,
  alert: null,
  online: true,
  speed_kmh: 32,
  route_effizienz_pct: 84,
  naechster_stopp: null,
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1080',
      adresse: 'Hauptstraße 12, 52062 Aachen', empfaenger_name: 'Klaus M.',
      empfaenger_tel: '+4924191234', notiz: null, status: 'geliefert',
      eta_min: null, km_bis_stopp: 1.3, zahlart: 'online', betrag: 19.90,
      verspaetet_min: null, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Hauptstraße+12+Aachen',
      navi_url_apple: 'maps://?q=Hauptstraße+12+Aachen',
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1081',
      adresse: 'Marktplatz 5, 52062 Aachen', empfaenger_name: 'Sarah K.',
      empfaenger_tel: '+4924198765', notiz: 'Klingel defekt — anrufen!', status: 'aktiv',
      eta_min: 3, km_bis_stopp: 0.9, zahlart: 'bar', betrag: 26.50,
      verspaetet_min: null, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Marktplatz+5+Aachen',
      navi_url_apple: 'maps://?q=Marktplatz+5+Aachen',
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1082',
      adresse: 'Bergstraße 8, 52066 Aachen', empfaenger_name: 'Tom B.',
      empfaenger_tel: null, notiz: null, status: 'ausstehend',
      eta_min: 16, km_bis_stopp: 3.9, zahlart: 'karte', betrag: 32.80,
      verspaetet_min: null, traffic_info: '⚠️ Stau Pontstr. +5 Min',
      navi_url_google: 'https://maps.google.com/?q=Bergstraße+8+Aachen',
      navi_url_apple: 'maps://?q=Bergstraße+8+Aachen',
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1083',
      adresse: 'Seeweg 22, 52074 Aachen', empfaenger_name: 'Lisa W.',
      empfaenger_tel: '+4924154321', notiz: 'Hintereingang verwenden', status: 'verspaetet',
      eta_min: 29, km_bis_stopp: 7.1, zahlart: 'online', betrag: 41.00,
      verspaetet_min: 3, traffic_info: null,
      navi_url_google: 'https://maps.google.com/?q=Seeweg+22+Aachen',
      navi_url_apple: 'maps://?q=Seeweg+22+Aachen',
    },
  ],
};

function zahlIcon(z: string) {
  if (z === 'bar') return <Banknote className="w-3 h-3 text-green-400" />;
  if (z === 'karte') return <CreditCard className="w-3 h-3 text-blue-400" />;
  return <Wifi className="w-3 h-3 text-purple-400" />;
}

function zahlLabel(z: string) {
  if (z === 'bar') return 'Bar';
  if (z === 'karte') return 'Karte';
  return 'Online';
}

export function FahrerPhase4868SmartTourStoppNavV6() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/delivery/fahrer/tour-stopps');
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* mock */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const activeStop = data.stopps.find(s => s.status === 'aktiv');
  const progressPct = data.stopps_gesamt > 0 ? Math.round((data.stopps_fertig / data.stopps_gesamt) * 100) : 0;
  const kmProgressPct = data.km_gesamt > 0 ? Math.round((data.km_gefahren / data.km_gesamt) * 100) : 0;

  if (!data.online) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 flex flex-col items-center gap-3">
        <WifiOff className="w-10 h-10 text-slate-600" />
        <span className="text-sm text-slate-400">Offline — Navigation nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-blue-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation2 className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Smart-Tour-Navigator V6</span>
          </div>
          <div className="flex items-center gap-2">
            {data.speed_kmh !== null && (
              <div className="flex items-center gap-1 bg-blue-900/40 px-2 py-1 rounded-full">
                <Gauge className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-300">{data.speed_kmh} km/h</span>
              </div>
            )}
            <span className={`text-sm font-bold ${data.tour_score >= 85 ? 'text-green-400' : data.tour_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.tour_score}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3 space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Stopps</span>
              <span className="text-blue-300">{data.stopps_fertig}/{data.stopps_gesamt}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Kilometer</span>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">{data.km_gefahren.toFixed(1)} / {data.km_gesamt.toFixed(1)} km</span>
                <span className="text-slate-600">·</span>
                <Route className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-400">{data.route_effizienz_pct}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${kmProgressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/30 border-b border-red-800/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Active Stop Hero */}
      {activeStop && (
        <div className="px-4 py-4 bg-blue-950/30 border-b border-blue-800/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Navigation2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white">#{activeStop.stopp_nr} — {activeStop.bestellnummer}</span>
                {activeStop.eta_min !== null && (
                  <span className="flex items-center gap-1 text-blue-300 text-sm">
                    <Clock className="w-3.5 h-3.5" /> {activeStop.eta_min} Min
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-200 mt-1">{activeStop.adresse}</p>
              <p className="text-xs text-slate-400 mt-0.5">{activeStop.empfaenger_name} · {activeStop.km_bis_stopp.toFixed(1)} km</p>
              {activeStop.traffic_info && (
                <div className="mt-1.5 text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{activeStop.traffic_info}
                </div>
              )}
              {activeStop.notiz && (
                <div className="mt-1.5 text-xs text-yellow-300 bg-yellow-950/30 rounded px-2 py-1">
                  📝 {activeStop.notiz}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
                  {zahlIcon(activeStop.zahlart)}
                  <span>{zahlLabel(activeStop.zahlart)} — {activeStop.betrag.toFixed(2)} €</span>
                </div>
                <a href={activeStop.navi_url_google} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Google Maps
                </a>
                <a href={activeStop.navi_url_apple} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Apple Maps
                </a>
                {activeStop.empfaenger_tel && (
                  <a href={`tel:${activeStop.empfaenger_tel}`}
                    className="flex items-center gap-1 text-xs bg-green-800 hover:bg-green-700 text-green-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Phone className="w-3.5 h-3.5" /> Anrufen
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="divide-y divide-slate-800/60">
        {data.stopps.filter(s => s.status !== 'aktiv').map(s => {
          const isOpen = expanded.has(s.order_id);
          const isDone = s.status === 'geliefert';
          const isLate = s.status === 'verspaetet';
          return (
            <div key={s.order_id}>
              <button
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${isDone ? 'opacity-50' : 'hover:bg-slate-800/30'}`}
                onClick={() => !isDone && toggle(s.order_id)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isDone ? 'bg-green-900/50 text-green-400' : isLate ? 'bg-red-900/50 text-red-400' : 'bg-slate-800 text-slate-300'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.stopp_nr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                      {s.bestellnummer}
                    </span>
                    {isLate && s.verspaetet_min && (
                      <span className="text-[10px] text-red-400">+{s.verspaetet_min} Min</span>
                    )}
                    {s.traffic_info && !isDone && (
                      <span className="text-[10px] text-amber-400 truncate">{s.traffic_info}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.adresse}</p>
                </div>
                <div className="text-right shrink-0">
                  {s.eta_min !== null && !isDone && (
                    <span className="text-xs text-slate-400">{s.eta_min} Min</span>
                  )}
                  {!isDone && <ChevronRight className="w-3.5 h-3.5 text-slate-600 mt-1 ml-auto" />}
                </div>
              </button>

              {isOpen && !isDone && (
                <div className="px-4 pb-3 ml-11 space-y-2">
                  <p className="text-xs text-slate-400">{s.empfaenger_name} · {s.km_bis_stopp.toFixed(1)} km</p>
                  {s.notiz && (
                    <div className="text-xs text-yellow-300 bg-yellow-950/30 rounded px-2 py-1">📝 {s.notiz}</div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
                      {zahlIcon(s.zahlart)}<span>{zahlLabel(s.zahlart)} {s.betrag.toFixed(2)} €</span>
                    </div>
                    <a href={s.navi_url_google} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-900/60 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Navi
                    </a>
                    {s.empfaenger_tel && (
                      <a href={`tel:${s.empfaenger_tel}`}
                        className="text-xs bg-green-900/60 text-green-300 px-2 py-1 rounded flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Package className="w-3 h-3" />
          <span>Tour {data.tour_id}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Zap className="w-3 h-3" />
          <span>20-Sek-Polling</span>
        </div>
      </div>
    </div>
  );
}
