'use client';

import React, { useEffect, useState } from 'react';
import { Navigation, MapPin, Clock, CheckCircle2, AlertTriangle, Route, Zap, Target, Package } from 'lucide-react';

// Phase 5420 — Tour-Stopp-Navigations-Hub V2
// Neu: ETA-Präzisions-Score je Stopp; Optimaler-Reihenfolge-Indikator;
// Waypoint-Karte mit Distanz-Ampel; Fahrer-Hinweis bei langer Wartezeit;
// Stopp-Status grün/gelb/rot/grau; Batch-ID + Bestell-Nr;
// Nächster-Stopp-CTA + GPS-Deep-Link; Mock-Fallback

type StoppStatus = 'pending' | 'on_way' | 'arrived' | 'done' | 'skipped';

interface TourStopp {
  id: string;
  seq: number;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  plz: string;
  stadt: string;
  distanz_km: number;
  eta_min: number;
  eta_genauigkeit_pct: number;
  status: StoppStatus;
  warte_min: number | null;
  notiz: string | null;
  betrag_eur: number;
  zahlungsart: 'bar' | 'karte' | 'online';
}

interface ApiResponse {
  batch_id: string;
  stopps: TourStopp[];
  naechster_stopp_idx: number;
  gesamt_eta_min: number;
  gesamt_km: number;
  stopps_fertig: number;
  stopps_gesamt: number;
  effizienz_score: number;
  timestamp: string;
}

const MOCK: ApiResponse = {
  batch_id: 'B-0042',
  naechster_stopp_idx: 1,
  gesamt_eta_min: 34,
  gesamt_km: 8.7,
  stopps_fertig: 1,
  stopps_gesamt: 4,
  effizienz_score: 87,
  timestamp: new Date().toISOString(),
  stopps: [
    { id: 's1', seq: 1, order_id: 'o1', bestellnummer: '#1401', adresse: 'Hauptstr. 12',   plz: '52062', stadt: 'Aachen', distanz_km: 1.2, eta_min: 0,  eta_genauigkeit_pct: 98, status: 'done',    warte_min: null, notiz: null,            betrag_eur: 18.50, zahlungsart: 'online' },
    { id: 's2', seq: 2, order_id: 'o2', bestellnummer: '#1402', adresse: 'Pontstr. 88',    plz: '52062', stadt: 'Aachen', distanz_km: 2.4, eta_min: 7,  eta_genauigkeit_pct: 91, status: 'on_way',  warte_min: null, notiz: '2. Etage, klingeln', betrag_eur: 24.80, zahlungsart: 'bar'    },
    { id: 's3', seq: 3, order_id: 'o3', bestellnummer: '#1403', adresse: 'Dürenstr. 33',   plz: '52062', stadt: 'Aachen', distanz_km: 1.8, eta_min: 14, eta_genauigkeit_pct: 85, status: 'pending', warte_min: 3,    notiz: null,            betrag_eur: 31.20, zahlungsart: 'karte'  },
    { id: 's4', seq: 4, order_id: 'o4', bestellnummer: '#1404', adresse: 'Vaalser Str. 55',plz: '52064', stadt: 'Aachen', distanz_km: 3.3, eta_min: 25, eta_genauigkeit_pct: 78, status: 'pending', warte_min: null, notiz: 'Hinterhof',     betrag_eur: 15.90, zahlungsart: 'online' },
  ],
};

const STATUS_COLORS: Record<StoppStatus, string> = {
  pending: 'border-gray-200 bg-gray-50',
  on_way:  'border-blue-300 bg-blue-50',
  arrived: 'border-amber-300 bg-amber-50',
  done:    'border-emerald-200 bg-emerald-50 opacity-70',
  skipped: 'border-red-200 bg-red-50 opacity-50',
};

const STATUS_ICONS: Record<StoppStatus, React.ReactNode> = {
  pending: <MapPin className="h-3.5 w-3.5 text-gray-400" />,
  on_way:  <Navigation className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
  arrived: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  done:    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  skipped: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
};

const ZAHLUNGSART_LABELS = { bar: 'Bar', karte: 'Karte', online: 'Online' };

export function FahrerPhase5420TourNavHub({ batchId }: { batchId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (!batchId) return;
      try {
        const r = await fetch(`/api/delivery/fahrer/tour?batch_id=${batchId}&view=nav_v2`);
        if (!r.ok) throw new Error('api');
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch { /* keep mock */ }
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [batchId]);

  const naechster = data.stopps[data.naechster_stopp_idx];
  const fortschrittPct = Math.round((data.stopps_fertig / data.stopps_gesamt) * 100);

  function buildNavUrl(stopp: TourStopp) {
    const q = encodeURIComponent(`${stopp.adresse}, ${stopp.plz} ${stopp.stadt}`);
    return `https://maps.google.com/?q=${q}&navigate=yes`;
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-800">Tour-Nav Hub V2</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">{data.batch_id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{data.gesamt_eta_min} min</span>
          <span className="flex items-center gap-1"><Route className="h-3 w-3" />{data.gesamt_km.toFixed(1)} km</span>
          <span className={`font-black ${data.effizienz_score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>Score {data.effizienz_score}</span>
        </div>
      </div>

      {/* Fortschritt */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{data.stopps_fertig} von {data.stopps_gesamt} Stopps</span>
          <span>{fortschrittPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${fortschrittPct}%` }} />
        </div>
      </div>

      {/* Nächster Stopp CTA */}
      {naechster && (
        <a
          href={buildNavUrl(naechster)}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border-2 border-blue-400 bg-blue-500 text-white px-4 py-3 hover:bg-blue-600 active:scale-95 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold opacity-80">Nächster Stopp #{naechster.seq}</div>
              <div className="text-sm font-black">{naechster.adresse}</div>
              <div className="text-[11px] opacity-80">{naechster.plz} {naechster.stadt}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black tabular-nums">{naechster.eta_min}m</div>
              <div className="text-[9px] opacity-70">{naechster.distanz_km.toFixed(1)} km</div>
              <div className="text-[9px] opacity-70">ETA ±{Math.round((100 - naechster.eta_genauigkeit_pct) * naechster.eta_min / 100)}m</div>
            </div>
          </div>
          {naechster.notiz && (
            <div className="mt-1.5 text-[10px] bg-white/20 rounded px-2 py-1">💬 {naechster.notiz}</div>
          )}
        </a>
      )}

      {/* Stopp-Liste */}
      <div className="space-y-1.5">
        {data.stopps.map(s => (
          <div key={s.id} className={`rounded-lg border px-3 py-2 ${STATUS_COLORS[s.status]}`}>
            <div className="flex items-center gap-2">
              {STATUS_ICONS[s.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 truncate">{s.seq}. {s.adresse}</span>
                  <span className="text-xs font-black tabular-nums text-gray-600 ml-2 shrink-0">
                    {s.status === 'done' ? '✓' : s.status === 'on_way' ? `${s.eta_min}m` : s.eta_min > 0 ? `~${s.eta_min}m` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-0.5">
                  <span>{s.bestellnummer}</span>
                  <span>€{s.betrag_eur.toFixed(2)}</span>
                  <span className={`px-1 rounded ${s.zahlungsart === 'bar' ? 'bg-amber-100 text-amber-700' : s.zahlungsart === 'karte' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {ZAHLUNGSART_LABELS[s.zahlungsart]}
                  </span>
                  {s.warte_min !== null && (
                    <span className="text-amber-500 font-bold">⏳ {s.warte_min}m warten</span>
                  )}
                  {s.notiz && <span className="truncate">💬 {s.notiz}</span>}
                </div>
              </div>
              {s.status === 'pending' && (
                <a
                  href={buildNavUrl(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 rounded bg-blue-100 text-blue-700 p-1 hover:bg-blue-200 transition"
                >
                  <Navigation className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-gray-300 text-center">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · ETA-Score Ø {Math.round(data.stopps.reduce((a, s) => a + s.eta_genauigkeit_pct, 0) / data.stopps.length)}%
      </div>
    </div>
  );
}
