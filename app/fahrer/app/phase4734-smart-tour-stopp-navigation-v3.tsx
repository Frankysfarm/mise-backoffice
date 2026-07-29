'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, Phone, CheckCircle2, AlertTriangle, Clock, Zap, Package, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';

interface StoppRow {
  stopp_nr: number;
  adresse: string;
  kunden_name: string;
  kunden_tel: string | null;
  notiz: string | null;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'fehlgeschlagen' | 'batch';
  eta_min: number | null;
  distanz_km: number | null;
  zahlung: 'bar' | 'karte' | 'online';
  storno_risiko: boolean;
}

interface TourHeader {
  tour_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  abgeschlossen: number;
  restzeit_min: number;
  effizienz_pct: number;
  score: number;
  ist_batch: boolean;
}

interface ApiResponse {
  header: TourHeader;
  stopps: StoppRow[];
  is_online: boolean;
  storno_risiko_banner: string | null;
}

const MOCK: ApiResponse = {
  is_online: true,
  storno_risiko_banner: null,
  header: {
    tour_id: 't1',
    fahrer_name: 'Kai B.',
    gesamt_stopps: 4,
    abgeschlossen: 1,
    restzeit_min: 22,
    effizienz_pct: 88,
    score: 91,
    ist_batch: true,
  },
  stopps: [
    { stopp_nr: 1, adresse: 'Hauptstr. 12, Aachen', kunden_name: 'M. Weber', kunden_tel: '+49151', notiz: null, status: 'geliefert', eta_min: null, distanz_km: null, zahlung: 'online', storno_risiko: false },
    { stopp_nr: 2, adresse: 'Goethestr. 5, Aachen', kunden_name: 'L. Müller', kunden_tel: '+49152', notiz: 'Klingel defekt, bitte anrufen', status: 'aktiv', eta_min: 4, distanz_km: 1.2, zahlung: 'bar', storno_risiko: false },
    { stopp_nr: 3, adresse: 'Marktplatz 3, Aachen', kunden_name: 'J. Schmidt', kunden_tel: null, notiz: null, status: 'batch', eta_min: 10, distanz_km: 2.8, zahlung: 'karte', storno_risiko: false },
    { stopp_nr: 4, adresse: 'Bergstr. 8, Aachen', kunden_name: 'S. Klein', kunden_tel: '+49153', notiz: '2. OG links', status: 'ausstehend', eta_min: 18, distanz_km: 4.1, zahlung: 'online', storno_risiko: true },
  ],
};

const STOPP_STYLE = {
  geliefert:     { bg: 'bg-emerald-900/40', border: 'border-emerald-700', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Geliefert' },
  aktiv:         { bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-200', dot: 'bg-blue-400', label: 'Aktiv' },
  ausstehend:    { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300', dot: 'bg-gray-500', label: 'Ausstehend' },
  fehlgeschlagen:{ bg: 'bg-red-900/60', border: 'border-red-600', text: 'text-red-300', dot: 'bg-red-400', label: 'Fehlgeschlagen' },
  batch:         { bg: 'bg-amber-900/40', border: 'border-amber-600', text: 'text-amber-300', dot: 'bg-amber-400', label: 'Batch' },
};

function openNavi(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.open(`maps://?q=${encoded}`, '_blank');
  } else {
    window.open(`geo:0,0?q=${encoded}`, '_blank');
  }
}

export function FahrerPhase4734SmartTourStoppNavigationV3({ driverId }: { driverId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expandedStopp, setExpandedStopp] = useState<number | null>(null);

  async function load() {
    if (!driverId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stopp-navigation-v3?driver_id=${driverId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [driverId]);

  if (!data) return (
    <div className="rounded-2xl bg-gray-900 p-4 text-gray-400 text-sm animate-pulse flex items-center gap-2">
      <Navigation2 className="w-4 h-4 text-blue-400" />
      Lade Tour-Navigation V3…
    </div>
  );

  if (!data.is_online) return (
    <div className="rounded-2xl bg-gray-900 p-4 flex items-center gap-3 text-gray-400">
      <WifiOff className="w-5 h-5" />
      <div>
        <p className="font-semibold text-gray-200">Offline</p>
        <p className="text-xs">Keine aktive Tour gefunden</p>
      </div>
    </div>
  );

  const { header, stopps } = data;
  const aktiverStopp = stopps.find(s => s.status === 'aktiv');
  const naechsterStopp = stopps.find(s => s.status === 'ausstehend' || s.status === 'batch');
  const scoreColor = header.score >= 80 ? 'text-emerald-400' : header.score >= 65 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-blue-400" />
          <div>
            <p className="font-semibold text-gray-100 text-sm">Tour-Navigation V3</p>
            <p className="text-[10px] text-gray-500">{header.fahrer_name}</p>
          </div>
          {header.ist_batch && <Zap className="w-3.5 h-3.5 text-amber-400" />}
        </div>
        <div className={`text-2xl font-black ${scoreColor}`}>{header.score}</div>
      </div>

      {/* Tour Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{header.abgeschlossen}/{header.gesamt_stopps} Stopps</span>
          <span>~{header.restzeit_min} min verbleibend</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(header.abgeschlossen / header.gesamt_stopps) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-blue-400">Effizienz {header.effizienz_pct}%</span>
          <span className={`${scoreColor}`}>Score {header.score}</span>
        </div>
      </div>

      {/* Storno-Risiko Banner */}
      {data.storno_risiko_banner && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/60 border border-red-600 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {data.storno_risiko_banner}
        </div>
      )}

      {/* Aktiver Stopp Hero */}
      {aktiverStopp && (
        <div className="rounded-xl bg-blue-900 border border-blue-500 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-200">Stopp #{aktiverStopp.stopp_nr} — Aktiv</span>
              {aktiverStopp.storno_risiko && <AlertTriangle className="w-3 h-3 text-red-400" />}
            </div>
            {aktiverStopp.eta_min !== null && (
              <span className="text-xs text-blue-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />~{aktiverStopp.eta_min} min
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{aktiverStopp.kunden_name}</p>
            <p className="text-xs text-blue-300 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              {aktiverStopp.adresse}
              {aktiverStopp.distanz_km !== null && <span className="text-blue-500">· {aktiverStopp.distanz_km} km</span>}
            </p>
          </div>
          {aktiverStopp.notiz && (
            <div className="rounded-lg bg-amber-900/40 border border-amber-700 px-2 py-1.5 text-amber-300 text-[10px]">
              ⚠ {aktiverStopp.notiz}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => openNavi(aktiverStopp.adresse)}
              className="flex-1 rounded-lg bg-blue-600 active:bg-blue-700 py-2.5 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              Navigieren
            </button>
            {aktiverStopp.kunden_tel && (
              <a
                href={`tel:${aktiverStopp.kunden_tel}`}
                className="rounded-lg bg-gray-700 active:bg-gray-600 px-3 py-2.5 flex items-center justify-center"
              >
                <Phone className="w-4 h-4 text-gray-300" />
              </a>
            )}
            <div className="rounded-lg bg-gray-700 px-3 py-2.5 flex items-center justify-center">
              <span className="text-[10px] text-gray-300 font-semibold">
                {aktiverStopp.zahlung === 'bar' ? '💵 Bar' : aktiverStopp.zahlung === 'karte' ? '💳 Karte' : '✅ Online'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nächster Stopp Preview */}
      {naechsterStopp && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-3">
          <p className="text-[10px] text-gray-500 mb-1.5">Nächster Stopp</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {naechsterStopp.status === 'batch' && <Zap className="w-3 h-3 text-amber-400" />}
              <p className="text-xs font-semibold text-gray-200">{naechsterStopp.kunden_name}</p>
            </div>
            {naechsterStopp.eta_min !== null && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />~{naechsterStopp.eta_min} min
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {naechsterStopp.adresse}
          </p>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Alle Stopps</p>
        {stopps.map(s => {
          const sStyle = STOPP_STYLE[s.status];
          const isExp = expandedStopp === s.stopp_nr;
          return (
            <div
              key={s.stopp_nr}
              className={`rounded-xl border p-2.5 cursor-pointer ${sStyle.bg} ${sStyle.border}`}
              onClick={() => setExpandedStopp(isExp ? null : s.stopp_nr)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sStyle.dot}`} />
                  <span className={`text-xs font-semibold ${sStyle.text}`}>#{s.stopp_nr} {s.kunden_name}</span>
                  {s.storno_risiko && <AlertTriangle className="w-2.5 h-2.5 text-red-400" />}
                </div>
                <div className="flex items-center gap-2">
                  {s.eta_min !== null && (
                    <span className={`text-[9px] ${sStyle.text}`}>{s.eta_min}′</span>
                  )}
                  {s.status === 'geliefert' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {s.status === 'batch' && <Package className="w-3.5 h-3.5 text-amber-400" />}
                  {isExp ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                </div>
              </div>
              {isExp && (
                <div className="mt-2 space-y-1 text-[10px] border-t border-gray-700/50 pt-2">
                  <p className={`${sStyle.text} flex items-center gap-1`}><MapPin className="w-2.5 h-2.5" />{s.adresse}</p>
                  {s.notiz && <p className="text-amber-300">⚠ {s.notiz}</p>}
                  <div className="flex gap-3">
                    <span className={sStyle.text}>Zahlung: {s.zahlung === 'bar' ? '💵 Bar' : s.zahlung === 'karte' ? '💳 Karte' : '✅ Online'}</span>
                    {s.distanz_km !== null && <span className={sStyle.text}>{s.distanz_km} km</span>}
                  </div>
                  {(s.status === 'aktiv' || s.status === 'ausstehend' || s.status === 'batch') && (
                    <button
                      onClick={e => { e.stopPropagation(); openNavi(s.adresse); }}
                      className="mt-1 rounded-lg bg-blue-700 px-3 py-1.5 text-blue-200 font-semibold flex items-center gap-1"
                    >
                      <Navigation2 className="w-2.5 h-2.5" />
                      Navigieren
                    </button>
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
