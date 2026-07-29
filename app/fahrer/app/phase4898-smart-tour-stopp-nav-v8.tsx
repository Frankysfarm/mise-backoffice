'use client';

import { useEffect, useState } from 'react';
import { Navigation2, CheckCircle2, MapPin, Phone, AlertTriangle, CreditCard, Banknote, Zap, WifiOff, ChevronDown, ChevronUp, Star, Clock, Route, Gauge, Package, TrendingUp } from 'lucide-react';

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
  tempo_profil: 'schnell' | 'normal' | 'stau' | null;
  geschaetzt_ankunft_min: number | null;
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
}

const MOCK: ApiResponse = {
  tour_id: 'T-2026-051',
  fahrer_name: 'Marco S.',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 16.8,
  km_gefahren: 4.2,
  tour_score: 86,
  verdienst_heute: 78.00,
  trinkgeld_heute: 9.50,
  online: true,
  routen_effizienz_pct: 84,
  alert: null,
  naechster_stopp: null,
  stopps: [
    {
      stopp_nr: 1, order_id: 'o1', bestellnummer: '#1101',
      adresse: 'Hauptstraße 12, 52062 Aachen', empfaenger_name: 'Klaus M.',
      empfaenger_tel: '+4924191234', notiz: null, status: 'geliefert',
      eta_min: null, km_bis_stopp: 1.4, zahlart: 'online', betrag: 22.90,
      verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Hauptstra%C3%9Fe+12+Aachen',
      navi_url_apple: 'maps://?address=Hauptstra%C3%9Fe+12,Aachen', anweisungen: '2. Etage, Klingel M.',
      kundenbewertung: 5, tempo_profil: 'schnell', geschaetzt_ankunft_min: null,
    },
    {
      stopp_nr: 2, order_id: 'o2', bestellnummer: '#1102',
      adresse: 'Marktplatz 5, 52062 Aachen', empfaenger_name: 'Lena K.',
      empfaenger_tel: '+4924198765', notiz: 'Klingel kaputt — anrufen!', status: 'aktiv',
      eta_min: 5, km_bis_stopp: 2.3, zahlart: 'karte', betrag: 18.50,
      verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Marktplatz+5+Aachen',
      navi_url_apple: 'maps://?address=Marktplatz+5,Aachen', anweisungen: null,
      kundenbewertung: null, tempo_profil: 'stau', geschaetzt_ankunft_min: 7,
    },
    {
      stopp_nr: 3, order_id: 'o3', bestellnummer: '#1103',
      adresse: 'Bergweg 8, 52072 Aachen', empfaenger_name: 'Tom B.',
      empfaenger_tel: null, notiz: null, status: 'ausstehend',
      eta_min: 18, km_bis_stopp: 4.1, zahlart: 'bar', betrag: 11.00,
      verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Bergweg+8+Aachen',
      navi_url_apple: 'maps://?address=Bergweg+8,Aachen', anweisungen: 'Wechselgeld bereithalten',
      kundenbewertung: null, tempo_profil: 'normal', geschaetzt_ankunft_min: 20,
    },
    {
      stopp_nr: 4, order_id: 'o4', bestellnummer: '#1104',
      adresse: 'Industriestr. 22, 52068 Aachen', empfaenger_name: 'Büro GmbH',
      empfaenger_tel: '+4924100001', notiz: 'Rezeption EG', status: 'ausstehend',
      eta_min: 30, km_bis_stopp: 6.2, zahlart: 'online', betrag: 42.00,
      verspaetet_min: null, navi_url_google: 'https://maps.google.com/?q=Industriestr.+22+Aachen',
      navi_url_apple: 'maps://?address=Industriestr.+22,Aachen', anweisungen: null,
      kundenbewertung: null, tempo_profil: 'normal', geschaetzt_ankunft_min: 33,
    },
  ],
};

function zahlartIcon(z: TourStop['zahlart']) {
  if (z === 'bar') return <Banknote className="w-3 h-3 text-green-400" />;
  if (z === 'karte') return <CreditCard className="w-3 h-3 text-blue-400" />;
  return <Zap className="w-3 h-3 text-purple-400" />;
}

function tempoChip(t: TourStop['tempo_profil']) {
  if (t === 'stau') return <span className="text-[9px] px-1 rounded bg-red-900/40 border border-red-700/30 text-red-300">Stau</span>;
  if (t === 'schnell') return <span className="text-[9px] px-1 rounded bg-green-900/40 border border-green-700/30 text-green-300">Schnell</span>;
  if (t === 'normal') return <span className="text-[9px] px-1 rounded bg-slate-800/50 border border-slate-600/30 text-slate-400">Normal</span>;
  return null;
}

export function FahrerPhase4898SmartTourStoppNavV8({ driverId }: { driverId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!driverId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}`);
        if (r.ok) {
          const json = await r.json();
          if (json?.stopps) setData(json as ApiResponse);
        }
      } catch { /* Mock-Fallback */ }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [driverId]);

  if (!data.online) {
    return (
      <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-4 flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-slate-500" />
        <span className="text-xs text-slate-500">Offline — Tour-Daten nicht verfügbar</span>
      </div>
    );
  }

  const aktiv = data.stopps.find(s => s.status === 'aktiv');
  const stoppPct = data.stopps_gesamt > 0 ? (data.stopps_fertig / data.stopps_gesamt) * 100 : 0;
  const kmPct = data.km_gesamt > 0 ? (data.km_gefahren / data.km_gesamt) * 100 : 0;

  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/15 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300">Tour-Stopp Navigator V8</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-indigo-400" />
          <span className="text-sm font-bold text-indigo-300">{data.tour_score}</span>
          <Gauge className="w-3 h-3 text-slate-500" />
          <span className="text-xs text-slate-400">{data.routen_effizienz_pct}%</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded bg-red-900/30 border border-red-700/40 px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Progress Bars */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Stopps {data.stopps_fertig}/{data.stopps_gesamt}</span>
          <span>{data.km_gefahren.toFixed(1)}/{data.km_gesamt.toFixed(1)} km</span>
        </div>
        <div className="h-1.5 rounded bg-slate-700/50"><div className="h-1.5 rounded bg-blue-500 transition-all" style={{ width: `${stoppPct}%` }} /></div>
        <div className="h-1 rounded bg-slate-700/50"><div className="h-1 rounded bg-indigo-500/70 transition-all" style={{ width: `${kmPct}%` }} /></div>
      </div>

      {/* Verdienst Strip */}
      <div className="flex gap-4 rounded bg-slate-900/40 border border-slate-700/30 px-2 py-1">
        <div>
          <div className="text-xs font-semibold text-green-400">€{data.verdienst_heute.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">Verdienst</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-yellow-400">€{data.trinkgeld_heute.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">Trinkgeld</div>
        </div>
        <div className="ml-auto">
          <div className="text-xs font-semibold text-blue-300">{data.tour_id}</div>
          <div className="text-[9px] text-slate-500">Tour-ID</div>
        </div>
      </div>

      {/* Aktiver Stopp — Hero Card */}
      {aktiv && (
        <div className="rounded-lg border border-blue-500/50 bg-blue-900/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Navigation2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="text-xs font-semibold text-blue-300">Jetzt: {aktiv.bestellnummer}</span>
            {tempoChip(aktiv.tempo_profil)}
            {aktiv.verspaetet_min && (
              <span className="text-[9px] text-red-400 ml-auto">+{aktiv.verspaetet_min} min verspätet</span>
            )}
          </div>
          <div className="text-sm font-medium text-slate-200 mb-1">{aktiv.empfaenger_name}</div>
          <div className="text-xs text-slate-400 mb-2">{aktiv.adresse}</div>
          {aktiv.notiz && (
            <div className="flex items-start gap-1.5 rounded bg-yellow-900/20 border border-yellow-700/30 px-1.5 py-1 mb-2">
              <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-yellow-300">{aktiv.notiz}</span>
            </div>
          )}
          {aktiv.anweisungen && (
            <div className="text-[10px] text-slate-500 mb-2">ℹ {aktiv.anweisungen}</div>
          )}
          <div className="flex gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-1">
              {zahlartIcon(aktiv.zahlart)}
              <span className="text-[10px] text-slate-400">€{aktiv.betrag.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-400">{aktiv.km_bis_stopp.toFixed(1)} km</span>
            </div>
            {aktiv.geschaetzt_ankunft_min && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] text-slate-400">~{aktiv.geschaetzt_ankunft_min} min</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a href={aktiv.navi_url_google} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center text-[10px] py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium">
              Google Maps
            </a>
            <a href={aktiv.navi_url_apple} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center text-[10px] py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium">
              Apple Maps
            </a>
            {aktiv.empfaenger_tel && (
              <a href={`tel:${aktiv.empfaenger_tel}`}
                className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white">
                <Phone className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="space-y-1">
        {data.stopps.map(s => {
          const isExpanded = expanded[s.order_id] ?? false;
          const statusBg =
            s.status === 'geliefert' ? 'border-green-700/40 bg-green-950/15' :
            s.status === 'aktiv' ? 'border-blue-600/50 bg-blue-950/20' :
            s.status === 'verspaetet' ? 'border-red-600/50 bg-red-950/20' :
            'border-slate-700/30 bg-slate-900/20';

          return (
            <div key={s.order_id} className={`rounded border ${statusBg} p-1.5`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] w-4 text-slate-500 shrink-0">{s.stopp_nr}.</span>
                {s.status === 'geliefert' && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
                {s.status === 'aktiv' && <Navigation2 className="w-3 h-3 text-blue-400 animate-pulse shrink-0" />}
                {s.status === 'verspaetet' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                {s.status === 'ausstehend' && <MapPin className="w-3 h-3 text-slate-500 shrink-0" />}
                <span className="text-[10px] text-slate-300 flex-1 truncate">{s.adresse}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {zahlartIcon(s.zahlart)}
                  {s.kundenbewertung && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />}
                  {s.eta_min && s.status !== 'geliefert' && <span className="text-[9px] text-slate-500">{s.eta_min} min</span>}
                  {tempoChip(s.tempo_profil)}
                  <button onClick={() => setExpanded(prev => ({ ...prev, [s.order_id]: !isExpanded }))}
                    className="text-slate-500 hover:text-slate-300">
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700/30 space-y-0.5">
                  <div className="text-[9px] text-slate-400">{s.empfaenger_name} · €{s.betrag.toFixed(2)} · {s.km_bis_stopp.toFixed(1)} km</div>
                  {s.notiz && <div className="text-[9px] text-yellow-300">⚠ {s.notiz}</div>}
                  {s.anweisungen && <div className="text-[9px] text-slate-500">ℹ {s.anweisungen}</div>}
                  {s.geschaetzt_ankunft_min && <div className="text-[9px] text-slate-500">Geschätzte Ankunft: {s.geschaetzt_ankunft_min} min</div>}
                  {s.empfaenger_tel && (
                    <a href={`tel:${s.empfaenger_tel}`} className="inline-flex items-center gap-1 text-[9px] text-green-400">
                      <Phone className="w-2.5 h-2.5" /> {s.empfaenger_tel}
                    </a>
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
