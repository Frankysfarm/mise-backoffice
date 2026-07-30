'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, Clock, CheckCircle2, AlertTriangle, Zap, Phone, ChevronDown, ChevronUp, Route } from 'lucide-react';

interface TourStopp {
  stopp_nr: number;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  zone: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km_entfernung: number | null;
  zahlart: 'bar' | 'karte' | 'online';
  notiz: string | null;
  kunde_telefon: string | null;
  anweisungen: string | null;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  stopps_fertig: number;
  stopps_gesamt: number;
  km_gesamt: number;
  km_zurueck: number;
  verdienst_eur: number;
  trinkgeld_eur: number;
  schicht_ziel_touren: number;
  schicht_touren_fertig: number;
  google_deeplink_aktiv: string | null;
  apple_deeplink_aktiv: string | null;
}

const MOCK: TourData = {
  tour_id: 'T-1234',
  stopps_fertig: 2,
  stopps_gesamt: 5,
  km_gesamt: 18.4,
  km_zurueck: 7.2,
  verdienst_eur: 24.50,
  trinkgeld_eur: 3.80,
  schicht_ziel_touren: 10,
  schicht_touren_fertig: 3,
  google_deeplink_aktiv: null,
  apple_deeplink_aktiv: null,
  stopps: [
    { stopp_nr: 1, order_id: 'o1', bestellnummer: '#1041', adresse: 'Hauptstr. 12, 52072 Aachen', zone: 'Nord', status: 'geliefert', eta_min: null, km_entfernung: 2.1, zahlart: 'online', notiz: null, kunde_telefon: null, anweisungen: null },
    { stopp_nr: 2, order_id: 'o2', bestellnummer: '#1042', adresse: 'Bahnhofstr. 5, 52064 Aachen', zone: 'Mitte', status: 'geliefert', eta_min: null, km_entfernung: 1.8, zahlart: 'karte', notiz: null, kunde_telefon: null, anweisungen: null },
    { stopp_nr: 3, order_id: 'o3', bestellnummer: '#1043', adresse: 'Roermonder Str. 42, 52072 Aachen', zone: 'Nord', status: 'aktiv', eta_min: 4, km_entfernung: 1.2, zahlart: 'bar', notiz: 'Klingel kaputt — bitte anrufen', kunde_telefon: '+49 176 1234 5678', anweisungen: '2. Etage links, kein Aufzug' },
    { stopp_nr: 4, order_id: 'o4', bestellnummer: '#1044', adresse: 'Adalbertsteinweg 88, 52070 Aachen', zone: 'Ost', status: 'ausstehend', eta_min: 18, km_entfernung: 3.4, zahlart: 'online', notiz: null, kunde_telefon: null, anweisungen: null },
    { stopp_nr: 5, order_id: 'o5', bestellnummer: '#1045', adresse: 'Pontstr. 14, 52062 Aachen', zone: 'Mitte', status: 'ausstehend', eta_min: 26, km_entfernung: 4.8, zahlart: 'karte', notiz: null, kunde_telefon: '+49 176 9876 5432', anweisungen: 'Hinterhof, Eingang Rückseite' },
  ],
};

function zahlartBadge(z: string) {
  if (z === 'bar') return 'bg-amber-900/50 text-amber-300 border border-amber-700/40';
  if (z === 'karte') return 'bg-blue-900/50 text-blue-300 border border-blue-700/40';
  return 'bg-green-900/40 text-green-300 border border-green-700/40';
}

function zahlartLabel(z: string) {
  if (z === 'bar') return '💵 Bar';
  if (z === 'karte') return '💳 Karte';
  return '📱 Online';
}

function stoppBorder(s: string) {
  if (s === 'aktiv') return 'border-amber-500/60 bg-amber-950/20';
  if (s === 'geliefert') return 'border-slate-700/40 bg-slate-900/30 opacity-70';
  if (s === 'verspaetet') return 'border-red-600/50 bg-red-950/20';
  return 'border-slate-700/30 bg-slate-900/20';
}

function fortschrittPct(fertig: number, gesamt: number) {
  if (gesamt === 0) return 0;
  return Math.round((fertig / gesamt) * 100);
}

export function FahrerPhase5000SmartTourStoppNavV11({ driverId }: { driverId: string }) {
  const [data, setData] = useState<TourData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (!data) return null;

  const aktivStopp = data.stopps.find(s => s.status === 'aktiv');
  const ausstehend = data.stopps.filter(s => s.status === 'ausstehend');
  const fertig = data.stopps.filter(s => s.status === 'geliefert');

  const stoppPct = fortschrittPct(data.stopps_fertig, data.stopps_gesamt);
  const kmPct = data.km_gesamt > 0 ? Math.round((data.km_zurueck / data.km_gesamt) * 100) : 0;

  function openNavi(stopp: TourStopp) {
    const encoded = encodeURIComponent(stopp.adresse);
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-blue-800/40 bg-slate-950/70 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Tour-Stopp Navigator V11</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Route className="w-3.5 h-3.5" />
          <span>{data.stopps_fertig}/{data.stopps_gesamt} Stopps</span>
        </div>
      </div>

      {/* Dual Fortschrittsbalken */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Stopps-Fortschritt</span>
            <span>{stoppPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${stoppPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>km-Fortschritt</span>
            <span>{data.km_zurueck.toFixed(1)}/{data.km_gesamt.toFixed(1)} km</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${kmPct}%` }} />
          </div>
        </div>
      </div>

      {/* Verdienst Strip */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-slate-900/60 border border-slate-800/50 p-2 text-center">
          <div className="text-xs text-slate-500">Verdienst</div>
          <div className="text-base font-bold font-mono text-emerald-400">{data.verdienst_eur.toFixed(2)} €</div>
        </div>
        <div className="flex-1 rounded-lg bg-slate-900/60 border border-slate-800/50 p-2 text-center">
          <div className="text-xs text-slate-500">Trinkgeld</div>
          <div className="text-base font-bold font-mono text-amber-400">{data.trinkgeld_eur.toFixed(2)} €</div>
        </div>
        <div className="flex-1 rounded-lg bg-slate-900/60 border border-slate-800/50 p-2 text-center">
          <div className="text-xs text-slate-500">Schicht</div>
          <div className="text-base font-bold font-mono text-blue-400">{data.schicht_touren_fertig}/{data.schicht_ziel_touren}</div>
        </div>
      </div>

      {/* Aktiver Stopp (Hero) */}
      {aktivStopp && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-sm font-semibold text-amber-300">Jetzt liefern — Stopp {aktivStopp.stopp_nr}</span>
            </div>
            {aktivStopp.eta_min !== null && (
              <div className="flex items-center gap-1 text-xs text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>~{aktivStopp.eta_min} min</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 mb-3">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-slate-200 font-medium">{aktivStopp.adresse}</div>
              <div className="text-xs text-slate-400">{aktivStopp.zone} · {aktivStopp.km_entfernung?.toFixed(1)} km</div>
            </div>
          </div>

          {/* Notiz */}
          {aktivStopp.notiz && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-700/40 bg-yellow-950/20 px-2.5 py-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <span className="text-xs text-yellow-300">{aktivStopp.notiz}</span>
            </div>
          )}

          {/* Anweisungen */}
          {aktivStopp.anweisungen && (
            <div className="text-xs text-slate-400 mb-2 flex items-start gap-1.5">
              <span className="shrink-0">ℹ️</span>
              <span>{aktivStopp.anweisungen}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openNavi(aktivStopp)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 border border-blue-500/50 py-2 text-sm font-medium text-white transition-colors"
            >
              <Navigation2 className="w-4 h-4" />
              Google Maps
            </button>
            {aktivStopp.kunde_telefon && (
              <a
                href={`tel:${aktivStopp.kunde_telefon}`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 px-3 py-2 text-sm text-slate-200 transition-colors"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Zahlart */}
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs px-2 py-1 rounded ${zahlartBadge(aktivStopp.zahlart)}`}>
              {zahlartLabel(aktivStopp.zahlart)}
            </span>
            <span className="text-xs text-slate-500">{aktivStopp.bestellnummer}</span>
          </div>
        </div>
      )}

      {/* Ausstehende Stopps */}
      {ausstehend.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Nächste Stopps</div>
          {ausstehend.map(stopp => (
            <div key={stopp.order_id} className={`rounded-xl border p-2.5 ${stoppBorder(stopp.status)}`}>
              <button
                className="w-full flex items-center justify-between"
                onClick={() => toggleExpand(stopp.order_id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-5 shrink-0">{stopp.stopp_nr}.</span>
                  <div className="text-left">
                    <div className="text-sm text-slate-300 truncate max-w-[180px]">{stopp.adresse}</div>
                    <div className="text-xs text-slate-500">{stopp.zone} · {stopp.km_entfernung?.toFixed(1)} km</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stopp.eta_min !== null && (
                    <span className="text-xs text-slate-400 font-mono">~{stopp.eta_min} min</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${zahlartBadge(stopp.zahlart)}`}>
                    {stopp.zahlart === 'bar' ? 'Bar' : stopp.zahlart === 'karte' ? 'Karte' : 'Online'}
                  </span>
                  {expanded.has(stopp.order_id)
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  }
                </div>
              </button>

              {/* Erweiterte Details */}
              {expanded.has(stopp.order_id) && (
                <div className="mt-2 border-t border-slate-700/40 pt-2 space-y-1.5">
                  {stopp.notiz && (
                    <div className="flex items-start gap-1.5 text-xs text-yellow-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                      <span>{stopp.notiz}</span>
                    </div>
                  )}
                  {stopp.anweisungen && (
                    <div className="text-xs text-slate-400">ℹ️ {stopp.anweisungen}</div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openNavi(stopp)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Navigation2 className="w-3.5 h-3.5" />
                      Navi
                    </button>
                    {stopp.kunde_telefon && (
                      <a href={`tel:${stopp.kunde_telefon}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300">
                        <Phone className="w-3.5 h-3.5" />
                        Anrufen
                      </a>
                    )}
                    <span className="text-xs text-slate-500 ml-auto">{stopp.bestellnummer}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Abgeschlossene (kompakt) */}
      {fertig.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fertig.map(stopp => (
            <div key={stopp.order_id} className="flex items-center gap-1 rounded-lg border border-slate-700/30 bg-slate-900/30 px-2 py-1 opacity-60">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-slate-500 font-mono">{stopp.bestellnummer}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
