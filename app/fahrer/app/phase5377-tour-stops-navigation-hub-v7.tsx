'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, Zap, Phone, Euro, AlertTriangle, Route, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

// Phase 5377 — Tour-Stops & Navigation Hub V7
// Neu: Smart-Route KI-Optimierungs-Badge (empfohlene Reihenfolge);
// Nächster-Stopp-Live-Countdown; Verdienst-Tracker je Stopp;
// ETA-Präzisions-Anzeige; GPS-Deeplink-Buttons (Maps/Waze/Apple);
// 4-KPI-Grid Fertig/Offen/Eingenommen/KI-Score; Offline-Guard;
// 30-Sek-Polling; Mock-Fallback

type StopStatus = 'abgeschlossen' | 'aktiv' | 'ausstehend';

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
  eta_praezision_pct: number;
  entfernung_km: number;
  zahlung: 'bar' | 'karte' | 'online';
  betrag_eur: number;
  trinkgeld_eur: number;
  ki_reihenfolge: number;
  notiz: string | null;
}

interface TourData {
  tour_id: string;
  fahrer_name: string;
  is_online: boolean;
  ki_score: number;
  ki_optimiert: boolean;
  stops: TourStop[];
  verdienst_gesamt_eur: number;
  trinkgeld_gesamt_eur: number;
  fertig_count: number;
  offen_count: number;
  timestamp: string;
}

const MOCK: TourData = {
  tour_id: 'T2024-081',
  fahrer_name: 'Lukas M.',
  is_online: true,
  ki_score: 94,
  ki_optimiert: true,
  fertig_count: 2,
  offen_count: 3,
  verdienst_gesamt_eur: 18.40,
  trinkgeld_gesamt_eur: 4.20,
  timestamp: new Date().toISOString(),
  stops: [
    { id: 's1', nr: 1, adresse: 'Adalbertsteinweg 12, Aachen', lat: 50.7753, lng: 6.0839, kundename: 'Julia K.', telefon: '+49151XXXX', status: 'abgeschlossen', eta_min: 0,  eta_praezision_pct: 97, entfernung_km: 1.2, zahlung: 'online', betrag_eur: 14.50, trinkgeld_eur: 2.00, ki_reihenfolge: 1, notiz: null },
    { id: 's2', nr: 2, adresse: 'Jülicher Str. 88, Aachen',   lat: 50.7792, lng: 6.0714, kundename: 'Marc B.',   telefon: '+49172XXXX', status: 'abgeschlossen', eta_min: 0,  eta_praezision_pct: 94, entfernung_km: 0.8, zahlung: 'karte',  betrag_eur: 11.90, trinkgeld_eur: 1.50, ki_reihenfolge: 2, notiz: null },
    { id: 's3', nr: 3, adresse: 'Pontstraße 44, Aachen',      lat: 50.7764, lng: 6.0879, kundename: 'Anna S.',   telefon: '+49176XXXX', status: 'aktiv',         eta_min: 4,  eta_praezision_pct: 91, entfernung_km: 1.5, zahlung: 'bar',    betrag_eur: 18.20, trinkgeld_eur: 0,    ki_reihenfolge: 3, notiz: 'Klingel 3. OG' },
    { id: 's4', nr: 4, adresse: 'Lütticher Str. 20, Aachen',  lat: 50.7711, lng: 6.0824, kundename: 'Tom M.',    telefon: null,         status: 'ausstehend',    eta_min: 14, eta_praezision_pct: 85, entfernung_km: 2.1, zahlung: 'online', betrag_eur: 22.60, trinkgeld_eur: 3.00, ki_reihenfolge: 4, notiz: null },
    { id: 's5', nr: 5, adresse: 'Boxgraben 12, Aachen',       lat: 50.7698, lng: 6.0922, kundename: 'Lisa H.',   telefon: '+49151XXXX', status: 'ausstehend',    eta_min: 24, eta_praezision_pct: 78, entfernung_km: 2.8, zahlung: 'karte',  betrag_eur: 9.80,  trinkgeld_eur: 1.20, ki_reihenfolge: 5, notiz: null },
  ],
};

function mapDeeplink(lat: number, lng: number, adresse: string): { google: string; apple: string; waze: string } {
  const q = encodeURIComponent(adresse);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple:  `maps://maps.apple.com/?daddr=${lat},${lng}`,
    waze:   `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

function statusColor(s: StopStatus): string {
  if (s === 'abgeschlossen') return 'bg-emerald-500';
  if (s === 'aktiv')         return 'bg-blue-500 animate-pulse';
  return 'bg-zinc-600';
}

function zahlungIcon(z: TourStop['zahlung']): string {
  if (z === 'bar')    return '💵';
  if (z === 'karte')  return '💳';
  return '📱';
}

export function FahrerPhase5377TourStopsNavigationHubV7({ isOnlineOverride }: { isOnlineOverride?: boolean } = {}) {
  const [data, setData]     = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>('s3');
  const [nowMs, setNowMs]   = useState(Date.now());
  const ivRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1s tick for countdown
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/fahrer/tour-stops', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 30_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const isOnline = isOnlineOverride ?? data.is_online;

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-center">
        <div className="text-zinc-500 text-xs">Tour-Navigation nur bei aktiver Schicht verfügbar</div>
      </div>
    );
  }

  const aktiverStopp = data.stops.find(s => s.status === 'aktiv');
  const pct = data.stops.length > 0 ? Math.round((data.fertig_count / data.stops.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Tour-Nav Hub V7</span>
          {data.ki_optimiert && (
            <span className="text-[9px] bg-violet-800 text-violet-200 px-1.5 py-0.5 rounded font-semibold">KI-optimiert</span>
          )}
        </div>
        <div className="text-[10px] text-zinc-500">{data.tour_id}</div>
      </div>

      {/* Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>{data.fertig_count} von {data.stops.length} Stopps</span>
          <span className="text-blue-400 font-semibold">{pct}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 4-KPI Grid */}
      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'Fertig',  value: data.fertig_count,           color: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
          { label: 'Offen',   value: data.offen_count,            color: 'text-blue-400',    icon: <MapPin className="w-3 h-3" /> },
          { label: 'Verdienst', value: `${data.verdienst_gesamt_eur.toFixed(0)}€`, color: 'text-teal-400', icon: <Euro className="w-3 h-3" /> },
          { label: 'KI-Score', value: data.ki_score,              color: 'text-violet-400',  icon: <Zap className="w-3 h-3" /> },
        ].map(k => (
          <div key={k.label} className="rounded-md bg-zinc-900 p-1.5 text-center">
            <div className={`flex items-center justify-center ${k.color} mb-0.5`}>{k.icon}</div>
            <div className={`text-sm font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Aktiver Stopp — nächster Countdown */}
      {aktiverStopp && (
        <div className="rounded-lg border border-blue-700 bg-blue-950/30 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] font-bold text-blue-200">Nächster Stopp</span>
            </div>
            <span className="text-lg font-bold text-blue-300 tabular-nums">{aktiverStopp.eta_min}min</span>
          </div>
          <div className="text-xs text-zinc-300 mb-1.5 truncate">{aktiverStopp.adresse}</div>
          <div className="text-[10px] text-zinc-500 mb-2">
            {aktiverStopp.kundename}
            {aktiverStopp.notiz && <span className="ml-2 text-amber-400">⚠ {aktiverStopp.notiz}</span>}
          </div>
          {/* GPS Buttons */}
          <div className="flex gap-1">
            {(() => {
              const links = mapDeeplink(aktiverStopp.lat, aktiverStopp.lng, aktiverStopp.adresse);
              return (
                <>
                  <a href={links.google} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-[10px] bg-blue-800 text-blue-100 px-2 py-1 rounded font-semibold">
                    Maps
                  </a>
                  <a href={links.waze} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-[10px] bg-blue-800 text-blue-100 px-2 py-1 rounded font-semibold">
                    Waze
                  </a>
                  <a href={links.apple} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded font-semibold">
                    Apple
                  </a>
                  {aktiverStopp.telefon && (
                    <a href={`tel:${aktiverStopp.telefon}`}
                      className="flex-1 text-center text-[10px] bg-emerald-800 text-emerald-100 px-2 py-1 rounded font-semibold flex items-center justify-center gap-0.5">
                      <Phone className="w-2.5 h-2.5" />
                    </a>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
        {data.stops.map(s => (
          <div key={s.id}>
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className={`w-full rounded-lg border p-2 text-left transition-colors ${
                s.status === 'aktiv'         ? 'border-blue-700 bg-blue-950/20' :
                s.status === 'abgeschlossen' ? 'border-zinc-700 bg-zinc-900/50' :
                'border-zinc-800 bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(s.status)}`} />
                  <span className="text-[10px] text-zinc-500">#{s.ki_reihenfolge}</span>
                  <span className="text-xs text-zinc-200 truncate max-w-[120px]">{s.adresse.split(',')[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.status !== 'abgeschlossen' && (
                    <span className="text-[10px] text-blue-400">{s.eta_min}min</span>
                  )}
                  <span className="text-[10px] text-zinc-500">{zahlungIcon(s.zahlung)}</span>
                  {expanded === s.id
                    ? <ChevronUp className="w-3 h-3 text-zinc-500" />
                    : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                </div>
              </div>
            </button>

            {/* Expanded Details */}
            {expanded === s.id && (
              <div className="ml-3 mt-1 border-l-2 border-zinc-700 pl-3 space-y-1">
                <div className="text-[10px] text-zinc-400">{s.kundename}</div>
                {s.notiz && <div className="text-[10px] text-amber-400">⚠ {s.notiz}</div>}
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <span>{s.entfernung_km} km</span>
                  <span>ETA: {s.eta_min}min</span>
                  <span className={s.eta_praezision_pct >= 90 ? 'text-emerald-400' : 'text-amber-400'}>
                    Präzision: {s.eta_praezision_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-zinc-300">{s.betrag_eur.toFixed(2)} €</span>
                  {s.trinkgeld_eur > 0 && <span className="text-amber-400">TG: {s.trinkgeld_eur.toFixed(2)} €</span>}
                </div>
                {s.status !== 'abgeschlossen' && (
                  <div className="flex gap-1 pt-1">
                    {(() => {
                      const links = mapDeeplink(s.lat, s.lng, s.adresse);
                      return (
                        <>
                          <a href={links.google} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Maps</a>
                          <a href={links.waze} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Waze</a>
                          {s.telefon && (
                            <a href={`tel:${s.telefon}`}
                              className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> Anruf
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verdienst-Summary */}
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px] text-zinc-400">Schicht-Verdienst</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-teal-400">{data.verdienst_gesamt_eur.toFixed(2)} €</span>
          {data.trinkgeld_gesamt_eur > 0 && (
            <span className="text-[10px] text-amber-400 ml-2">+{data.trinkgeld_gesamt_eur.toFixed(2)} € TG</span>
          )}
        </div>
      </div>

      <div className="text-[9px] text-zinc-600 text-right">
        <Navigation className="w-3 h-3 inline mr-1" />
        30s-Poll · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}
