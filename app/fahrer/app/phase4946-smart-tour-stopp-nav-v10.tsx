'use client';

import { useEffect, useState } from 'react';
import { Navigation2, CheckCircle2, MapPin, Phone, AlertTriangle, CreditCard, Banknote, WifiOff, ChevronDown, ChevronUp, Clock, Star, Zap, TrendingUp, Route, Package, Activity } from 'lucide-react';

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
  prognose_eta_min: number | null;
  km_bis_stopp: number;
  zahlart: 'bar' | 'karte' | 'online';
  betrag: number;
  verspaetet_min: number | null;
  navi_url_google: string;
  navi_url_apple: string;
  anweisungen: string | null;
  kundenbewertung: number | null;
  verkehr: 'frei' | 'maessig' | 'stau' | null;
  geschwindigkeit_kmh: number | null;
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
  gps_kmh: number;
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-095',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 17.4,
  km_gefahren: 4.8,
  tour_score: 89,
  verdienst_heute: 58.30,
  trinkgeld_heute: 6.20,
  online: true,
  routen_effizienz_pct: 93,
  alert: null,
  schicht_ziel_eur: 80,
  schicht_fortschritt_pct: 73,
  gps_kmh: 38,
  naechster_stopp: {
    stopp_nr: 2,
    order_id: 'o2',
    bestellnummer: '#1202',
    adresse: 'Hauptstr. 44, Aachen',
    empfaenger_name: 'Frau Müller',
    empfaenger_tel: '+49 241 123456',
    notiz: 'Bitte klingeln — 2. OG links',
    status: 'aktiv',
    eta_min: 5,
    prognose_eta_min: 5,
    km_bis_stopp: 2.3,
    zahlart: 'bar',
    betrag: 18.90,
    verspaetet_min: null,
    navi_url_google: 'https://maps.google.com/?q=Hauptstr.+44+Aachen',
    navi_url_apple: 'https://maps.apple.com/?q=Hauptstr.+44+Aachen',
    anweisungen: 'Tor zum Hinterhof ist offen',
    kundenbewertung: null,
    verkehr: 'frei',
    geschwindigkeit_kmh: 38,
  },
  stopps: [
    { stopp_nr: 1, order_id: 'o1', bestellnummer: '#1201', adresse: 'Kaiserplatz 1, Aachen', empfaenger_name: 'Herr Fischer', empfaenger_tel: null, notiz: null, status: 'geliefert', eta_min: null, prognose_eta_min: null, km_bis_stopp: 2.5, zahlart: 'online', betrag: 22.50, verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Kaiserplatz+1+Aachen', navi_url_apple: '', anweisungen: null, kundenbewertung: 5, verkehr: null, geschwindigkeit_kmh: null },
    { stopp_nr: 2, order_id: 'o2', bestellnummer: '#1202', adresse: 'Hauptstr. 44, Aachen', empfaenger_name: 'Frau Müller', empfaenger_tel: '+49 241 123456', notiz: 'Bitte klingeln — 2. OG links', status: 'aktiv', eta_min: 5, prognose_eta_min: 5, km_bis_stopp: 2.3, zahlart: 'bar', betrag: 18.90, verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Hauptstr.+44+Aachen', navi_url_apple: 'https://maps.apple.com/?q=Hauptstr.+44+Aachen', anweisungen: 'Tor zum Hinterhof ist offen', kundenbewertung: null, verkehr: 'frei', geschwindigkeit_kmh: 38 },
    { stopp_nr: 3, order_id: 'o3', bestellnummer: '#1203', adresse: 'Pontstr. 12, Aachen', empfaenger_name: 'Familie Weber', empfaenger_tel: '+49 241 654321', notiz: null, status: 'ausstehend', eta_min: 14, prognose_eta_min: 15, km_bis_stopp: 5.8, zahlart: 'karte', betrag: 34.60, verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Pontstr.+12+Aachen', navi_url_apple: '', anweisungen: null, kundenbewertung: null, verkehr: 'maessig', geschwindigkeit_kmh: null },
    { stopp_nr: 4, order_id: 'o4', bestellnummer: '#1204', adresse: 'Burtscheider Str. 8, Aachen', empfaenger_name: 'Herr Koch', empfaenger_tel: null, notiz: 'Klingel defekt — anrufen', status: 'ausstehend', eta_min: 22, prognose_eta_min: 24, km_bis_stopp: 6.8, zahlart: 'online', betrag: 28.40, verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Burtscheider+Str.+8+Aachen', navi_url_apple: '', anweisungen: 'Klingel defekt — bitte anrufen', kundenbewertung: null, verkehr: 'stau', geschwindigkeit_kmh: null },
  ],
};

const STOP_STATUS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  geliefert:  { dot: 'bg-green-500',                    label: 'Geliefert',  text: 'text-green-400' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse',       label: 'Aktiv',      text: 'text-blue-400' },
  ausstehend: { dot: 'bg-slate-500',                    label: 'Ausstehend', text: 'text-slate-400' },
  verspaetet: { dot: 'bg-red-500',                      label: 'Verspätet',  text: 'text-red-400' },
};

const VERKEHR_STYLE: Record<string, { color: string; label: string }> = {
  frei:    { color: 'text-green-400',  label: 'Frei' },
  maessig: { color: 'text-yellow-400', label: 'Mäßig' },
  stau:    { color: 'text-red-400',    label: 'Stau' },
};

const ZAHLART_ICON = {
  bar:    <Banknote className="w-3 h-3" />,
  karte:  <CreditCard className="w-3 h-3" />,
  online: <Zap className="w-3 h-3" />,
};

export function FahrerPhase4946SmartTourStoppNavV10({ isOnline = true }: { isOnline?: boolean }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/fahrer/tour-stops?v=10', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    if (isOnline) {
      load();
      const id = setInterval(load, 20000);
      return () => clearInterval(id);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 flex items-center gap-3 text-slate-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Offline — Navigation nicht verfügbar</span>
      </div>
    );
  }

  const stoppPct = data.stopps_gesamt > 0 ? Math.round((data.stopps_fertig / data.stopps_gesamt) * 100) : 0;
  const kmPct = data.km_gesamt > 0 ? Math.round((data.km_gefahren / data.km_gesamt) * 100) : 0;

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-blue-200">Tour-Nav V10</span>
          <span className="text-xs text-slate-500">Live GPS</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-green-400" />
          <span className="text-sm font-bold text-green-300">{data.gps_kmh} km/h</span>
        </div>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* Verdienst + Trinkgeld Strip */}
      <div className="flex items-center gap-3 bg-slate-900/60 rounded-lg p-3 border border-slate-800">
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-green-300 tabular-nums">{data.verdienst_heute.toFixed(2)} €</div>
          <div className="text-xs text-slate-500">Verdienst heute</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-yellow-300 tabular-nums">{data.trinkgeld_heute.toFixed(2)} €</div>
          <div className="text-xs text-slate-500">Trinkgeld</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-indigo-300 tabular-nums">{data.tour_score}</div>
          <div className="text-xs text-slate-500">Tour-Score</div>
        </div>
      </div>

      {/* Dual Fortschrittsbalken */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-12">Stopps</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stoppPct}%` }} />
          </div>
          <span className="text-slate-400 tabular-nums w-10 text-right">{data.stopps_fertig}/{data.stopps_gesamt}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-12">km</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${kmPct}%` }} />
          </div>
          <span className="text-slate-400 tabular-nums w-10 text-right">{data.km_gefahren}/{data.km_gesamt}</span>
        </div>
      </div>

      {/* Schicht-Ziel */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Schicht-Ziel {data.schicht_ziel_eur} €</span>
          <span className="text-slate-400">{data.schicht_fortschritt_pct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${data.schicht_fortschritt_pct >= 90 ? 'bg-green-500' : data.schicht_fortschritt_pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${data.schicht_fortschritt_pct}%` }}
          />
        </div>
      </div>

      {/* Nächster Stopp Hero-Karte */}
      {data.naechster_stopp && (
        <div className="bg-blue-900/30 border border-blue-600/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-200">Nächster Stopp #{data.naechster_stopp.stopp_nr}</span>
            </div>
            <div className="flex items-center gap-2">
              {data.naechster_stopp.verkehr && (
                <span className={`text-xs ${VERKEHR_STYLE[data.naechster_stopp.verkehr]?.color}`}>
                  {VERKEHR_STYLE[data.naechster_stopp.verkehr]?.label}
                </span>
              )}
              <span className="text-lg font-bold text-white">{data.naechster_stopp.eta_min} min</span>
            </div>
          </div>

          <div>
            <div className="text-sm text-white font-medium">{data.naechster_stopp.adresse}</div>
            <div className="text-xs text-slate-400">{data.naechster_stopp.empfaenger_name} · {data.naechster_stopp.km_bis_stopp} km</div>
          </div>

          {data.naechster_stopp.notiz && (
            <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2 text-xs text-yellow-300">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{data.naechster_stopp.notiz}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-800 ${data.naechster_stopp.zahlart === 'bar' ? 'text-yellow-300' : data.naechster_stopp.zahlart === 'karte' ? 'text-blue-300' : 'text-green-300'}`}>
              {ZAHLART_ICON[data.naechster_stopp.zahlart]}
              {data.naechster_stopp.betrag.toFixed(2)} €
            </span>
            <a
              href={data.naechster_stopp.navi_url_google}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg text-center transition-colors"
            >
              Google Maps
            </a>
            {data.naechster_stopp.navi_url_apple && (
              <a
                href={data.naechster_stopp.navi_url_apple}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded-lg text-center transition-colors"
              >
                Apple Maps
              </a>
            )}
            {data.naechster_stopp.empfaenger_tel && (
              <a
                href={`tel:${data.naechster_stopp.empfaenger_tel}`}
                className="bg-green-800 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
          <Route className="w-3 h-3" />Tour-Stops
        </div>
        {data.stopps.map(stop => {
          const style = STOP_STATUS_STYLE[stop.status] ?? STOP_STATUS_STYLE['ausstehend'];
          const isExp = expanded[stop.order_id];
          const isActive = stop.status === 'aktiv';

          return (
            <div
              key={stop.order_id}
              className={`rounded-lg border p-3 transition-all ${isActive ? 'border-blue-600/60 bg-blue-900/20' : 'border-slate-800 bg-slate-900/40'}`}
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(p => ({ ...p, [stop.order_id]: !p[stop.order_id] }))}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  <span className="text-sm font-medium text-white">{stop.stopp_nr}. {stop.bestellnummer}</span>
                  <span className="text-xs text-slate-500 truncate max-w-28">{stop.adresse.split(',')[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {stop.eta_min !== null && (
                    <span className={`text-xs font-bold ${stop.verspaetet_min ? 'text-red-400' : 'text-slate-300'}`}>
                      {stop.verspaetet_min ? `+${stop.verspaetet_min}m` : `~${stop.eta_min}m`}
                    </span>
                  )}
                  {stop.status === 'geliefert' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {stop.kundenbewertung !== null && (
                    <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                      <Star className="w-3 h-3" />{stop.kundenbewertung}
                    </span>
                  )}
                  {(stop.anweisungen || stop.notiz) && (
                    isExp ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />
                  )}
                </div>
              </div>

              {isExp && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    {ZAHLART_ICON[stop.zahlart]}
                    <span className="text-slate-300">{stop.zahlart.charAt(0).toUpperCase() + stop.zahlart.slice(1)} · {stop.betrag.toFixed(2)} €</span>
                    <span className="text-slate-500">{stop.km_bis_stopp} km</span>
                    {stop.verkehr && (
                      <span className={VERKEHR_STYLE[stop.verkehr]?.color}>
                        {VERKEHR_STYLE[stop.verkehr]?.label}
                      </span>
                    )}
                  </div>
                  {stop.empfaenger_name && <div className="text-slate-400">{stop.empfaenger_name}</div>}
                  {stop.anweisungen && (
                    <div className="bg-blue-900/20 border border-blue-700/40 rounded px-2 py-1.5 text-blue-300">
                      {stop.anweisungen}
                    </div>
                  )}
                  {stop.notiz && (
                    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded px-2 py-1.5 text-yellow-300">
                      {stop.notiz}
                    </div>
                  )}
                  {stop.prognose_eta_min !== null && stop.prognose_eta_min !== stop.eta_min && (
                    <div className="text-slate-500">Prognose: ~{stop.prognose_eta_min} min</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-600 text-right">20s Polling · Mock-Fallback</div>
    </div>
  );
}
