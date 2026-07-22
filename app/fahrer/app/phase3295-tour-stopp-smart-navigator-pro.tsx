'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Map, MessageSquare, Phone, Package, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  kunde: string;
  telefon: string | null;
  kommentar: string | null;
  pakete: number;
  eta_sek: number;
  distanz_km: number;
  status: 'ausstehend' | 'unterwegs' | 'abgeschlossen';
}

interface ApiData {
  tour_id: string;
  aktiver_stopp: Stopp | null;
  naechste_stopps: Stopp[];
  abgeschlossen: number;
  gesamt: number;
  rueckkehr_eta_min: number;
  schicht_score: number;
}

const MOCK: ApiData = {
  tour_id: 't42',
  abgeschlossen: 2,
  gesamt: 5,
  rueckkehr_eta_min: 42,
  schicht_score: 84,
  aktiver_stopp: {
    id: 's3', nr: 3,
    adresse: 'Gartenweg 7, 52072 Aachen',
    kunde: 'Ben Schulz',
    telefon: '+4915123456789',
    kommentar: 'Bitte klingeln, 2. OG',
    pakete: 2,
    eta_sek: 380,
    distanz_km: 1.8,
    status: 'unterwegs',
  },
  naechste_stopps: [
    { id: 's4', nr: 4, adresse: 'Ringstr. 22, 52078', kunde: 'Mia Fischer', telefon: null, kommentar: null, pakete: 1, eta_sek: 1140, distanz_km: 2.9, status: 'ausstehend' },
    { id: 's5', nr: 5, adresse: 'Parkweg 9, 52074', kunde: 'Jan Peters', telefon: null, kommentar: 'Hinterhof', pakete: 3, eta_sek: 1980, distanz_km: 4.1, status: 'ausstehend' },
  ],
};

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ampelFor(sek: number): string {
  if (sek > 600) return 'text-green-400';
  if (sek > 180) return 'text-amber-400';
  if (sek > 0) return 'text-orange-400';
  return 'text-red-400 animate-pulse';
}

export function FahrerPhase3295TourStoppSmartNavigatorPro({ fahrerId }: { fahrerId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [naechsteOpen, setNaechsteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/aktive-tour?fahrer_id=${fahrerId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (fahrerId) load(); else setData(MOCK);
    const p = setInterval(load, 15_000);
    return () => clearInterval(p);
  }, [fahrerId]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const s = d.aktiver_stopp;
  const pct = Math.round((d.abgeschlossen / d.gesamt) * 100);
  const liveEta = s ? Math.max(0, s.eta_sek - tick) : 0;

  if (!s) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 mb-4 text-center text-gray-500 text-sm">
        Keine aktive Tour
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.adresse)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(s.adresse)}&navigate=yes`;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      {/* Fortschritts-Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
        <Zap className="h-4 w-4 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white">Tour #{d.tour_id}</span>
            <span className="text-[10px] text-gray-400">{d.abgeschlossen}/{d.gesamt} Stopps</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[10px] font-bold ${d.schicht_score >= 80 ? 'text-green-400' : d.schicht_score >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
            Score {d.schicht_score}
          </div>
          <div className="text-[9px] text-gray-500 tabular-nums">ETA Depot {d.rueckkehr_eta_min}m</div>
        </div>
      </div>

      {/* Aktiver Stopp — Hero */}
      <div className="p-4 space-y-3">
        <div className="rounded-xl border-2 border-blue-500/50 bg-blue-950/20 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] font-bold rounded px-2 py-0.5">#{s.nr}</span>
              <span className="text-xs font-bold text-white truncate">{s.kunde}</span>
            </div>
            <div className={`font-mono text-xl font-black tabular-nums ${ampelFor(liveEta)}`}>
              {fmtSek(liveEta)}
            </div>
          </div>

          <div className="flex items-start gap-1.5 mb-3">
            <Map className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
            <span className="text-sm font-semibold text-blue-200">{s.adresse}</span>
          </div>

          {s.kommentar && (
            <div className="flex items-start gap-1.5 bg-amber-950/30 border border-amber-700/40 rounded-lg px-2.5 py-1.5 mb-3">
              <MessageSquare className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-amber-300">{s.kommentar}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Package className="h-3 w-3" />{s.pakete} Paket{s.pakete !== 1 ? 'e' : ''}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="h-3 w-3" />{s.distanz_km} km
            </div>
          </div>

          {/* Aktions-Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2.5 text-sm font-bold text-white transition-colors">
              <Map className="h-4 w-4" />Google Maps
            </a>
            <a href={wazeUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2.5 text-sm font-bold text-white transition-colors">
              <Map className="h-4 w-4" />Waze
            </a>
          </div>

          {s.telefon && (
            <a href={`tel:${s.telefon}`}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-sm font-semibold text-white transition-colors mb-2">
              <Phone className="h-4 w-4 text-green-400" />Anrufen
            </a>
          )}

          <button
            onClick={() => setConfirming(true)}
            className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-green-600 hover:bg-green-500 active:scale-95 px-3 py-3 text-sm font-black text-white transition-all"
          >
            <Check className="h-4 w-4" />
            {confirming ? 'Bestätigt!' : 'Zugestellt — Weiter'}
          </button>
        </div>

        {/* Nächste Stopps */}
        {d.naechste_stopps.length > 0 && (
          <div>
            <button
              onClick={() => setNaechsteOpen(o => !o)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors mb-2"
            >
              {naechsteOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {d.naechste_stopps.length} weitere Stopps
            </button>
            {naechsteOpen && (
              <div className="space-y-1.5">
                {d.naechste_stopps.map(ns => (
                  <div key={ns.id} className="rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-gray-700 rounded px-1.5 py-0.5 text-gray-300 font-bold">#{ns.nr}</span>
                      <span className="text-xs text-gray-300 flex-1 truncate">{ns.adresse}</span>
                      <span className="text-[9px] text-gray-500 shrink-0 tabular-nums">{Math.round(ns.eta_sek / 60)}m</span>
                    </div>
                    {ns.kommentar && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                        <span className="text-[9px] text-amber-400">{ns.kommentar}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
