'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, CheckCircle2, Navigation, Clock, Zap, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

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
}

interface TourData {
  batch_id: string;
  aktiver_stopp_idx: number;
  gesamt_stopps: number;
  abgeschlossen: number;
  eta_gesamt_rest_min: number | null;
  stopps: Stopp[];
}

const MOCK: TourData = {
  batch_id: 'mock-batch',
  aktiver_stopp_idx: 1,
  gesamt_stopps: 3,
  abgeschlossen: 1,
  eta_gesamt_rest_min: 26,
  stopps: [
    {
      id: 's1', reihenfolge: 1, adresse: 'Kaiserstr. 7, 52062 Aachen', bestellnummer: '#1040',
      kunde_name: 'K. Schmidt', kunde_telefon: '+4924112345', eta_min: null,
      status: 'abgeschlossen', versp_min: 0, notiz: null, betrag_eur: 18.5,
    },
    {
      id: 's2', reihenfolge: 2, adresse: 'Elisenstr. 5, 52062 Aachen', bestellnummer: '#1041',
      kunde_name: 'A. Müller', kunde_telefon: '+4924167890', eta_min: 8,
      status: 'aktiv', versp_min: 0, notiz: 'Klingel defekt, bitte anrufen', betrag_eur: 24.0,
    },
    {
      id: 's3', reihenfolge: 3, adresse: 'Pontstr. 12, 52062 Aachen', bestellnummer: '#1042',
      kunde_name: 'B. Weber', kunde_telefon: null, eta_min: 22,
      status: 'ausstehend', versp_min: 0, notiz: null, betrag_eur: 14.9,
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

export function FahrerPhase4380TourStoppNavigatorV3({ driverId, activeBatchId }: Props) {
  const [data, setData] = useState<TourData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s2'])); // Aktiver Stopp geöffnet

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

  const donePct = data.gesamt_stopps > 0 ? Math.round((data.abgeschlossen / data.gesamt_stopps) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-900">Tour-Stopps</span>
          {loading && <span className="w-2 h-2 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{data.abgeschlossen}/{data.gesamt_stopps} fertig</span>
          {data.eta_gesamt_rest_min != null && (
            <span className="text-blue-600 font-semibold">~{data.eta_gesamt_rest_min}m</span>
          )}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="space-y-0.5">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${donePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-gray-400">
          <span>{donePct}% abgeschlossen</span>
          <span>{data.gesamt_stopps - data.abgeschlossen} noch offen</span>
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="space-y-1.5">
        {data.stopps.map((stopp) => {
          const isDone = stopp.status === 'abgeschlossen';
          const isActive = stopp.status === 'aktiv';
          const isExpanded = expanded.has(stopp.id);

          return (
            <div
              key={stopp.id}
              className={`rounded-lg border overflow-hidden ${
                isActive ? 'border-blue-300 bg-blue-50' : isDone ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'
              }`}
            >
              {/* Stopp-Header */}
              <button
                onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(stopp.id) ? n.delete(stopp.id) : n.add(stopp.id); return n; })}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
              >
                {/* Status-Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : isActive ? 'bg-blue-200' : 'bg-gray-100'}`}>
                  {isDone
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    : isActive
                      ? <Zap className="w-3.5 h-3.5 text-blue-600" />
                      : <span className="text-[9px] font-bold text-gray-500">{stopp.reihenfolge}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-semibold ${isDone ? 'text-gray-400 line-through' : isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                      {stopp.bestellnummer}
                    </span>
                    {stopp.versp_min > 0 && (
                      <span className="text-[8px] text-red-500 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />+{stopp.versp_min}m
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] truncate ${isDone ? 'text-gray-400' : 'text-gray-600'}`}>{stopp.adresse}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {stopp.eta_min != null && !isDone && (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {stopp.eta_min}m
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-100">
                  {/* Kundendetails */}
                  {stopp.kunde_name && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600 pt-1.5">
                      <Package className="w-3 h-3 text-gray-400" />
                      <span>{stopp.kunde_name}</span>
                      {stopp.betrag_eur != null && (
                        <span className="ml-auto font-semibold text-gray-700">€{stopp.betrag_eur.toFixed(2)}</span>
                      )}
                    </div>
                  )}

                  {/* Notiz */}
                  {stopp.notiz && (
                    <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{stopp.notiz}</span>
                    </div>
                  )}

                  {/* Aktions-Buttons */}
                  {!isDone && (
                    <div className="flex gap-1.5 pt-0.5">
                      <button
                        onClick={() => openNavi(stopp.adresse)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-semibold"
                      >
                        <Navigation className="w-3 h-3" />Navigation
                      </button>
                      {stopp.kunde_telefon && (
                        <a
                          href={`tel:${stopp.kunde_telefon}`}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-[10px] font-semibold"
                        >
                          <Phone className="w-3 h-3" />
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

      <div className="flex items-center justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-0.5"><MapPin className="w-2 h-2" />Navigation öffnet Karten-App</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />20s</span>
      </div>
    </div>
  );
}
