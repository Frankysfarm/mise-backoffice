'use client';

import { useEffect, useState } from 'react';
import { Navigation2, CheckCircle2, MapPin, Phone, AlertTriangle, CreditCard, Banknote, Zap, WifiOff, ChevronDown, ChevronUp, Clock, Route, Star, Package, TrendingUp, Target } from 'lucide-react';

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
  anweisungen: string | null;
  kundenbewertung: number | null;
  prognose_eta_min: number | null;
  verkehr: 'frei' | 'maessig' | 'stau' | null;
}

interface ApiResponse {
  tour_id: string;
  fahrer_name: string;
  stopps: TourStop[];
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  tour_score: number;
  verdienst_heute: number;
  trinkgeld_heute: number;
  online: boolean;
  routen_effizienz_pct: number;
  naechster_stopp: TourStop | null;
  alert: string | null;
  schicht_ziel_eur: number;
  schicht_fortschritt_pct: number;
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-072',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 17.4,
  km_gefahren: 4.8,
  tour_score: 87,
  verdienst_heute: 52.30,
  trinkgeld_heute: 4.80,
  online: true,
  routen_effizienz_pct: 91,
  alert: null,
  schicht_ziel_eur: 80,
  schicht_fortschritt_pct: 65,
  naechster_stopp: {
    stopp_nr: 2,
    order_id: 'o2',
    bestellnummer: '#1102',
    adresse: 'Hauptstr. 44, Aachen',
    empfaenger_name: 'Frau Müller',
    empfaenger_tel: '+49 241 123456',
    notiz: 'Bitte klingeln — 2. OG links',
    status: 'aktiv',
    eta_min: 5,
    km_bis_stopp: 2.3,
    zahlart: 'bar',
    betrag: 18.90,
    verspaetet_min: null,
    navi_url_google: 'https://maps.google.com/?q=Hauptstr.+44+Aachen',
    navi_url_apple: 'https://maps.apple.com/?q=Hauptstr.+44+Aachen',
    anweisungen: 'Tor zum Hinterhof ist offen',
    kundenbewertung: null,
    prognose_eta_min: 5,
    verkehr: 'frei',
  },
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1101', adresse: 'Musterweg 5, Aachen',
      empfaenger_name: 'Herr Schmidt', empfaenger_tel: null, notiz: null,
      status: 'geliefert', eta_min: null, km_bis_stopp: 2.5, zahlart: 'online',
      betrag: 24.50, verspaetet_min: null,
      navi_url_google: '', navi_url_apple: '',
      anweisungen: null, kundenbewertung: 5, prognose_eta_min: null, verkehr: null,
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1102', adresse: 'Hauptstr. 44, Aachen',
      empfaenger_name: 'Frau Müller', empfaenger_tel: '+49 241 123456',
      notiz: 'Bitte klingeln — 2. OG links',
      status: 'aktiv', eta_min: 5, km_bis_stopp: 2.3, zahlart: 'bar',
      betrag: 18.90, verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Hauptstr.+44+Aachen',
      navi_url_apple: 'https://maps.apple.com/?q=Hauptstr.+44+Aachen',
      anweisungen: 'Tor zum Hinterhof ist offen', kundenbewertung: null,
      prognose_eta_min: 5, verkehr: 'frei',
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1103', adresse: 'Parkstr. 11, Aachen',
      empfaenger_name: 'Herr Bauer', empfaenger_tel: '+49 241 654321', notiz: null,
      status: 'ausstehend', eta_min: 18, km_bis_stopp: 6.8, zahlart: 'karte',
      betrag: 31.20, verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Parkstr.+11+Aachen',
      navi_url_apple: 'https://maps.apple.com/?q=Parkstr.+11+Aachen',
      anweisungen: null, kundenbewertung: null, prognose_eta_min: 19, verkehr: 'maessig',
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1104', adresse: 'Rosenweg 3, Aachen',
      empfaenger_name: 'Frau Klein', empfaenger_tel: null, notiz: 'Kontaktlose Lieferung',
      status: 'ausstehend', eta_min: 28, km_bis_stopp: 5.8, zahlart: 'online',
      betrag: 15.40, verspaetet_min: null,
      navi_url_google: 'https://maps.google.com/?q=Rosenweg+3+Aachen',
      navi_url_apple: 'https://maps.apple.com/?q=Rosenweg+3+Aachen',
      anweisungen: null, kundenbewertung: null, prognose_eta_min: 30, verkehr: 'stau',
    },
  ],
};

function zahlartBadge(z: string) {
  if (z === 'bar') return <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded-full"><Banknote className="w-2.5 h-2.5" />Bar</span>;
  if (z === 'karte') return <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-full"><CreditCard className="w-2.5 h-2.5" />Karte</span>;
  return <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded-full">Online</span>;
}

function verkehrBadge(v: string | null) {
  if (v === 'stau') return <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded-full">Stau</span>;
  if (v === 'maessig') return <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 rounded-full">Mäßig</span>;
  if (v === 'frei') return <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded-full">Frei</span>;
  return null;
}

function stopStatusDot(status: string) {
  if (status === 'geliefert') return 'bg-green-500';
  if (status === 'aktiv') return 'bg-blue-500 animate-pulse';
  if (status === 'verspaetet') return 'bg-red-500';
  return 'bg-slate-500';
}

export function FahrerPhase4910SmartTourStoppNavV9({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expandedStopps, setExpandedStopps] = useState<Set<number>>(new Set([2]));

  useEffect(() => {
    if (!driverId || !locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}&location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock fallback */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!data.online) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 px-4 py-6 flex flex-col items-center gap-3">
        <WifiOff className="w-8 h-8 text-slate-500" />
        <span className="text-sm text-slate-400">Offline — keine Tour verfügbar</span>
      </div>
    );
  }

  const stopsPct = data.stopps_gesamt > 0 ? Math.round((data.stopps_fertig / data.stopps_gesamt) * 100) : 0;
  const kmPct = data.km_gesamt > 0 ? Math.round((data.km_gefahren / data.km_gesamt) * 100) : 0;

  function toggleStopp(nr: number) {
    setExpandedStopps(prev => {
      const next = new Set(prev);
      if (next.has(nr)) next.delete(nr); else next.add(nr);
      return next;
    });
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-blue-950/30">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-semibold text-blue-300">Tour-Navigator V9</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">
            {data.tour_id}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          <span className={`text-lg font-bold ${data.tour_score >= 85 ? 'text-green-400' : data.tour_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.tour_score}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-700/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Dual-Fortschrittsbalken */}
      <div className="px-4 py-3 border-b border-slate-700/50 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">Stopps</span>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">{data.stopps_fertig}/{data.stopps_gesamt}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stopsPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Route className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">Kilometer</span>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">{data.km_gefahren.toFixed(1)}/{data.km_gesamt.toFixed(1)} km</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${kmPct}%` }} />
          </div>
        </div>
      </div>

      {/* Verdienst + Schicht-Ziel */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
            <div className="text-sm font-bold text-green-400">
              {data.verdienst_heute.toFixed(2).replace('.', ',')} €
            </div>
            <div className="text-[10px] text-slate-500">Verdienst</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
            <div className="text-sm font-bold text-yellow-400">
              +{data.trinkgeld_heute.toFixed(2).replace('.', ',')} €
            </div>
            <div className="text-[10px] text-slate-500">Trinkgeld</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <Target className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">{data.schicht_fortschritt_pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.schicht_fortschritt_pct >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, data.schicht_fortschritt_pct)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Ziel {data.schicht_ziel_eur}€</div>
          </div>
        </div>
      </div>

      {/* Aktiver Stopp Hero */}
      {data.naechster_stopp && (
        <div className="mx-4 my-3 bg-blue-950/40 border border-blue-800/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Nächster Stopp</span>
              {data.naechster_stopp.eta_min !== null && (
                <span className="text-xs font-bold text-white ml-auto">{data.naechster_stopp.eta_min} min</span>
              )}
            </div>
            <div className="text-sm font-bold text-white mb-1">{data.naechster_stopp.adresse}</div>
            <div className="text-xs text-slate-300 mb-2">{data.naechster_stopp.empfaenger_name}</div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {zahlartBadge(data.naechster_stopp.zahlart)}
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-300 rounded-full font-semibold">
                {data.naechster_stopp.betrag.toFixed(2).replace('.', ',')} €
              </span>
              {verkehrBadge(data.naechster_stopp.verkehr)}
            </div>
            {data.naechster_stopp.notiz && (
              <div className="flex items-start gap-1.5 bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <span className="text-xs text-yellow-200">{data.naechster_stopp.notiz}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={data.naechster_stopp.navi_url_google}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                Google Maps
              </a>
              <a
                href={data.naechster_stopp.navi_url_apple}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                Apple Maps
              </a>
            </div>
            {data.naechster_stopp.empfaenger_tel && (
              <a
                href={`tel:${data.naechster_stopp.empfaenger_tel}`}
                className="mt-2 flex items-center justify-center gap-2 border border-slate-600 text-slate-300 text-xs font-medium py-2 rounded-xl hover:bg-slate-700/50 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {data.naechster_stopp.empfaenger_tel}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Sequenz */}
      <div className="px-4 pb-4 space-y-1.5">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Tour-Stopps · {data.stopps_fertig}/{data.stopps_gesamt} abgeschlossen
        </div>
        {data.stopps.map((s, idx) => {
          const isExpanded = expandedStopps.has(s.stopp_nr);
          const isActive = s.status === 'aktiv';
          return (
            <div
              key={s.stopp_nr}
              className={`rounded-xl border overflow-hidden ${isActive ? 'border-blue-600/60 bg-blue-950/20' : s.status === 'geliefert' ? 'border-green-700/30 bg-slate-800/20' : s.status === 'verspaetet' ? 'border-red-700/40 bg-red-950/10' : 'border-slate-700/40 bg-slate-800/20'}`}
            >
              <button
                onClick={() => toggleStopp(s.stopp_nr)}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-3 h-3 rounded-full ${stopStatusDot(s.status)}`} />
                  {idx < data.stopps.length - 1 && <div className="w-px h-3 bg-slate-700 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 tabular-nums">{s.stopp_nr}.</span>
                    <span className="text-xs font-medium text-white truncate">{s.adresse}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {s.kundenbewertung !== null && (
                      <span className="text-[10px] text-yellow-400">{'★'.repeat(s.kundenbewertung)}</span>
                    )}
                    {s.verspaetet_min !== null && (
                      <span className="text-[10px] text-red-400">+{s.verspaetet_min}min</span>
                    )}
                    {s.eta_min !== null && s.status !== 'geliefert' && (
                      <span className="text-[10px] text-blue-300">{s.eta_min}min</span>
                    )}
                    {verkehrBadge(s.verkehr)}
                    <span className="text-[10px] text-slate-500">{s.km_bis_stopp.toFixed(1)} km</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {zahlartBadge(s.zahlart)}
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-700/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-300">{s.empfaenger_name}</span>
                    <span className="text-xs font-semibold text-white">{s.betrag.toFixed(2).replace('.', ',')} €</span>
                  </div>
                  {s.notiz && (
                    <div className="flex items-start gap-1.5 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-yellow-200">{s.notiz}</span>
                    </div>
                  )}
                  {s.anweisungen && (
                    <div className="text-[10px] text-slate-400">{s.anweisungen}</div>
                  )}
                  {s.prognose_eta_min !== null && s.status !== 'geliefert' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Prognose: ~{s.prognose_eta_min} min</span>
                    </div>
                  )}
                  {s.empfaenger_tel && (
                    <a
                      href={`tel:${s.empfaenger_tel}`}
                      className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      <Phone className="w-3 h-3" />
                      {s.empfaenger_tel}
                    </a>
                  )}
                  {s.status !== 'geliefert' && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <a
                        href={s.navi_url_google}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 bg-blue-700/70 text-white text-[10px] font-medium py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Navigation2 className="w-3 h-3" /> Google
                      </a>
                      <a
                        href={s.navi_url_apple}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 bg-slate-700 text-white text-[10px] font-medium py-1.5 rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        <Navigation2 className="w-3 h-3" /> Apple
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>20-Sek-Polling · Verkehr-Info · Prognose-ETA · Mock-Fallback</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
