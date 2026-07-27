'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, CheckCircle2, Navigation, Clock, Zap, AlertTriangle, ChevronDown, ChevronUp, Package, Euro, MessageSquare, TrendingUp, Star, RefreshCw } from 'lucide-react';

interface Stopp {
  id: string;
  reihenfolge: number;
  adresse: string;
  bestellnummer: string;
  kunde_name: string | null;
  kunde_telefon: string | null;
  eta_min: number | null;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen';
  versp_min: number;
  notiz: string | null;
  betrag_eur: number | null;
  zahlungsart: 'bar' | 'karte' | null;
  artikel: string[];
}

interface VerdiensteData {
  schicht_eur: number;
  ziel_eur: number;
  trinkgeld_eur: number;
  touren_heute: number;
}

interface TourData {
  batch_id: string;
  aktiver_stopp_idx: number;
  gesamt_stopps: number;
  abgeschlossen: number;
  eta_gesamt_rest_min: number | null;
  gesamt_betrag_eur: number;
  meine_score: number;
  meine_puenktlichkeit_pct: number;
  stopps: Stopp[];
  verdienste: VerdiensteData;
}

const MOCK: TourData = {
  batch_id: 'mock-batch-v5',
  aktiver_stopp_idx: 1,
  gesamt_stopps: 3,
  abgeschlossen: 1,
  eta_gesamt_rest_min: 28,
  gesamt_betrag_eur: 64.9,
  meine_score: 88,
  meine_puenktlichkeit_pct: 91,
  verdienste: {
    schicht_eur: 47.5,
    ziel_eur: 80,
    trinkgeld_eur: 6.2,
    touren_heute: 6,
  },
  stopps: [
    {
      id: 's1', reihenfolge: 1, adresse: 'Kaiserstr. 7, 52062 Aachen', bestellnummer: '#1050',
      kunde_name: 'K. Schmidt', kunde_telefon: '+4924112345', eta_min: null,
      status: 'abgeschlossen', versp_min: 0, notiz: null, betrag_eur: 18.5, zahlungsart: 'karte',
      artikel: ['Pizza Margherita', 'Cola'],
    },
    {
      id: 's2', reihenfolge: 2, adresse: 'Elisenstr. 5, 52062 Aachen', bestellnummer: '#1051',
      kunde_name: 'A. Müller', kunde_telefon: '+4924167890', eta_min: 9,
      status: 'aktiv', versp_min: 0, notiz: 'Klingel defekt — bitte anrufen!', betrag_eur: 27.5, zahlungsart: 'bar',
      artikel: ['Burger Set', 'Pasta Bolognese', 'Wasser'],
    },
    {
      id: 's3', reihenfolge: 3, adresse: 'Pontstr. 12, 52062 Aachen', bestellnummer: '#1052',
      kunde_name: 'B. Weber', kunde_telefon: '+4924199999', eta_min: 28,
      status: 'ausstehend', versp_min: 0, notiz: null, betrag_eur: 18.9, zahlungsart: 'karte',
      artikel: ['Salat Bowl', 'Limonade'],
    },
  ],
};

function mapsUrl(adresse: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase4410TourStoppNavigatorV5() {
  const [data, setData] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>('s2');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json?.batch_id) { setData(json); setLastRefresh(new Date()); }
    } catch { /* mock */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const i = setInterval(fetchData, 20_000);
    return () => clearInterval(i);
  }, [fetchData]);

  const aktiver = data.stopps.find(s => s.status === 'aktiv');
  const fortschritt = Math.round((data.abgeschlossen / data.gesamt_stopps) * 100);
  const verdienstPct = Math.min(100, Math.round((data.verdienste.schicht_eur / data.verdienste.ziel_eur) * 100));

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Sticky Nav-Bar für aktiven Stopp */}
      {aktiver && (
        <div className="bg-blue-600 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-white" />
              <div>
                <div className="text-xs font-bold text-white">{aktiver.adresse}</div>
                <div className="text-[10px] text-blue-200">
                  {aktiver.eta_min ? `~${aktiver.eta_min} Min. ETA` : 'Stopp aktiv'} · {aktiver.bestellnummer}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {aktiver.kunde_telefon && (
                <a href={`tel:${aktiver.kunde_telefon}`} className="p-1.5 rounded-full bg-blue-500 text-white">
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
              <a href={mapsUrl(aktiver.adresse)} target="_blank" rel="noreferrer" className="p-1.5 rounded-full bg-white text-blue-600">
                <Navigation className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          {/* Notiz-Alert */}
          {aktiver.notiz && (
            <div className="mt-2 flex items-start gap-1.5 bg-amber-400 rounded-lg px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-900 shrink-0 mt-0.5" />
              <span className="text-[11px] font-semibold text-amber-900">{aktiver.notiz}</span>
            </div>
          )}
          {/* Bar-Kassierhilfe */}
          {aktiver.zahlungsart === 'bar' && aktiver.betrag_eur && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-blue-500 rounded-lg px-2 py-1">
              <Euro className="w-3 h-3 text-blue-100" />
              <span className="text-[11px] text-blue-100 font-semibold">Bar kassieren: {aktiver.betrag_eur.toFixed(2).replace('.', ',')} €</span>
            </div>
          )}
        </div>
      )}

      {/* Tour-Header */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-stone-500" />
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
              Tour-Navigator V5
            </span>
          </div>
          <button onClick={fetchData} className="p-1 rounded bg-stone-100 dark:bg-stone-700 text-stone-500">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Fortschrittsbalken */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fortschritt}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
            {data.abgeschlossen}/{data.gesamt_stopps} Stopps
          </span>
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-stone-400">
          <span>{data.eta_gesamt_rest_min ? `~${data.eta_gesamt_rest_min}m Restzeit` : 'Letzte Tour'}</span>
          <span>Gesamt: {data.gesamt_betrag_eur.toFixed(2).replace('.', ',')} €</span>
        </div>
      </div>

      {/* Score + Pünktlichkeit Strip */}
      <div className="grid grid-cols-2 gap-px bg-stone-100 dark:bg-stone-800">
        <div className="px-3 py-2 bg-white dark:bg-stone-900 text-center">
          <div className={`text-xl font-bold ${data.meine_score >= 85 ? 'text-green-600' : data.meine_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.meine_score}
          </div>
          <div className="text-[10px] text-stone-500">Mein Score</div>
        </div>
        <div className="px-3 py-2 bg-white dark:bg-stone-900 text-center">
          <div className={`text-xl font-bold ${data.meine_puenktlichkeit_pct >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
            {data.meine_puenktlichkeit_pct}%
          </div>
          <div className="text-[10px] text-stone-500">Pünktlichkeit</div>
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {data.stopps.map(stopp => (
          <div key={stopp.id}>
            <button
              className={`w-full px-4 py-3 text-left transition-colors ${stopp.status === 'aktiv' ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}
              onClick={() => setExpanded(expanded === stopp.id ? null : stopp.id)}
            >
              <div className="flex items-start gap-3">
                {/* Status-Dot */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${
                  stopp.status === 'abgeschlossen' ? 'bg-green-500' :
                  stopp.status === 'aktiv' ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'
                }`}>
                  {stopp.status === 'abgeschlossen' ? <CheckCircle2 className="w-3.5 h-3.5" /> : stopp.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{stopp.adresse}</span>
                    {stopp.versp_min > 0 && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded font-semibold">
                        +{stopp.versp_min}m
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-400">
                    <span>{stopp.bestellnummer}</span>
                    {stopp.kunde_name && <span>{stopp.kunde_name}</span>}
                    {stopp.eta_min && stopp.status !== 'abgeschlossen' && (
                      <span className="text-blue-500">ETA {stopp.eta_min}m</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {stopp.zahlungsart === 'bar' && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                      Bar
                    </span>
                  )}
                  {expanded === stopp.id ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </div>
            </button>

            {/* Expandierte Details */}
            {expanded === stopp.id && (
              <div className="px-4 pb-3 bg-stone-50 dark:bg-stone-800 space-y-2">
                {/* Artikel */}
                {stopp.artikel.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {stopp.artikel.map((a, i) => (
                      <span key={i} className="text-[10px] bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 px-1.5 py-0.5 rounded text-stone-600 dark:text-stone-300">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {/* Betrag */}
                {stopp.betrag_eur && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <Euro className="w-3.5 h-3.5 text-stone-400" />
                    <span className="font-semibold text-stone-700 dark:text-stone-200">
                      {stopp.betrag_eur.toFixed(2).replace('.', ',')} € {stopp.zahlungsart === 'bar' ? '(Bar)' : '(Karte)'}
                    </span>
                  </div>
                )}
                {/* Aktions-Buttons */}
                {stopp.status !== 'abgeschlossen' && (
                  <div className="flex gap-2">
                    <a
                      href={mapsUrl(stopp.adresse)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigation starten
                    </a>
                    {stopp.kunde_telefon && (
                      <a
                        href={`tel:${stopp.kunde_telefon}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-200 dark:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verdienst-Strip */}
      <div className="px-4 py-3 border-t border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Schicht-Verdienst</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${verdienstPct >= 80 ? 'bg-green-500' : 'bg-yellow-500'} transition-all`} style={{ width: `${verdienstPct}%` }} />
          </div>
          <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200">
            {data.verdienste.schicht_eur.toFixed(2).replace('.', ',')} €
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-stone-400">
          <span>Ziel: {data.verdienste.ziel_eur} € · {data.verdienste.touren_heute} Touren</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            +{data.verdienste.trinkgeld_eur.toFixed(2).replace('.', ',')} € Trinkgeld
          </span>
        </div>
      </div>

      <div className="px-4 py-1.5 bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 flex justify-end">
        <span className="text-[9px] text-stone-400">↻ {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
