'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, AlertTriangle, Navigation, Route, Target, Activity, Star, Zap, CheckCircle2, Package } from 'lucide-react';

interface TourStop {
  nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  kundenwertung: number | null;
  betrag: number;
}

interface DriverCard {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  eta_naechster_min: number | null;
  puenktlichkeit_pct: number;
  eta_accuracy_pct: number;
  avg_lieferzeit_min: number;
  verdienst_shift: number;
  touren_heute: number;
  stopps: TourStop[];
}

interface ApiResponse {
  team_score: number;
  team_score_ziel: number;
  alert: string | null;
  aktive_touren: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  eta_accuracy_pct: number;
  drivers: DriverCard[];
}

const TIER_STYLE: Record<string, string> = {
  platin: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300',
  gold:   'border-yellow-500/50 bg-yellow-950/20 text-yellow-300',
  gut:    'border-green-600/40 bg-green-950/20 text-green-400',
  schwach:'border-slate-600/40 bg-slate-800/30 text-slate-400',
};

const STOP_DOT: Record<string, string> = {
  geliefert:  'bg-green-500',
  aktiv:      'bg-blue-500 animate-pulse',
  ausstehend: 'bg-slate-500',
  verspaetet: 'bg-red-500',
};

const MOCK: ApiResponse = {
  team_score: 91,
  team_score_ziel: 90,
  alert: null,
  aktive_touren: 4,
  avg_lieferzeit_min: 25,
  puenktlichkeit_pct: 87,
  eta_accuracy_pct: 88,
  drivers: [
    {
      id: 'd1', name: 'Jonas M.', score: 97, score_delta: 4, tier: 'platin',
      stopps_gesamt: 5, stopps_fertig: 4, km_gesamt: 22, km_gefahren: 19,
      eta_naechster_min: 3, puenktlichkeit_pct: 96, eta_accuracy_pct: 94,
      avg_lieferzeit_min: 21, verdienst_shift: 68.40, touren_heute: 4,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 18.90 },
        { nr: 2, adresse: 'Kirchweg 5', status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 22.50 },
        { nr: 3, adresse: 'Marktplatz 8', status: 'geliefert', eta_min: null, kundenwertung: 4, betrag: 16.80 },
        { nr: 4, adresse: 'Gartenstr. 21', status: 'aktiv', eta_min: 3, kundenwertung: null, betrag: 31.20 },
        { nr: 5, adresse: 'Bergweg 3', status: 'ausstehend', eta_min: 10, kundenwertung: null, betrag: 24.00 },
      ],
    },
    {
      id: 'd2', name: 'Sara K.', score: 83, score_delta: -2, tier: 'gut',
      stopps_gesamt: 4, stopps_fertig: 2, km_gesamt: 16, km_gefahren: 8,
      eta_naechster_min: 7, puenktlichkeit_pct: 80, eta_accuracy_pct: 82,
      avg_lieferzeit_min: 28, verdienst_shift: 44.20, touren_heute: 3,
      stopps: [
        { nr: 1, adresse: 'Schlossallee 4', status: 'geliefert', eta_min: null, kundenwertung: 4, betrag: 27.60 },
        { nr: 2, adresse: 'Ringstr. 17', status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 19.80 },
        { nr: 3, adresse: 'Feldweg 9', status: 'verspaetet', eta_min: 5, kundenwertung: null, betrag: 33.40 },
        { nr: 4, adresse: 'Parkstr. 33', status: 'ausstehend', eta_min: 14, kundenwertung: null, betrag: 21.00 },
      ],
    },
    {
      id: 'd3', name: 'Max L.', score: 78, score_delta: 1, tier: 'gut',
      stopps_gesamt: 3, stopps_fertig: 0, km_gesamt: 12, km_gefahren: 0,
      eta_naechster_min: 18, puenktlichkeit_pct: 74, eta_accuracy_pct: 78,
      avg_lieferzeit_min: 32, verdienst_shift: 28.90, touren_heute: 2,
      stopps: [
        { nr: 1, adresse: 'Aachener Str. 45', status: 'ausstehend', eta_min: 18, kundenwertung: null, betrag: 14.20 },
        { nr: 2, adresse: 'Domplatz 1', status: 'ausstehend', eta_min: 25, kundenwertung: null, betrag: 38.50 },
        { nr: 3, adresse: 'Elisenbrunnen 2', status: 'ausstehend', eta_min: 33, kundenwertung: null, betrag: 22.80 },
      ],
    },
  ],
};

export function DispatchPhase4945ScoreTourVisualisierungV12() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/dispatch/score-tour?v=12', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const teamPct = Math.min(100, Math.round((data.team_score / Math.max(data.team_score_ziel, 1)) * 100));

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-indigo-200">Score & Tour V12</span>
          <span className="text-xs text-slate-500">Fahrplan-Übersicht</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-2xl font-bold tabular-nums text-indigo-300">{data.team_score}</span>
          <span className="text-xs text-slate-500">/ {data.team_score_ziel}</span>
        </div>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* Team Score Balken */}
      <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Team-Score Fortschritt</span>
          <span className="text-xs text-slate-400">{teamPct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${teamPct >= 90 ? 'bg-green-500' : teamPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${teamPct}%` }}
          />
        </div>
      </div>

      {/* 4-KPI */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Touren', value: String(data.aktive_touren), color: 'text-blue-400' },
          { label: 'Ø Lief.', value: `${data.avg_lieferzeit_min}m`, color: 'text-slate-300' },
          { label: 'Pünktl', value: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'ETA-Acc', value: `${data.eta_accuracy_pct}%`, color: data.eta_accuracy_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800">
            <div className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Karten */}
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <Route className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Aktive Fahrer & Tour-Stops</span>
        </div>

        {data.drivers.map(driver => {
          const isExp = expanded[driver.id];
          const stoppPct = driver.stopps_gesamt > 0 ? Math.round((driver.stopps_fertig / driver.stopps_gesamt) * 100) : 0;
          const kmPct = driver.km_gesamt > 0 ? Math.round((driver.km_gefahren / driver.km_gesamt) * 100) : 0;

          return (
            <div key={driver.id} className={`rounded-xl border p-3 ${TIER_STYLE[driver.tier]}`}>
              {/* Fahrer Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(p => ({ ...p, [driver.id]: !p[driver.id] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{driver.name}</span>
                  <span className="text-xs capitalize px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">{driver.tier}</span>
                  {driver.touren_heute > 0 && (
                    <span className="text-xs text-slate-500">{driver.touren_heute} Touren</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {driver.score_delta !== 0 && (
                    driver.score_delta > 0
                      ? <TrendingUp className="w-3 h-3 text-green-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-xl font-bold tabular-nums">{driver.score}</span>
                  <span className="text-xs text-slate-600">{isExp ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* KPI Mini-Grid */}
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="text-center">
                  <div className="font-bold text-slate-300">{driver.puenktlichkeit_pct}%</div>
                  <div className="text-slate-600">Pünktl</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-slate-300">{driver.avg_lieferzeit_min}m</div>
                  <div className="text-slate-600">Ø Lief.</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-400">{driver.verdienst_shift.toFixed(0)}€</div>
                  <div className="text-slate-600">Verdienst</div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-10">Stopps</span>
                  <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stoppPct}%` }} />
                  </div>
                  <span className="text-slate-400 tabular-nums">{driver.stopps_fertig}/{driver.stopps_gesamt}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-10">km</span>
                  <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${kmPct}%` }} />
                  </div>
                  <span className="text-slate-400 tabular-nums">{driver.km_gefahren}/{driver.km_gesamt}</span>
                </div>
              </div>

              {driver.eta_naechster_min !== null && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-400">
                  <Navigation className="w-3 h-3" />
                  <span>Nächster Stopp in ~{driver.eta_naechster_min} min</span>
                </div>
              )}

              {/* Stop Timeline (expandiert) */}
              {isExp && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  {driver.stopps.map(stop => (
                    <div key={stop.nr} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 w-4">{stop.nr}.</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STOP_DOT[stop.status]}`} />
                      <span className="flex-1 text-slate-300 truncate">{stop.adresse}</span>
                      <span className="text-green-500 shrink-0">{stop.betrag.toFixed(2)}€</span>
                      {stop.eta_min !== null && <span className="text-slate-500 shrink-0">~{stop.eta_min}m</span>}
                      {stop.kundenwertung !== null && (
                        <span className="text-yellow-400 shrink-0 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" />{stop.kundenwertung}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-600 text-right">20s Polling · Mock-Fallback</div>
    </div>
  );
}
