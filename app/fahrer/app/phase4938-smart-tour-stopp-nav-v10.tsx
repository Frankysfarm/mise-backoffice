'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, Clock, CheckCircle2, AlertTriangle, Zap, Phone, Package, ChevronDown, ChevronUp, CloudRain, Cloud, Sun, Wind } from 'lucide-react';

type WetterLage = 'klar' | 'bewoelkt' | 'regen' | 'sturm';
type VerkehrLage = 'frei' | 'maessig' | 'stau';

interface TourStopp {
  nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_uhrzeit: string | null;
  eta_min: number | null;
  km: number;
  verspaetet_min: number | null;
  zahlart: 'bar' | 'karte' | 'online';
  notiz: string | null;
  telefon: string | null;
  verkehr: VerkehrLage;
  wetter_einfluss_min: number;
}

interface ApiResponse {
  fahrer_name: string;
  tour_id: string;
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  schicht_ziel_touren: number;
  schicht_touren_fertig: number;
  wetter: WetterLage;
  wetter_text: string;
  routen_effizienz_pct: number;
  verdienst_bisher: number;
  trinkgeld_bisher: number;
  aktiver_stopp: TourStopp | null;
  naechster_stopp: TourStopp | null;
  stopps: TourStopp[];
  alert: string | null;
}

const WETTER_ICON: Record<WetterLage, typeof Sun> = {
  klar: Sun,
  bewoelkt: Cloud,
  regen: CloudRain,
  sturm: Wind,
};

const WETTER_COLOR: Record<WetterLage, string> = {
  klar: 'text-yellow-400',
  bewoelkt: 'text-slate-400',
  regen: 'text-blue-400',
  sturm: 'text-red-400',
};

const VERKEHR_STYLE: Record<VerkehrLage, { label: string; dot: string }> = {
  frei:    { label: 'Frei', dot: 'bg-green-500' },
  maessig: { label: 'Mäßig', dot: 'bg-yellow-500' },
  stau:    { label: 'Stau', dot: 'bg-red-500 animate-pulse' },
};

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  geliefert:  { dot: 'bg-green-500', label: 'Geliefert' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse', label: 'Aktiv' },
  ausstehend: { dot: 'bg-slate-500', label: 'Ausstehend' },
  verspaetet: { dot: 'bg-red-500', label: 'Verspätet' },
};

const MOCK: ApiResponse = {
  fahrer_name: 'Jonas M.',
  tour_id: 'T-2847',
  stopps_gesamt: 5,
  stopps_fertig: 2,
  km_gesamt: 18,
  km_gefahren: 7,
  schicht_ziel_touren: 8,
  schicht_touren_fertig: 3,
  wetter: 'regen',
  wetter_text: 'Leichter Regen · +4 min Puffer',
  routen_effizienz_pct: 89,
  verdienst_bisher: 34.50,
  trinkgeld_bisher: 6.80,
  alert: null,
  aktiver_stopp: {
    nr: 3,
    adresse: 'Marktplatz 8, Aachen',
    status: 'aktiv',
    eta_uhrzeit: '19:34',
    eta_min: 4,
    km: 3.7,
    verspaetet_min: null,
    zahlart: 'online',
    notiz: 'Klingel defekt – anrufen',
    telefon: '+49 162 555 0123',
    verkehr: 'maessig',
    wetter_einfluss_min: 2,
  },
  naechster_stopp: {
    nr: 4,
    adresse: 'Gartenstr. 21, Aachen',
    status: 'ausstehend',
    eta_uhrzeit: '19:48',
    eta_min: 11,
    km: 3.8,
    verspaetet_min: null,
    zahlart: 'bar',
    notiz: null,
    telefon: null,
    verkehr: 'frei',
    wetter_einfluss_min: 1,
  },
  stopps: [
    { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_uhrzeit: null, eta_min: null, km: 3.2, verspaetet_min: null, zahlart: 'karte', notiz: null, telefon: null, verkehr: 'frei', wetter_einfluss_min: 0 },
    { nr: 2, adresse: 'Kirchweg 5', status: 'geliefert', eta_uhrzeit: null, eta_min: null, km: 4.1, verspaetet_min: 2, zahlart: 'online', notiz: null, telefon: null, verkehr: 'frei', wetter_einfluss_min: 0 },
    { nr: 3, adresse: 'Marktplatz 8', status: 'aktiv', eta_uhrzeit: '19:34', eta_min: 4, km: 3.7, verspaetet_min: null, zahlart: 'online', notiz: 'Klingel defekt', telefon: '+49 162 555 0123', verkehr: 'maessig', wetter_einfluss_min: 2 },
    { nr: 4, adresse: 'Gartenstr. 21', status: 'ausstehend', eta_uhrzeit: '19:48', eta_min: 11, km: 3.8, verspaetet_min: null, zahlart: 'bar', notiz: null, telefon: null, verkehr: 'frei', wetter_einfluss_min: 1 },
    { nr: 5, adresse: 'Bergweg 3', status: 'ausstehend', eta_uhrzeit: '20:01', eta_min: 18, km: 3.2, verspaetet_min: null, zahlart: 'online', notiz: null, telefon: null, verkehr: 'frei', wetter_einfluss_min: 1 },
  ],
};

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

export function FahrerPhase4938SmartTourStoppNavV10() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/fahrer/tour-nav?v=10', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const WetterIcon = WETTER_ICON[data.wetter];
  const stoppPct = data.stopps_gesamt > 0 ? Math.round((data.stopps_fertig / data.stopps_gesamt) * 100) : 0;
  const schichtPct = data.schicht_ziel_touren > 0 ? Math.round((data.schicht_touren_fertig / data.schicht_ziel_touren) * 100) : 0;

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white font-sans max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-base text-blue-200">Tour-Nav V10</span>
          <span className="text-xs text-slate-500">{data.tour_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <WetterIcon className={`w-4 h-4 ${WETTER_COLOR[data.wetter]}`} />
          <span className="text-xs text-slate-400">{data.wetter_text}</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* Aktiver Stopp Hero */}
      {data.aktiver_stopp && (
        <div className="bg-blue-950/40 rounded-xl border border-blue-800/50 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-blue-400 font-medium mb-1">Aktueller Stopp #{data.aktiver_stopp.nr}</div>
              <div className="text-sm font-bold text-white">{data.aktiver_stopp.adresse}</div>
              {data.aktiver_stopp.notiz && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-400">{data.aktiver_stopp.notiz}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-blue-300">{data.aktiver_stopp.eta_min} min</div>
              <div className="text-xs text-slate-500">{data.aktiver_stopp.eta_uhrzeit} Uhr</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${VERKEHR_STYLE[data.aktiver_stopp.verkehr].dot}`} />
              <span className="text-slate-400">{VERKEHR_STYLE[data.aktiver_stopp.verkehr].label}</span>
            </div>
            {data.aktiver_stopp.wetter_einfluss_min > 0 && (
              <div className="flex items-center gap-1 text-blue-400">
                <CloudRain className="w-3 h-3" />
                <span>+{data.aktiver_stopp.wetter_einfluss_min} min</span>
              </div>
            )}
            <span className="text-slate-500">{data.aktiver_stopp.zahlart.toUpperCase()}</span>
            <span className="text-slate-500">{data.aktiver_stopp.km} km</span>
          </div>

          {/* Navigation deeplinks */}
          <div className="flex gap-2 mt-3">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.aktiver_stopp.adresse)}&travelmode=bicycling`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-700/50 hover:bg-blue-700/70 text-blue-200 text-xs font-medium py-2 rounded-lg text-center transition-colors"
            >
              Google Maps
            </a>
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(data.aktiver_stopp.adresse)}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 text-xs font-medium py-2 rounded-lg text-center transition-colors"
            >
              Waze
            </a>
            {data.aktiver_stopp.telefon && (
              <a
                href={`tel:${data.aktiver_stopp.telefon}`}
                className="bg-green-800/50 hover:bg-green-800/70 text-green-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
              >
                <Phone className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Nächster Stopp Vorschau */}
      {data.naechster_stopp && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Nächster Stopp #{data.naechster_stopp.nr}</div>
              <div className="text-sm font-medium text-slate-300">{data.naechster_stopp.adresse}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-slate-300 tabular-nums">{data.naechster_stopp.eta_min} min</div>
              <div className="text-xs text-slate-600">{data.naechster_stopp.eta_uhrzeit}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${VERKEHR_STYLE[data.naechster_stopp.verkehr].dot}`} />
            <span>{VERKEHR_STYLE[data.naechster_stopp.verkehr].label}</span>
            <span>·</span>
            <span>{data.naechster_stopp.zahlart.toUpperCase()}</span>
            <span>·</span>
            <span>{data.naechster_stopp.km} km</span>
          </div>
        </div>
      )}

      {/* Fortschrittsbalken */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Tour-Fortschritt</span>
          <span>{data.stopps_fertig}/{data.stopps_gesamt} Stopps</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stoppPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mt-2 mb-1">
          <span>Schicht-Ziel</span>
          <span>{data.schicht_touren_fertig}/{data.schicht_ziel_touren} Touren</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${schichtPct >= 80 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${schichtPct}%` }} />
        </div>
      </div>

      {/* Verdienst Strip */}
      <div className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800 text-xs">
        <div>
          <span className="text-slate-500">Verdienst</span>
          <span className="ml-2 font-bold text-white tabular-nums">{euro(data.verdienst_bisher)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-slate-500">Trinkgeld</span>
          <span className="ml-1 font-bold text-yellow-400 tabular-nums">{euro(data.trinkgeld_bisher)}</span>
        </div>
        <div>
          <span className="text-slate-500">Effizienz</span>
          <span className="ml-1 font-bold text-green-400">{data.routen_effizienz_pct}%</span>
        </div>
      </div>

      {/* Alle Stopps aufklappbar */}
      <div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between text-xs text-slate-400 py-1"
        >
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Alle Stopps ({data.stopps.length})
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {expanded && (
          <div className="mt-2 space-y-1.5">
            {data.stopps.map(stop => {
              const ss = STATUS_STYLE[stop.status];
              return (
                <div key={stop.nr} className="flex items-center gap-2 py-1 text-xs border-b border-slate-800/50">
                  <span className="text-slate-600 w-4">{stop.nr}.</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ss.dot}`} />
                  <span className="flex-1 text-slate-300 truncate">{stop.adresse}</span>
                  {stop.verspaetet_min && <span className="text-red-400 shrink-0">+{stop.verspaetet_min}min</span>}
                  {stop.eta_uhrzeit && <span className="text-slate-500 shrink-0">{stop.eta_uhrzeit}</span>}
                  <span className="text-slate-600 shrink-0">{stop.zahlart.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600 text-right">Live · 20s Polling · Mock-Fallback</div>
    </div>
  );
}
