'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, CheckCircle2, Navigation, Clock, Zap, AlertTriangle, ChevronDown, ChevronUp, Package, Euro, MessageSquare } from 'lucide-react';

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
}

interface TourData {
  batch_id: string;
  aktiver_stopp_idx: number;
  gesamt_stopps: number;
  abgeschlossen: number;
  eta_gesamt_rest_min: number | null;
  gesamt_betrag_eur: number;
  stopps: Stopp[];
}

const MOCK: TourData = {
  batch_id: 'mock-batch',
  aktiver_stopp_idx: 1,
  gesamt_stopps: 3,
  abgeschlossen: 1,
  eta_gesamt_rest_min: 26,
  gesamt_betrag_eur: 57.4,
  stopps: [
    {
      id: 's1', reihenfolge: 1, adresse: 'Kaiserstr. 7, 52062 Aachen', bestellnummer: '#1040',
      kunde_name: 'K. Schmidt', kunde_telefon: '+4924112345', eta_min: null,
      status: 'abgeschlossen', versp_min: 0, notiz: null, betrag_eur: 18.5, zahlungsart: 'karte',
    },
    {
      id: 's2', reihenfolge: 2, adresse: 'Elisenstr. 5, 52062 Aachen', bestellnummer: '#1041',
      kunde_name: 'A. Müller', kunde_telefon: '+4924167890', eta_min: 8,
      status: 'aktiv', versp_min: 0, notiz: 'Klingel defekt, bitte anrufen', betrag_eur: 24.0, zahlungsart: 'bar',
    },
    {
      id: 's3', reihenfolge: 3, adresse: 'Pontstr. 12, 52062 Aachen', bestellnummer: '#1042',
      kunde_name: 'B. Weber', kunde_telefon: null, eta_min: 22,
      status: 'ausstehend', versp_min: 0, notiz: null, betrag_eur: 14.9, zahlungsart: 'karte',
    },
  ],
};

function openNavi(adresse: string) {
  const q = encodeURIComponent(adresse);
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    window.open(`maps://maps.apple.com/?q=${q}`, '_blank');
  } else {
    window.open(`https://maps.google.com/maps?q=${q}`, '_blank');
  }
}

interface Props {
  driverId: string;
  activeBatchId: string;
}

export function FahrerPhase4395TourStoppNavigatorV4({ driverId, activeBatchId }: Props) {
  const [data, setData] = useState<TourData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s2']));

  const load = useCallback(async () => {
    if (!driverId || !activeBatchId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}&batch_id=${activeBatchId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [driverId, activeBatchId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const aktiverStopp = data.stopps.find((s) => s.status === 'aktiv');
  const donePct = data.gesamt_stopps > 0 ? Math.round((data.abgeschlossen / data.gesamt_stopps) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Sticky top bar: aktiver Stopp */}
      {aktiverStopp && (
        <div className="bg-blue-600 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Navigation className="w-4 h-4 text-blue-200 flex-shrink-0" />
            <span className="text-xs font-bold text-white flex-1 truncate">{aktiverStopp.adresse}</span>
            {aktiverStopp.eta_min != null && (
              <span className="text-[10px] font-bold text-blue-200 flex-shrink-0">~{aktiverStopp.eta_min}m</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openNavi(aktiverStopp.adresse)}
              className="flex-1 flex items-center justify-center gap-1 bg-white text-blue-700 rounded-lg py-1.5 text-[11px] font-bold"
            >
              <Navigation className="w-3.5 h-3.5" />Navigation
            </button>
            {aktiverStopp.kunde_telefon && (
              <a
                href={`tel:${aktiverStopp.kunde_telefon}`}
                className="flex items-center justify-center gap-1 bg-blue-500 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold"
              >
                <Phone className="w-3.5 h-3.5" />Anrufen
              </a>
            )}
          </div>
          {aktiverStopp.notiz && (
            <div className="mt-1.5 flex items-center gap-1 bg-blue-500 rounded-lg px-2 py-1">
              <MessageSquare className="w-3 h-3 text-blue-200 flex-shrink-0" />
              <span className="text-[10px] text-blue-100 font-medium">{aktiverStopp.notiz}</span>
            </div>
          )}
          {aktiverStopp.zahlungsart === 'bar' && aktiverStopp.betrag_eur != null && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-200 font-bold">
              <Euro className="w-3 h-3" />Bar kassieren: {aktiverStopp.betrag_eur.toFixed(2)} €
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-2.5">

        {/* Progress + Stats */}
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>{data.abgeschlossen}/{data.gesamt_stopps} Stopps</span>
              <span>{donePct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${donePct}%` }} />
            </div>
          </div>
          {data.eta_gesamt_rest_min != null && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 flex-shrink-0">
              <Clock className="w-3 h-3" />~{data.eta_gesamt_rest_min}m gesamt
            </span>
          )}
          {loading && <span className="w-2 h-2 border-2 border-blue-300 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
        </div>

        {/* Gesamt-Betrag */}
        {data.gesamt_betrag_eur > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
            <Package className="w-3 h-3 text-gray-400" />
            <span>Tour gesamt:</span>
            <span className="font-bold text-gray-800">{data.gesamt_betrag_eur.toFixed(2)} €</span>
            <span className="ml-auto text-gray-400">
              {data.stopps.filter((s) => s.zahlungsart === 'bar').length}× bar ·
              {' '}{data.stopps.filter((s) => s.zahlungsart === 'karte').length}× karte
            </span>
          </div>
        )}

        {/* Stopp-Liste */}
        <div className="space-y-1">
          {data.stopps.map((stopp) => {
            const isDone = stopp.status === 'abgeschlossen';
            const isActive = stopp.status === 'aktiv';
            const isExpanded = expanded.has(stopp.id);
            const hasDelay = stopp.versp_min > 0;

            return (
              <div key={stopp.id}>
                <button
                  onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(stopp.id) ? n.delete(stopp.id) : n.add(stopp.id); return n; })}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left border transition-colors ${
                    isDone ? 'bg-gray-50 border-gray-100' :
                    isActive ? 'bg-blue-50 border-blue-200' :
                    'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : isActive ? 'bg-blue-600' : 'bg-gray-100'}`}>
                    {isDone
                      ? <CheckCircle2 className="w-3 h-3 text-green-600" />
                      : isActive
                        ? <span className="text-[9px] font-bold text-white">{stopp.reihenfolge}</span>
                        : <span className="text-[9px] font-bold text-gray-400">{stopp.reihenfolge}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold truncate ${isDone ? 'text-gray-400 line-through' : isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                        {stopp.adresse}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      <span>{stopp.bestellnummer}</span>
                      {stopp.kunde_name && <span>· {stopp.kunde_name}</span>}
                      {stopp.zahlungsart === 'bar' && <span className="text-amber-600 font-medium">· Bar</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasDelay && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    {stopp.notiz && <MessageSquare className="w-3 h-3 text-blue-400" />}
                    {stopp.eta_min != null && !isDone && (
                      <span className={`text-[10px] font-bold ${hasDelay ? 'text-red-500' : isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                        {stopp.eta_min}m
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-300" /> : <ChevronDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </button>

                {isExpanded && !isDone && (
                  <div className="ml-7 mt-0.5 px-2 py-1.5 bg-gray-50 rounded-lg space-y-1.5">
                    {stopp.notiz && (
                      <div className="flex items-start gap-1 text-[9px] text-blue-700 font-medium">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-400" />
                        {stopp.notiz}
                      </div>
                    )}
                    {stopp.betrag_eur != null && (
                      <div className="flex items-center gap-1 text-[9px] text-gray-500">
                        <Euro className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-gray-700">{stopp.betrag_eur.toFixed(2)} €</span>
                        <span className="text-gray-400">· {stopp.zahlungsart === 'bar' ? 'Barzahlung' : 'Kartenzahlung'}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openNavi(stopp.adresse)}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white rounded-lg py-1 text-[10px] font-bold"
                      >
                        <Navigation className="w-3 h-3" />Navi
                      </button>
                      {stopp.kunde_telefon && (
                        <a
                          href={`tel:${stopp.kunde_telefon}`}
                          className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 rounded-lg py-1 text-[10px] font-bold"
                        >
                          <Phone className="w-3 h-3" />Anrufen
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100">
          <span className="flex items-center gap-0.5"><MapPin className="w-2 h-2" />Tour-Stopp-Navigator V4</span>
          <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />20s</span>
        </div>
      </div>
    </div>
  );
}
