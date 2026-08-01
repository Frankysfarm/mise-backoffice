'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, Zap, Phone, Euro, AlertTriangle, Route, TrendingUp, ChevronDown, ChevronUp, Package, Star, WifiOff, Target, Coins } from 'lucide-react';

// Phase 5411 — Tour-Stops & Navigation Hub V9
// Neu: Trinkgeld-Erwartung je Stop (Betrag + Potential);
// Trinkgeld-Gesamt-Prognose; Effizienz-Score mit Trinkgeld-Faktor;
// 6-KPI-Grid Fertig/Offen/Vollst./Leer/Tip-Score/Tip-Prognose;
// GPS-Multi-App-Deeplinks; ETA-Konfidenz-Balken; Offline-Guard;
// 30-Sek-Polling; Mock-Fallback

type StopStatus = 'abgeschlossen' | 'aktiv' | 'ausstehend';
type TipPotential = 'hoch' | 'mittel' | 'niedrig';

interface TourStop {
  id: string;
  nr: number;
  adresse: string;
  lat: number;
  lng: number;
  kundename: string;
  telefon: string | null;
  status: StopStatus;
  eta_min: number;
  eta_konfidenz_pct: number;
  entfernung_km: number;
  zahlung: 'bar' | 'karte' | 'online';
  betrag_eur: number;
  trinkgeld_eur: number;
  trinkgeld_potential: TipPotential;
  ki_reihenfolge: number;
  notiz: string | null;
  bewertung: number | null;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  is_online: boolean;
  ki_score: number;
  ki_routen_qualitaet: number;
  vollstaendigkeit_pct: number;
  leerfahrten_pct: number;
  trinkgeld_score: number;
  trinkgeld_prognose_eur: number;
  stops: TourStop[];
  verdienst_gesamt_eur: number;
  trinkgeld_gesamt_eur: number;
  fertig_count: number;
  offen_count: number;
  timestamp: string;
}

const MOCK: TourData = {
  tour_id: 'T2026-083',
  fahrer_name: 'Lukas M.',
  is_online: true,
  ki_score: 96,
  ki_routen_qualitaet: 92,
  vollstaendigkeit_pct: 97,
  leerfahrten_pct: 7.4,
  trinkgeld_score: 88,
  trinkgeld_prognose_eur: 8.50,
  fertig_count: 3,
  offen_count: 2,
  verdienst_gesamt_eur: 52.40,
  trinkgeld_gesamt_eur: 5.10,
  timestamp: new Date().toISOString(),
  stops: [
    { id: 's1', nr: 1, adresse: 'Bahnhofstr. 12, 52064 Aachen', lat: 50.7753, lng: 6.0839, kundename: 'Thomas K.', telefon: '+4917612345678', status: 'abgeschlossen', eta_min: 0,  eta_konfidenz_pct: 100, entfernung_km: 0,   zahlung: 'karte',  betrag_eur: 18.50, trinkgeld_eur: 2.00, trinkgeld_potential: 'hoch',    ki_reihenfolge: 1, notiz: null,                    bewertung: 5 },
    { id: 's2', nr: 2, adresse: 'Pontstr. 48, 52062 Aachen',     lat: 50.7764, lng: 6.0876, kundename: 'Maria S.',  telefon: null,               status: 'abgeschlossen', eta_min: 0,  eta_konfidenz_pct: 100, entfernung_km: 0,   zahlung: 'online', betrag_eur: 12.90, trinkgeld_eur: 1.50, trinkgeld_potential: 'mittel',  ki_reihenfolge: 2, notiz: '2. Etage, Klingel links', bewertung: 4 },
    { id: 's3', nr: 3, adresse: 'Elisabethstr. 7, 52062 Aachen', lat: 50.7721, lng: 6.0915, kundename: 'Anna B.',   telefon: '+4915234567890', status: 'abgeschlossen', eta_min: 0,  eta_konfidenz_pct: 100, entfernung_km: 0,   zahlung: 'bar',    betrag_eur: 8.70,  trinkgeld_eur: 1.60, trinkgeld_potential: 'mittel',  ki_reihenfolge: 3, notiz: null,                    bewertung: 5 },
    { id: 's4', nr: 4, adresse: 'Boxgraben 5, 52064 Aachen',     lat: 50.7698, lng: 6.0854, kundename: 'Felix M.',  telefon: '+4916789012345', status: 'aktiv',         eta_min: 4,  eta_konfidenz_pct: 87,  entfernung_km: 0.8, zahlung: 'karte',  betrag_eur: 24.20, trinkgeld_eur: 0,    trinkgeld_potential: 'hoch',    ki_reihenfolge: 4, notiz: null,                    bewertung: null },
    { id: 's5', nr: 5, adresse: 'Königstr. 22, 52064 Aachen',    lat: 50.7712, lng: 6.0832, kundename: 'Lena W.',   telefon: null,               status: 'ausstehend',    eta_min: 12, eta_konfidenz_pct: 74,  entfernung_km: 1.4, zahlung: 'online', betrag_eur: 16.80, trinkgeld_eur: 0,    trinkgeld_potential: 'mittel',  ki_reihenfolge: 5, notiz: 'Bitte klingeln',        bewertung: null },
  ],
};

const STATUS_STYLE: Record<StopStatus, string> = {
  abgeschlossen: 'border-emerald-700/30 opacity-60',
  aktiv:         'border-blue-500 border-2',
  ausstehend:    'border-gray-700/50',
};

const TIP_BADGE: Record<TipPotential, string> = {
  hoch:    'bg-orange-500/20 text-orange-300',
  mittel:  'bg-amber-500/20 text-amber-400',
  niedrig: 'bg-gray-700/50 text-gray-500',
};

function buildMapsUrl(lat: number, lng: number, adresse: string) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function buildWazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function FahrerPhase5411TourStopsNavHubV9({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s4']));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!isOnline || !driverId) return;
    try {
      const r = await fetch(`/api/delivery/driver/tour?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`);
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 flex items-center gap-2 text-sm text-gray-500">
        <WifiOff className="h-4 w-4" />
        Offline — Tour-Daten nicht verfügbar
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const kpis = [
    { label: 'Fertig',      value: data.fertig_count, color: 'text-emerald-400' },
    { label: 'Offen',       value: data.offen_count,  color: 'text-blue-400' },
    { label: 'Vollst.',     value: `${data.vollstaendigkeit_pct}%`, color: data.vollstaendigkeit_pct >= 95 ? 'text-emerald-400' : data.vollstaendigkeit_pct >= 88 ? 'text-amber-400' : 'text-red-400' },
    { label: 'Leerfahrt',   value: `${data.leerfahrten_pct}%`, color: data.leerfahrten_pct <= 10 ? 'text-emerald-400' : data.leerfahrten_pct <= 20 ? 'text-amber-400' : 'text-red-400' },
    { label: 'Tip-Score',   value: `${data.trinkgeld_score}`, color: 'text-orange-400' },
    { label: 'Tip-Prognose',value: `€${data.trinkgeld_prognose_eur.toFixed(2)}`, color: 'text-orange-300' },
  ];

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Tour-Hub V9</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-orange-300 bg-orange-950/30 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Coins className="h-3 w-3" />€{data.trinkgeld_prognose_eur.toFixed(2)} Prognose
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-800 rounded-lg p-1.5 text-center">
            <div className={`text-sm font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Leerfahrten-Warnung */}
      {data.leerfahrten_pct > 15 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 rounded-lg px-2 py-1.5">
          <AlertTriangle className="h-3 w-3" />
          Leerfahrten-Quote {data.leerfahrten_pct}% — Optimiere Routenplanung
        </div>
      )}

      {/* Tour-Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-indigo-300 bg-indigo-950/30 rounded px-1.5 py-0.5">KI-Route {data.ki_routen_qualitaet}</span>
        <span className="text-xs text-gray-400">Tour: {data.tour_id}</span>
        <span className="text-xs text-gray-400 ml-auto">Verdienst: €{data.verdienst_gesamt_eur.toFixed(2)}</span>
      </div>

      {/* Stop List */}
      <div className="space-y-2">
        {data.stops.map(stop => {
          const isExpanded = expanded.has(stop.id);
          return (
            <div key={stop.id} className={`rounded-lg bg-gray-800 border ${STATUS_STYLE[stop.status]} p-2`}>
              {/* Stop Header */}
              <button className="w-full flex items-center gap-2 text-left" onClick={() => toggleExpand(stop.id)}>
                <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{stop.nr}</span>
                {stop.status === 'abgeschlossen'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  : stop.status === 'aktiv'
                  ? <Navigation className="h-4 w-4 text-blue-400 shrink-0 animate-pulse" />
                  : <Package className="h-4 w-4 text-gray-500 shrink-0" />
                }
                <span className="text-xs text-gray-200 flex-1 truncate">{stop.kundename}</span>
                {stop.status !== 'abgeschlossen' && (
                  <span className="text-xs text-gray-400 shrink-0">{stop.eta_min}min</span>
                )}
                {stop.bewertung !== null && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: stop.bewertung }).map((_, i) => (
                      <Star key={i} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                )}
                {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
              </button>

              {/* Trinkgeld + ETA bar summary always visible */}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIP_BADGE[stop.trinkgeld_potential]}`}>
                  <Coins className="h-2.5 w-2.5 inline mr-0.5" />
                  {stop.trinkgeld_eur > 0 ? `€${stop.trinkgeld_eur.toFixed(2)}` : stop.trinkgeld_potential}
                </span>
                {stop.status !== 'abgeschlossen' && (
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 bg-gray-700 rounded-full h-1">
                      <div className="h-1 rounded-full bg-blue-400" style={{ width: `${stop.eta_konfidenz_pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{stop.eta_konfidenz_pct}%</span>
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-2 space-y-1.5 border-t border-gray-700/50 pt-2">
                  <div className="text-[10px] text-gray-400">{stop.adresse}</div>
                  {stop.notiz && <div className="text-[10px] text-amber-400">📝 {stop.notiz}</div>}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>€{stop.betrag_eur.toFixed(2)} ({stop.zahlung})</span>
                    <span className="text-gray-600">·</span>
                    <span>{stop.entfernung_km > 0 ? `${stop.entfernung_km.toFixed(1)} km` : 'vor Ort'}</span>
                  </div>
                  {/* Nav Buttons */}
                  {stop.status !== 'abgeschlossen' && (
                    <div className="flex gap-1.5 flex-wrap">
                      <a
                        href={buildMapsUrl(stop.lat, stop.lng, stop.adresse)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-blue-700 text-white rounded px-2 py-1 flex items-center gap-1"
                      >
                        <MapPin className="h-2.5 w-2.5" />Maps
                      </a>
                      <a
                        href={buildWazeUrl(stop.lat, stop.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-indigo-700 text-white rounded px-2 py-1 flex items-center gap-1"
                      >
                        <Navigation className="h-2.5 w-2.5" />Waze
                      </a>
                      {stop.telefon && (
                        <a
                          href={`tel:${stop.telefon}`}
                          className="text-[10px] bg-emerald-800 text-white rounded px-2 py-1 flex items-center gap-1"
                        >
                          <Phone className="h-2.5 w-2.5" />Anrufen
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

      <div className="text-[10px] text-gray-600 text-right">30-Sek-Polling · V9</div>
    </div>
  );
}
