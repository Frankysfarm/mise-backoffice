'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation2, Phone, MessageCircle, CheckCircle2, Clock, AlertTriangle, MapPin, Zap, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5557 — Tour-Stops Nav Hub V18
// Navigation2 blue; V17+: Proaktiver Kunden-ETA-Push Anruf/SMS 5-Min-Vorab;
// Eco-Fahrhinweis (Geschwindigkeit+Strecke optimiert); Batteriestand-Warnung <20%;
// Echtzeit-Ampel-Indikator Rot/Gelb/Grün je Stopp; Schicht-Ende-Prognose;
// 10-KPI-Grid Stops/Fertig/Offen/km/ETA-Score/Einnahmen/Bewertung/Pause/Eco/Batterie;
// Offline-Guard; 30s-Poll; Mock-Fallback

type StoppStatus = 'aktiv' | 'naechster' | 'offen' | 'fertig';

interface Stopp {
  id: string;
  adresse: string;
  kunde: string;
  telefon: string;
  eta_min: number;
  distanz_km: number;
  betrag: number;
  zahlung: 'bar' | 'karte' | 'digital';
  status: StoppStatus;
  eta_score: number;
  notiz?: string;
  stammkunde: boolean;
  eco_hinweis?: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  stopps: Stopp[];
  kpi: {
    gesamt: number;
    fertig: number;
    offen: number;
    km_rest: number;
    eta_score: number;
    einnahmen: number;
    bewertung: number;
    pause_empfohlen: boolean;
    eco_score: number;
    batterie_pct: number;
  };
  schicht_ende_min: number;
  is_online: boolean;
}

const MOCK: ApiResponse = {
  stopps: [
    { id: 's1', adresse: 'Musterstr. 12, Aachen', kunde: 'Thomas R.', telefon: '+49 151 1234567', eta_min: 4, distanz_km: 1.2, betrag: 28.50, zahlung: 'karte', status: 'aktiv', eta_score: 92, stammkunde: true, eco_hinweis: 'Route energieoptimiert ✓', ampel: 'gruen' },
    { id: 's2', adresse: 'Bachgasse 5, Aachen', kunde: 'Lena M.', telefon: '+49 160 9876543', eta_min: 18, distanz_km: 3.4, betrag: 45.00, zahlung: 'bar', status: 'naechster', eta_score: 81, stammkunde: false, ampel: 'gelb' },
    { id: 's3', adresse: 'Ringstr. 88, Aachen', kunde: 'Klaus B.', telefon: '+49 176 5554433', eta_min: 31, distanz_km: 5.1, betrag: 19.90, zahlung: 'digital', status: 'offen', eta_score: 74, stammkunde: true, ampel: 'gruen' },
  ],
  kpi: { gesamt: 5, fertig: 2, offen: 3, km_rest: 9.7, eta_score: 82, einnahmen: 93.40, bewertung: 4.8, pause_empfohlen: false, eco_score: 87, batterie_pct: 64 },
  schicht_ende_min: 95,
  is_online: true,
};

function zahlungBadge(z: Stopp['zahlung']): string {
  if (z === 'karte') return 'bg-sky-900/50 text-sky-300';
  if (z === 'bar') return 'bg-emerald-900/50 text-emerald-300';
  return 'bg-violet-900/50 text-violet-300';
}

function zahlungLabel(z: Stopp['zahlung']): string {
  if (z === 'karte') return '💳 Karte';
  if (z === 'bar') return '💵 Bar';
  return '📱 Digital';
}

function ampelDot(a: Stopp['ampel']): string {
  if (a === 'gruen') return 'bg-emerald-400';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-400';
}

export function FahrerPhase5557TourStopsNavHubV18({ isOnline }: { isOnline?: boolean }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expandedId, setExpandedId] = useState<string | null>('s1');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/delivery/fahrer/tour-stops?v=18');
      if (r.ok) setData(await r.json());
    } catch { /* mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const online = isOnline !== undefined ? isOnline : data.is_online;

  if (!online) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-700/50 px-4 py-3">
        <WifiOff className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500">Navigation offline nicht verfügbar</span>
      </div>
    );
  }

  const kpi = data.kpi;
  const fortschritt = kpi.gesamt > 0 ? (kpi.fertig / kpi.gesamt) * 100 : 0;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Navigation2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Tour-Navigation V18</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>Schicht-Ende: {kpi.pause_empfohlen ? '⚠️ ' : ''}{data.schicht_ende_min}min</span>
        </div>
      </div>

      {/* 10-KPI-Grid */}
      <div className="grid grid-cols-5 gap-px bg-gray-700/30 border-b border-gray-700/40">
        {[
          ['Stops', `${kpi.fertig}/${kpi.gesamt}`, 'text-white'],
          ['Offen', kpi.offen, 'text-sky-400'],
          ['km Rest', `${kpi.km_rest.toFixed(1)}`, 'text-teal-400'],
          ['ETA ✓', kpi.eta_score, kpi.eta_score >= 80 ? 'text-emerald-400' : 'text-amber-400'],
          ['€ Ertrag', `${kpi.einnahmen.toFixed(0)}`, 'text-yellow-300'],
          ['Bewert.', `${kpi.bewertung}★`, 'text-orange-400'],
          ['Eco', `${kpi.eco_score}%`, 'text-teal-400'],
          ['Batt.', `${kpi.batterie_pct}%`, kpi.batterie_pct >= 20 ? 'text-green-400' : 'text-red-400'],
          ['Pause', kpi.pause_empfohlen ? 'Jetzt' : 'Nein', kpi.pause_empfohlen ? 'text-amber-400' : 'text-gray-500'],
          ['Fortschr.', `${Math.round(fortschritt)}%`, 'text-violet-400'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className="bg-gray-900 px-2 py-1.5 text-center">
            <div className={cn('text-xs font-semibold tabular-nums', cls as string)}>{val}</div>
            <div className="text-[9px] text-gray-500 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* Fortschritts-Ring */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#818cf8" strokeWidth="3"
                strokeDasharray={`${fortschritt} ${100 - fortschritt}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{Math.round(fortschritt)}%</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-white">{kpi.fertig} von {kpi.gesamt} Stopps</div>
            <div className="text-[10px] text-gray-500">{kpi.offen} offen · {kpi.km_rest.toFixed(1)} km verbleibend</div>
          </div>
        </div>
      </div>

      {/* Batterie-Warnung */}
      {kpi.batterie_pct < 20 && (
        <div className="flex items-center gap-2 mx-3 mb-2 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-700/30">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-300">Batterie niedrig ({kpi.batterie_pct}%) — bitte aufladen</span>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="px-3 pb-3 space-y-2 mt-1">
        {data.stopps.filter(s => s.status !== 'fertig').map(s => (
          <div key={s.id} className="rounded-lg bg-gray-800/60 border border-gray-700/40 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', ampelDot(s.ampel))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white truncate">{s.kunde}</span>
                  {s.stammkunde && <span className="text-[9px] text-rose-400">Stamm</span>}
                  <span className={cn('text-[9px] px-1 rounded', zahlungBadge(s.zahlung))}>{zahlungLabel(s.zahlung)}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">{s.adresse}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-sky-400 font-mono">{s.eta_min} min</div>
                <div className="text-[10px] text-gray-500">{s.distanz_km.toFixed(1)} km</div>
              </div>
            </button>

            {expandedId === s.id && (
              <div className="border-t border-gray-700/40 px-3 py-2 space-y-2">
                {s.eco_hinweis && (
                  <div className="text-[10px] text-teal-400">{s.eco_hinweis}</div>
                )}
                {s.notiz && (
                  <div className="text-[10px] text-amber-300 bg-amber-950/30 px-2 py-1 rounded">{s.notiz}</div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-yellow-300">{s.betrag.toFixed(2)} €</span>
                  <span className="text-[10px] text-gray-500">ETA-Score {s.eta_score}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.adresse)}&travelmode=bicycling`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 rounded-lg text-xs text-white font-medium"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Navigation
                  </a>
                  <a
                    href={`tel:${s.telefon}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700/60 rounded-lg text-xs text-white"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${s.telefon.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-700/60 rounded-lg text-xs text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                </div>
                {s.eta_min <= 5 && s.status === 'naechster' && (
                  <div className="flex items-center gap-1.5 bg-blue-900/40 rounded-lg px-2 py-1.5">
                    <Zap className="h-3 w-3 text-blue-400 shrink-0" />
                    <span className="text-[10px] text-blue-300">Kunden-ETA-Push senden ({s.eta_min} min voraus)</span>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 rounded-lg text-xs text-white font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Zugestellt — Bestätigen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
