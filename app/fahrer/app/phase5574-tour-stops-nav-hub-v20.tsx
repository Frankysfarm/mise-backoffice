'use client';

// Phase 5574 — Tour-Stops & Navigation Hub V20
// V19+: Echtzeit-Routenoptimierung mit KI-Δmin-Anzeige;
// Kunden-Vor-Ort-Signal Türklingel/Klopfen-Countdown;
// Fahrzeug-Telemetrie Batterie+Tankstand-Warnung;
// Schicht-Performance-Live-Miniatur Score+Rank+Delta;
// 11-KPI-Grid Stops/Fertig/Offen/km/ETA-Score/Einnahmen/Bewertung/Pause/Eco/Batterie/Rank;
// 6-Tab Stopps/Navi/Kunden/Score/Übersicht/Telemetrie;
// 15s-Polling; Mock-Fallback

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Battery, CheckCircle2, Clock, MapPin, Navigation2, Phone, RefreshCw, Star, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'stopps' | 'navi' | 'kunden' | 'score' | 'uebersicht' | 'telemetrie';

interface Stop {
  id: string;
  adresse: string;
  kunde: string;
  telefon: string;
  eta_min: number;
  status: 'pending' | 'current' | 'done';
  distanz_km: number;
  ki_optimiert: boolean;
  ki_delta_min: number;
  zahlung: 'bar' | 'karte' | 'digital';
  bewertungs_prompt: boolean;
  kundennotiz?: string;
  trinkgeld_prognose: number;
}

interface TelemetrieData {
  batterie_pct: number;
  tank_pct: number;
  geschwindigkeit_kmh: number;
  eco_score: number;
}

interface ApiResponse {
  stops: Stop[];
  kpi: {
    stops_gesamt: number; fertig: number; offen: number; km_verbleibend: number;
    eta_score: number; einnahmen: number; bewertung_avg: number; pause_faellig: boolean;
    eco_score: number; batterie_pct: number; rank: number;
  };
  telemetrie: TelemetrieData;
  schicht_score: number;
  schicht_delta: number;
}

const MOCK: ApiResponse = {
  stops: [
    { id: 's1', adresse: 'Hauptstr. 12, 52062 Aachen', kunde: 'Anna M.', telefon: '+49 241 111222', eta_min: 4, status: 'current', distanz_km: 1.2, ki_optimiert: true, ki_delta_min: -2, zahlung: 'digital', bewertungs_prompt: false, kundennotiz: 'Klingel 2. OG links', trinkgeld_prognose: 1.80 },
    { id: 's2', adresse: 'Pontstr. 45, 52062 Aachen', kunde: 'Bernd K.', telefon: '+49 241 333444', eta_min: 12, status: 'pending', distanz_km: 2.8, ki_optimiert: true, ki_delta_min: -1, zahlung: 'karte', bewertungs_prompt: true, trinkgeld_prognose: 2.20 },
    { id: 's3', adresse: 'Kölnstr. 8, 52070 Aachen', kunde: 'Claudia R.', telefon: '+49 241 555666', eta_min: 22, status: 'pending', distanz_km: 4.1, ki_optimiert: false, ki_delta_min: 0, zahlung: 'bar', bewertungs_prompt: false, trinkgeld_prognose: 1.20 },
    { id: 's4', adresse: 'Elisenbrunnen 3', kunde: 'David S.', telefon: '+49 241 777888', eta_min: 0, status: 'done', distanz_km: 0, ki_optimiert: false, ki_delta_min: 0, zahlung: 'digital', bewertungs_prompt: true, trinkgeld_prognose: 0 },
  ],
  kpi: { stops_gesamt: 4, fertig: 1, offen: 3, km_verbleibend: 8.1, eta_score: 88, einnahmen: 42.50, bewertung_avg: 4.7, pause_faellig: false, eco_score: 82, batterie_pct: 67, rank: 2 },
  telemetrie: { batterie_pct: 67, tank_pct: 55, geschwindigkeit_kmh: 34, eco_score: 82 },
  schicht_score: 91,
  schicht_delta: +3,
};

function zahlungBadge(z: Stop['zahlung']) {
  if (z === 'digital') return <span className="text-[9px] bg-violet-800/60 text-violet-300 px-1 rounded">Digital</span>;
  if (z === 'karte') return <span className="text-[9px] bg-blue-800/60 text-blue-300 px-1 rounded">Karte</span>;
  return <span className="text-[9px] bg-amber-800/60 text-amber-300 px-1 rounded">Bar</span>;
}

export function FahrerPhase5574TourStopsNavHubV20({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [tab, setTab] = useState<Tab>('stopps');
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [doorbell, setDoorbell] = useState<string | null>(null);
  const [doorbellSec, setDoorbellSec] = useState(30);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doorbellRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour?driver_id=${driverId}&location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.stops) setData(json);
      }
    } catch { /* mock fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [driverId, locationId, isOnline]);

  const startDoorbell = (stopId: string) => {
    setDoorbell(stopId);
    setDoorbellSec(30);
    doorbellRef.current = setInterval(() => {
      setDoorbellSec(prev => {
        if (prev <= 1) { setDoorbell(null); if (doorbellRef.current) clearInterval(doorbellRef.current); return 30; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => { return () => { if (doorbellRef.current) clearInterval(doorbellRef.current); }; }, []);

  const openNavigation = (adresse: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`, '_blank');
  };

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-slate-600/30 bg-[#0f0f1a] p-3 flex items-center gap-2 text-xs text-slate-400">
        <WifiOff className="w-4 h-4" />
        <span>Tour-Stops Nav Hub V20 — Offline (kein GPS)</span>
      </div>
    );
  }

  const { kpi, telemetrie } = data;
  const currentStop = data.stops.find(s => s.status === 'current');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stopps', label: 'Stopps' },
    { key: 'navi', label: 'Navi' },
    { key: 'kunden', label: 'Kunden' },
    { key: 'score', label: 'Score' },
    { key: 'uebersicht', label: 'Übersicht' },
    { key: 'telemetrie', label: 'Telemetrie' },
  ];

  return (
    <div className="rounded-xl border border-blue-500/30 bg-[#0f0f1a] p-3 space-y-3 text-xs text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-blue-300">Tour-Stops Nav Hub V20</span>
          {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
          <Wifi className="w-3 h-3 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Rang</span>
          <span className="font-bold text-blue-300">#{kpi.rank}</span>
        </div>
      </div>

      {kpi.pause_faellig && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-900/30 border border-amber-500/40 px-2 py-1 text-amber-300">
          <AlertTriangle className="w-3 h-3" />
          <span>Pause empfohlen — Schichtdauer erreicht Grenzwert</span>
        </div>
      )}

      {telemetrie.batterie_pct < 25 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-500/40 px-2 py-1 text-red-300">
          <Battery className="w-3 h-3" />
          <span>Akku niedrig: {telemetrie.batterie_pct}% — Laden einplanen!</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1">
        {[
          ['Stopps', kpi.stops_gesamt, '#60a5fa'],
          ['Fertig', kpi.fertig, '#34d399'],
          ['Offen', kpi.offen, '#fbbf24'],
          ['km', kpi.km_verbleibend.toFixed(1), '#38bdf8'],
          ['ETA', `${kpi.eta_score}%`, '#a78bfa'],
          ['€', `${kpi.einnahmen.toFixed(0)}`, '#4ade80'],
          ['★', kpi.bewertung_avg.toFixed(1), '#fbbf24'],
          ['Eco', `${kpi.eco_score}%`, '#86efac'],
          ['Batt', `${kpi.batterie_pct}%`, kpi.batterie_pct < 25 ? '#f87171' : '#60a5fa'],
          ['Rank', `#${kpi.rank}`, '#e879f9'],
          ['Score', data.schicht_score, '#c4b5fd'],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="flex flex-col items-center bg-white/5 rounded px-1 py-1">
            <span className="font-bold text-[11px]" style={{ color: String(color) }}>{String(val)}</span>
            <span className="text-slate-500 text-[8px]">{String(label)}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Stopps Tab */}
      {tab === 'stopps' && (
        <div className="space-y-1.5">
          {data.stops.map((stop, i) => (
            <div key={stop.id} className={cn('rounded-lg border px-2 py-2 space-y-1.5',
              stop.status === 'done' ? 'border-slate-600/30 opacity-50'
              : stop.status === 'current' ? 'border-blue-500/40 bg-blue-900/20'
              : 'border-slate-600/30 bg-white/5')}>
              <div className="flex items-start gap-2">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                  stop.status === 'done' ? 'bg-emerald-600' : stop.status === 'current' ? 'bg-blue-600' : 'bg-slate-600')}>
                  {stop.status === 'done' ? '✓' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium truncate">{stop.adresse}</span>
                    {zahlungBadge(stop.zahlung)}
                    {stop.ki_optimiert && (
                      <span className={cn('text-[9px] px-1 rounded', stop.ki_delta_min < 0 ? 'bg-emerald-800/60 text-emerald-300' : 'bg-slate-700 text-slate-300')}>
                        KI {stop.ki_delta_min < 0 ? stop.ki_delta_min : `+${stop.ki_delta_min}`}min
                      </span>
                    )}
                  </div>
                  {stop.kundennotiz && <div className="text-[9px] text-amber-300">{stop.kundennotiz}</div>}
                  <div className="flex items-center gap-2 text-[9px] text-slate-400">
                    <span>ETA: {stop.eta_min} min</span>
                    <span>{stop.distanz_km} km</span>
                    {stop.trinkgeld_prognose > 0 && <span className="text-emerald-400">TG: ~€{stop.trinkgeld_prognose.toFixed(2)}</span>}
                  </div>
                </div>
              </div>
              {stop.status === 'current' && (
                <div className="flex gap-1.5">
                  <button onClick={() => openNavigation(stop.adresse)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-blue-600/80 text-white text-[10px] hover:bg-blue-600">
                    <Navigation2 className="w-3 h-3" />Maps
                  </button>
                  <button onClick={() => window.open(`tel:${stop.telefon}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-700/80 text-white text-[10px]">
                    <Phone className="w-3 h-3" />
                  </button>
                  <button onClick={() => startDoorbell(stop.id)}
                    className={cn('flex items-center gap-1 px-2 py-1 rounded text-[10px]',
                      doorbell === stop.id ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300')}>
                    {doorbell === stop.id ? `${doorbellSec}s` : '🔔'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navi Tab */}
      {tab === 'navi' && currentStop && (
        <div className="space-y-2">
          <div className="rounded-lg bg-blue-900/20 border border-blue-500/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Navigation2 className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-blue-300">Aktuelles Ziel</span>
            </div>
            <div className="text-sm font-medium">{currentStop.adresse}</div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3 h-3" />
              <span>ETA: {currentStop.eta_min} min</span>
              <MapPin className="w-3 h-3 ml-2" />
              <span>{currentStop.distanz_km} km</span>
            </div>
            {currentStop.ki_optimiert && (
              <div className="text-[9px] text-emerald-400">
                KI-Route optimiert: {currentStop.ki_delta_min}min gespart
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openNavigation(currentStop.adresse)}
                className="flex items-center justify-center gap-1 py-2 rounded bg-blue-600 text-white text-xs">
                <Navigation2 className="w-3 h-3" />Google Maps
              </button>
              <button onClick={() => window.open(`waze://?q=${encodeURIComponent(currentStop.adresse)}`, '_blank')}
                className="flex items-center justify-center gap-1 py-2 rounded bg-sky-600 text-white text-xs">
                <Zap className="w-3 h-3" />Waze
              </button>
            </div>
          </div>
          <div className="text-[10px] text-slate-400">Verkehrsampel: <span className="text-emerald-400">Leicht</span> · Eco-Tipp: gleichmäßige Beschleunigung</div>
        </div>
      )}

      {/* Kunden Tab */}
      {tab === 'kunden' && (
        <div className="space-y-1.5">
          {data.stops.filter(s => s.status !== 'done').map(stop => (
            <div key={stop.id} className="rounded-lg bg-white/5 border border-slate-600/30 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{stop.kunde}</span>
                <div className="flex gap-1">
                  <button onClick={() => window.open(`tel:${stop.telefon}`)}
                    className="p-1 rounded bg-emerald-700/60 text-emerald-300">
                    <Phone className="w-3 h-3" />
                  </button>
                  <button onClick={() => window.open(`sms:${stop.telefon}`)}
                    className="p-1 rounded bg-blue-700/60 text-blue-300">
                    <span className="text-[9px]">SMS</span>
                  </button>
                </div>
              </div>
              {stop.kundennotiz && <div className="text-[9px] text-amber-300">{stop.kundennotiz}</div>}
              {stop.bewertungs_prompt && <div className="text-[9px] text-violet-400">💬 Bewertungs-Erinnerung aktiv</div>}
              <div className="text-[9px] text-slate-400">Trinkgeld-Prognose: ~€{stop.trinkgeld_prognose.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Score Tab */}
      {tab === 'score' && (
        <div className="space-y-2">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-3xl font-bold" style={{ color: data.schicht_score > 85 ? '#34d399' : data.schicht_score > 70 ? '#fbbf24' : '#f87171' }}>
              {data.schicht_score}
            </div>
            <div className="text-[9px] text-slate-400">Schicht-Score</div>
            <div className={cn('text-sm font-bold mt-1', data.schicht_delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {data.schicht_delta > 0 ? '+' : ''}{data.schicht_delta} vs. letzte Schicht
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-400">{kpi.bewertung_avg.toFixed(1)} ★</div>
              <div className="text-[9px] text-slate-400">Kundenbewertung</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-400">{kpi.eta_score}%</div>
              <div className="text-[9px] text-slate-400">ETA-Genauigkeit</div>
            </div>
          </div>
        </div>
      )}

      {/* Übersicht Tab */}
      {tab === 'uebersicht' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {data.stops.map((stop, i) => (
              <div key={stop.id} className={cn('rounded-lg border p-2 text-center',
                stop.status === 'done' ? 'border-emerald-500/30 bg-emerald-900/10'
                : stop.status === 'current' ? 'border-blue-500/30 bg-blue-900/20'
                : 'border-slate-600/30 bg-white/5')}>
                <div className={cn('text-lg font-bold',
                  stop.status === 'done' ? 'text-emerald-400' : stop.status === 'current' ? 'text-blue-400' : 'text-slate-400')}>
                  {stop.status === 'done' ? '✓' : stop.eta_min + 'min'}
                </div>
                <div className="text-[9px] text-slate-400 truncate">{stop.adresse.split(',')[0]}</div>
              </div>
            ))}
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="flex justify-between text-[9px]">
              <span className="text-slate-400">Verbleibend</span>
              <span className="text-blue-300">{kpi.km_verbleibend.toFixed(1)} km · ~{data.stops.filter(s => s.status !== 'done').reduce((sum, s) => sum + s.eta_min, 0)} min</span>
            </div>
          </div>
        </div>
      )}

      {/* Telemetrie Tab */}
      {tab === 'telemetrie' && (
        <div className="space-y-2">
          {[
            { label: 'Batterie', val: telemetrie.batterie_pct, unit: '%', icon: <Battery className="w-3 h-3" />, warn: 25 },
            { label: 'Tank', val: telemetrie.tank_pct, unit: '%', icon: <Zap className="w-3 h-3" />, warn: 20 },
            { label: 'Eco-Score', val: telemetrie.eco_score, unit: '%', icon: <TrendingUp className="w-3 h-3" />, warn: 60 },
          ].map(({ label, val, unit, icon, warn }) => (
            <div key={label} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-slate-300">
                  {icon}<span>{label}</span>
                </div>
                <span className={cn('font-bold', val < warn ? 'text-red-400' : 'text-emerald-400')}>{val}{unit}</span>
              </div>
              <div className="h-1.5 rounded bg-white/10">
                <div className="h-full rounded transition-all" style={{ width: `${val}%`, background: val < warn ? '#f87171' : '#34d399' }} />
              </div>
            </div>
          ))}
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Geschwindigkeit</span>
            <span className="text-white">{telemetrie.geschwindigkeit_kmh} km/h</span>
          </div>
        </div>
      )}
    </div>
  );
}
