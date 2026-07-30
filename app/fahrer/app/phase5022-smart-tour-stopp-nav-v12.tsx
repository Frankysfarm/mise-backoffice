'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, Phone, CheckCircle2, Clock, Package, Zap, Camera, WifiOff, AlertTriangle, Star } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  ort: string;
  etage: string | null;
  tuercode: string | null;
  notiz: string | null;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  ist_min: number | null;
  betrag: number;
  zahlart: 'bar' | 'karte' | 'online';
  kundenname: string;
  telefon: string | null;
  bestellnummer: string;
  bewertung: number | null;
  google_maps_url: string;
  waze_url: string;
}

interface TourData {
  tour_id: string;
  stopps: TourStop[];
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_fertig: number;
  verdienst: number;
  trinkgeld: number;
  schicht_ziel: number;
  score: number;
  online: boolean;
}

const MOCK: TourData = {
  tour_id: 'T-2024-001',
  stopps_gesamt: 4,
  stopps_fertig: 1,
  km_gesamt: 12.4,
  km_fertig: 3.2,
  verdienst: 24.50,
  trinkgeld: 4.00,
  schicht_ziel: 80,
  score: 87,
  online: true,
  stopps: [
    {
      stopp_nr: 1, adresse: 'Hauptstr. 12', ort: 'Aachen', etage: '2. OG', tuercode: '1234',
      notiz: null, status: 'geliefert', eta_min: 18, ist_min: 17, betrag: 28.50,
      zahlart: 'online', kundenname: 'Max M.', telefon: null,
      bestellnummer: '#1041', bewertung: 5,
      google_maps_url: 'https://maps.google.com/?q=Hauptstr.+12+Aachen',
      waze_url: 'https://waze.com/ul?q=Hauptstr.+12+Aachen',
    },
    {
      stopp_nr: 2, adresse: 'Bahnhofstr. 7', ort: 'Aachen', etage: null, tuercode: null,
      notiz: 'Klingel defekt — bitte anrufen', status: 'aktiv', eta_min: 5, ist_min: null,
      betrag: 34.00, zahlart: 'bar', kundenname: 'Lisa K.', telefon: '+4917612345678',
      bestellnummer: '#1042', bewertung: null,
      google_maps_url: 'https://maps.google.com/?q=Bahnhofstr.+7+Aachen',
      waze_url: 'https://waze.com/ul?q=Bahnhofstr.+7+Aachen',
    },
    {
      stopp_nr: 3, adresse: 'Pontstr. 22', ort: 'Aachen', etage: '1. OG', tuercode: null,
      notiz: null, status: 'ausstehend', eta_min: 18, ist_min: null, betrag: 19.90,
      zahlart: 'karte', kundenname: 'Tom S.', telefon: '+4915123456789',
      bestellnummer: '#1043', bewertung: null,
      google_maps_url: 'https://maps.google.com/?q=Pontstr.+22+Aachen',
      waze_url: 'https://waze.com/ul?q=Pontstr.+22+Aachen',
    },
    {
      stopp_nr: 4, adresse: 'Friedenstr. 5', ort: 'Aachen', etage: null, tuercode: '5678',
      notiz: null, status: 'verspaetet', eta_min: 32, ist_min: null, betrag: 22.70,
      zahlart: 'online', kundenname: 'Anna B.', telefon: null,
      bestellnummer: '#1044', bewertung: null,
      google_maps_url: 'https://maps.google.com/?q=Friedenstr.+5+Aachen',
      waze_url: 'https://waze.com/ul?q=Friedenstr.+5+Aachen',
    },
  ],
};

function statusStyle(s: string) {
  if (s === 'geliefert') return 'border-slate-600/40 bg-slate-800/30 opacity-60';
  if (s === 'aktiv') return 'border-blue-500/60 bg-blue-950/40 ring-1 ring-blue-500/30';
  if (s === 'verspaetet') return 'border-red-500/60 bg-red-950/30 animate-pulse';
  return 'border-slate-700/40 bg-slate-800/20';
}

function statusIcon(s: string) {
  if (s === 'geliefert') return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  if (s === 'aktiv') return <Navigation2 className="w-3.5 h-3.5 text-blue-400" />;
  if (s === 'verspaetet') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  return <Package className="w-3.5 h-3.5 text-slate-500" />;
}

function zahlartBadge(z: string) {
  if (z === 'bar') return 'bg-amber-900/50 text-amber-300 border border-amber-700/40';
  if (z === 'karte') return 'bg-blue-900/50 text-blue-300 border border-blue-700/40';
  return 'bg-green-900/50 text-green-300 border border-green-700/40';
}

function zahlartLabel(z: string) {
  if (z === 'bar') return '💵 Bar';
  if (z === 'karte') return '💳 Karte';
  return '✓ Online';
}

export function FahrerPhase5022SmartTourStoppNavV12() {
  const [data, setData] = useState<TourData>(MOCK);
  const [expandedStops, setExpandedStops] = useState<Record<number, boolean>>({ 2: true });
  const [bewertungMode, setBewertungMode] = useState<number | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/fahrer/aktive-tour', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {
        // Mock bleibt
      }
    };
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  const stoppsPct = (data.stopps_fertig / Math.max(1, data.stopps_gesamt)) * 100;
  const kmPct = (data.km_fertig / Math.max(0.1, data.km_gesamt)) * 100;
  const schichtPct = ((data.verdienst + data.trinkgeld) / data.schicht_ziel) * 100;
  const aktiv = data.stopps.find((s) => s.status === 'aktiv');

  return (
    <div className="rounded-xl border border-blue-700/40 bg-gradient-to-b from-blue-950/50 to-slate-900/80 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300">Tour-Navi V12</span>
          {!data.online && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-bold text-amber-400">{data.verdienst.toFixed(2)}€</div>
            <div className="text-[10px] text-slate-500">+{data.trinkgeld.toFixed(2)}€ Tipp</div>
          </div>
        </div>
      </div>

      {/* Dual Fortschrittsbalken */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
            <span>Stopps</span>
            <span>{data.stopps_fertig}/{data.stopps_gesamt}</span>
          </div>
          <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${stoppsPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
            <span>Kilometer</span>
            <span>{data.km_fertig.toFixed(1)} / {data.km_gesamt.toFixed(1)} km</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${kmPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
            <span>Schicht-Ziel</span>
            <span>{(data.verdienst + data.trinkgeld).toFixed(2)} / {data.schicht_ziel}€</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${schichtPct >= 100 ? 'bg-green-500' : schichtPct >= 70 ? 'bg-yellow-500' : 'bg-slate-500'}`}
              style={{ width: `${Math.min(100, schichtPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Aktiver Stopp Hero */}
      {aktiv && (
        <div className="rounded-xl border border-blue-500/60 bg-blue-950/40 ring-1 ring-blue-500/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Navigation2 className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-xs font-bold text-blue-200">Stopp {aktiv.stopp_nr} — Aktiv</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-bold text-blue-300">{aktiv.eta_min} min</span>
            </div>
          </div>

          <div>
            <div className="text-base font-bold text-slate-100">{aktiv.adresse}</div>
            <div className="text-xs text-slate-400">{aktiv.ort}</div>
          </div>

          {/* Zusatzinfos */}
          <div className="flex flex-wrap gap-1.5">
            {aktiv.etage && (
              <span className="text-[10px] bg-slate-800/60 text-slate-300 border border-slate-600/40 px-1.5 py-0.5 rounded-md">
                🏢 {aktiv.etage}
              </span>
            )}
            {aktiv.tuercode && (
              <span className="text-[10px] bg-slate-800/60 text-slate-300 border border-slate-600/40 px-1.5 py-0.5 rounded-md">
                🔑 {aktiv.tuercode}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${zahlartBadge(aktiv.zahlart)}`}>
              {zahlartLabel(aktiv.zahlart)}
            </span>
            <span className="text-[10px] bg-slate-800/60 text-slate-200 border border-slate-600/40 px-1.5 py-0.5 rounded-md font-semibold">
              {aktiv.betrag.toFixed(2)}€
            </span>
          </div>

          {/* Notiz Alert */}
          {aktiv.notiz && (
            <div className="flex items-start gap-1.5 rounded-lg border border-yellow-600/40 bg-yellow-950/30 px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-yellow-300">{aktiv.notiz}</span>
            </div>
          )}

          {/* Nav Buttons */}
          <div className="flex gap-2">
            <a
              href={aktiv.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 transition-colors"
            >
              <Navigation2 className="w-3.5 h-3.5" /> Google Maps
            </a>
            <a
              href={aktiv.waze_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Waze
            </a>
            {aktiv.telefon && (
              <a
                href={`tel:${aktiv.telefon}`}
                className="flex items-center justify-center gap-1 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Bewertung nach Lieferung (Dummy) */}
          <button
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-green-600/50 bg-green-900/30 text-green-300 text-xs py-1.5 hover:bg-green-900/50 transition-colors"
            onClick={() => setBewertungMode(aktiv.stopp_nr)}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Geliefert — Bestätigen
          </button>
        </div>
      )}

      {/* Ausstehende Stopps */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500">Weitere Stopps</div>
        {data.stopps
          .filter((s) => s.status !== 'aktiv')
          .map((s) => (
            <div
              key={s.stopp_nr}
              className={`rounded-lg border p-2 cursor-pointer ${statusStyle(s.status)}`}
              onClick={() =>
                setExpandedStops((e) => ({ ...e, [s.stopp_nr]: !e[s.stopp_nr] }))
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {statusIcon(s.status)}
                  <span className="text-xs text-slate-200">{s.adresse}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {s.status === 'verspaetet' && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                  {s.eta_min !== null && s.status !== 'geliefert' && (
                    <span className="text-[10px] text-slate-400">{s.eta_min}min</span>
                  )}
                  {s.status === 'geliefert' && s.bewertung !== null && (
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400">{s.bewertung}</span>
                    </div>
                  )}
                </div>
              </div>

              {expandedStops[s.stopp_nr] && s.status !== 'geliefert' && (
                <div className="mt-2 pt-2 border-t border-slate-700/40 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${zahlartBadge(s.zahlart)}`}>
                      {zahlartLabel(s.zahlart)}
                    </span>
                    <span className="text-[10px] bg-slate-800/60 text-slate-200 border border-slate-600/40 px-1.5 py-0.5 rounded-md font-semibold">
                      {s.betrag.toFixed(2)}€
                    </span>
                    {s.etage && (
                      <span className="text-[10px] bg-slate-800/60 text-slate-300 border border-slate-600/40 px-1.5 py-0.5 rounded-md">
                        🏢 {s.etage}
                      </span>
                    )}
                  </div>
                  <a
                    href={s.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 w-full rounded-md bg-slate-700/60 text-slate-300 text-[10px] py-1 hover:bg-slate-700 transition-colors"
                  >
                    <Navigation2 className="w-3 h-3" /> Vorschau Navi
                  </a>
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="text-[9px] text-slate-600 text-right">20s-Polling · Offline-Safe · Mock-Fallback</div>
    </div>
  );
}
