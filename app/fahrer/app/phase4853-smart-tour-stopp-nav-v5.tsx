'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navigation2, CheckCircle2, Clock, MapPin, Phone, AlertTriangle, Zap, Package, CreditCard, Banknote, Wifi, WifiOff, ChevronRight } from 'lucide-react';

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
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-042',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 13.8,
  km_gefahren: 3.4,
  tour_score: 88,
  alert: null,
  online: true,
  naechster_stopp: null,
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1060',
      adresse: 'Hauptstraße 12, 52062 Aachen', empfaenger_name: 'Klaus M.',
      empfaenger_tel: '+4924191234', notiz: null, status: 'geliefert',
      eta_min: null, km_bis_stopp: 1.3, zahlart: 'online', betrag: 19.90,
      verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Hauptstraße+12+Aachen',
      navi_url_apple: 'maps://?q=Hauptstraße+12+Aachen',
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1061',
      adresse: 'Marktplatz 5, 52062 Aachen', empfaenger_name: 'Sarah K.',
      empfaenger_tel: '+4924198765', notiz: 'Klingel defekt — anrufen!', status: 'aktiv',
      eta_min: 3, km_bis_stopp: 0.9, zahlart: 'bar', betrag: 26.50,
      verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Marktplatz+5+Aachen',
      navi_url_apple: 'maps://?q=Marktplatz+5+Aachen',
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1062',
      adresse: 'Bergstraße 8, 52066 Aachen', empfaenger_name: 'Tom B.',
      empfaenger_tel: null, notiz: null, status: 'ausstehend',
      eta_min: 16, km_bis_stopp: 3.8, zahlart: 'karte', betrag: 32.80,
      verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Bergstraße+8+Aachen',
      navi_url_apple: 'maps://?q=Bergstraße+8+Aachen',
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1063',
      adresse: 'Seeweg 22, 52074 Aachen', empfaenger_name: 'Lisa W.',
      empfaenger_tel: '+4924154321', notiz: 'Hintereingang verwenden', status: 'verspaetet',
      eta_min: 31, km_bis_stopp: 7.8, zahlart: 'online', betrag: 17.60,
      verspaetet_min: 9,
      navi_url_google: 'https://maps.google.com/?q=Seeweg+22+Aachen',
      navi_url_apple: 'maps://?q=Seeweg+22+Aachen',
    },
  ],
};

function statusBorder(s: TourStop['status']) {
  if (s === 'geliefert') return 'border-green-800 bg-green-950/20';
  if (s === 'aktiv') return 'border-blue-600 bg-blue-950/30 ring-1 ring-blue-600/40';
  if (s === 'verspaetet') return 'border-red-700 bg-red-950/20';
  return 'border-slate-700 bg-slate-900/20';
}

function statusColor(s: TourStop['status']) {
  if (s === 'geliefert') return 'text-green-400';
  if (s === 'aktiv') return 'text-blue-300';
  if (s === 'verspaetet') return 'text-red-400';
  return 'text-gray-400';
}

function zahlartIcon(z: TourStop['zahlart']) {
  if (z === 'karte') return <CreditCard className="w-3 h-3 text-blue-400" />;
  if (z === 'bar') return <Banknote className="w-3 h-3 text-green-400" />;
  return <CheckCircle2 className="w-3 h-3 text-purple-400" />;
}

export function FahrerPhase4853SmartTourStoppNavV5({ fahrerToken }: { fahrerToken?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fahrerToken) return;
    try {
      const r = await fetch(`/api/delivery/fahrer/tour?token=${fahrerToken}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* mock */ }
  }, [fahrerToken]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const aktiver = data.stopps.find(s => s.status === 'aktiv');
  const fortschrittPct = Math.round((data.stopps_fertig / data.stopps_gesamt) * 100);

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Navigation2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Tour-Navigator V5</span>
              {data.online ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400 animate-pulse" />}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{data.tour_id} · {data.fahrer_name}</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-extrabold ${data.tour_score >= 85 ? 'text-green-400' : data.tour_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.tour_score}
            </div>
            <div className="text-[10px] text-slate-500">Score</div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fortschrittPct}%` }} />
          </div>
          <span className="text-xs text-slate-400 shrink-0">{data.stopps_fertig}/{data.stopps_gesamt}</span>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{data.km_gefahren.toFixed(1)} / {data.km_gesamt.toFixed(1)} km</span>
          <span>{data.stopps_gesamt - data.stopps_fertig} Stopps offen</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Nächster Stopp — Hero Card */}
      {aktiver && (
        <div className="mx-4 mt-4 bg-blue-950/50 border border-blue-600/50 rounded-2xl overflow-hidden">
          <div className="bg-blue-600/20 px-4 py-2 flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-blue-300 animate-pulse" />
            <span className="text-xs font-semibold text-blue-200">JETZT ANFAHREN — Stopp {aktiver.stopp_nr}</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-white text-base">{aktiver.empfaenger_name}</div>
                <div className="text-sm text-slate-300 mt-0.5 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  {aktiver.adresse}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-blue-300">{aktiver.eta_min} Min</div>
                <div className="text-[10px] text-slate-500">{aktiver.km_bis_stopp.toFixed(1)} km</div>
              </div>
            </div>

            {aktiver.notiz && (
              <div className="mt-2 flex items-start gap-1.5 bg-yellow-950/30 border border-yellow-700/30 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                <span className="text-xs text-yellow-300">{aktiver.notiz}</span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg px-2 py-1">
                {zahlartIcon(aktiver.zahlart)}
                <span className="text-xs text-white font-semibold">{aktiver.betrag.toFixed(2)} €</span>
                <span className="text-[10px] text-slate-400">{aktiver.zahlart}</span>
              </div>
              {aktiver.empfaenger_tel && (
                <a href={`tel:${aktiver.empfaenger_tel}`} className="flex items-center gap-1 bg-slate-800/60 rounded-lg px-2 py-1">
                  <Phone className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-slate-300">Anrufen</span>
                </a>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={aktiver.navi_url_google}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                <Navigation2 className="w-4 h-4" />
                Google Maps
              </a>
              <a
                href={aktiver.navi_url_apple}
                className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                <Navigation2 className="w-4 h-4" />
                Apple Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* All Stops */}
      <div className="px-4 mt-4 space-y-2 pb-6">
        <div className="text-xs font-semibold text-slate-400 mb-2">Alle Stopps</div>
        {data.stopps.map(s => (
          <button
            key={s.stopp_nr}
            className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${statusBorder(s.status)} ${selectedStop === s.order_id ? 'ring-1 ring-blue-500/60' : ''}`}
            onClick={() => setSelectedStop(prev => prev === s.order_id ? null : s.order_id)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                s.status === 'geliefert' ? 'bg-green-800 text-green-200' :
                s.status === 'aktiv' ? 'bg-blue-700 text-blue-200' :
                s.status === 'verspaetet' ? 'bg-red-800 text-red-200' :
                'bg-slate-700 text-slate-300'
              }`}>
                {s.status === 'geliefert' ? '✓' : s.stopp_nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${statusColor(s.status)}`}>{s.empfaenger_name}</span>
                  <div className="flex items-center gap-1">
                    {zahlartIcon(s.zahlart)}
                    <span className="text-xs text-slate-300">{s.betrag.toFixed(2)} €</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{s.adresse}</div>
                {s.verspaetet_min && (
                  <div className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {s.verspaetet_min} Min verspätet
                  </div>
                )}
              </div>
              {s.eta_min !== null && (
                <div className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{s.eta_min} Min
                </div>
              )}
            </div>

            {/* Expanded Details */}
            {selectedStop === s.order_id && s.status !== 'geliefert' && (
              <div className="mt-3 pt-3 border-t border-slate-700/40">
                {s.notiz && (
                  <div className="mb-2 flex items-start gap-1.5 bg-yellow-950/20 rounded-lg px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-yellow-300">{s.notiz}</span>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {s.empfaenger_tel && (
                    <a href={`tel:${s.empfaenger_tel}`} className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 text-xs text-green-400">
                      <Phone className="w-3 h-3" /> Anrufen
                    </a>
                  )}
                  <a href={s.navi_url_google} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 text-xs text-blue-400">
                    <Navigation2 className="w-3 h-3" /> Navi
                  </a>
                  <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
                    <Package className="w-3 h-3" /> {s.bestellnummer}
                  </div>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
