'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Zap, Navigation, Route, Target, Leaf, Activity } from 'lucide-react';

interface TourStop {
  nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km: number;
  verspaetet_min: number | null;
  kundenwertung: number | null;
}

interface DriverScore {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  stopps_gesamt: number;
  stopps_fertig: number;
  km_gesamt: number;
  km_gefahren: number;
  eta_min: number | null;
  eta_accuracy_pct: number;
  routen_effizienz_pct: number;
  avg_stop_zeit_min: number;
  co2_kg: number;
  stopps: TourStop[];
  expanded: boolean;
}

interface ZonePerf {
  zone: string;
  sla_pct: number;
  touren: number;
  avg_min: number;
}

interface ApiResponse {
  team_score: number;
  team_score_ziel: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  eta_accuracy_pct: number;
  active_tours: number;
  co2_gesamt_kg: number;
  alert: string | null;
  zonen: ZonePerf[];
  drivers: DriverScore[];
}

const TIER_COLORS: Record<string, string> = {
  platin: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/30',
  gold:   'text-yellow-300 border-yellow-500/50 bg-yellow-950/30',
  gut:    'text-green-400 border-green-600/50 bg-green-950/20',
  schwach:'text-slate-400 border-slate-600/50 bg-slate-800/30',
};

const STOP_STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  geliefert:  { dot: 'bg-green-500',  label: 'Geliefert' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse', label: 'Aktiv' },
  ausstehend: { dot: 'bg-slate-500',  label: 'Ausstehend' },
  verspaetet: { dot: 'bg-red-500',    label: 'Verspätet' },
};

const MOCK: ApiResponse = {
  team_score: 88,
  team_score_ziel: 90,
  puenktlichkeit_pct: 81,
  avg_lieferzeit_min: 26,
  eta_accuracy_pct: 85,
  active_tours: 3,
  co2_gesamt_kg: 4.2,
  alert: null,
  zonen: [
    { zone: 'Innenstadt', sla_pct: 88, touren: 12, avg_min: 24 },
    { zone: 'Nord', sla_pct: 76, touren: 8, avg_min: 29 },
    { zone: 'Süd', sla_pct: 92, touren: 6, avg_min: 22 },
  ],
  drivers: [
    {
      id: 'd1', name: 'Jonas M.', score: 94, score_delta: 3, tier: 'platin',
      stopps_gesamt: 5, stopps_fertig: 3, km_gesamt: 18, km_gefahren: 11,
      eta_min: 8, eta_accuracy_pct: 92, routen_effizienz_pct: 96, avg_stop_zeit_min: 3.2,
      co2_kg: 1.1, expanded: false,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 3.2, verspaetet_min: null, kundenwertung: 5 },
        { nr: 2, adresse: 'Kirchweg 5', status: 'geliefert', eta_min: null, km: 4.1, verspaetet_min: null, kundenwertung: 4 },
        { nr: 3, adresse: 'Marktplatz 8', status: 'aktiv', eta_min: 4, km: 3.7, verspaetet_min: null, kundenwertung: null },
        { nr: 4, adresse: 'Gartenstr. 21', status: 'ausstehend', eta_min: 11, km: 3.8, verspaetet_min: null, kundenwertung: null },
        { nr: 5, adresse: 'Bergweg 3', status: 'ausstehend', eta_min: 18, km: 3.2, verspaetet_min: null, kundenwertung: null },
      ],
    },
    {
      id: 'd2', name: 'Sara K.', score: 79, score_delta: -1, tier: 'gut',
      stopps_gesamt: 4, stopps_fertig: 2, km_gesamt: 14, km_gefahren: 7,
      eta_min: 14, eta_accuracy_pct: 78, routen_effizienz_pct: 84, avg_stop_zeit_min: 4.1,
      co2_kg: 1.8, expanded: false,
      stopps: [
        { nr: 1, adresse: 'Schlossallee 4', status: 'geliefert', eta_min: null, km: 3.5, verspaetet_min: 2, kundenwertung: 4 },
        { nr: 2, adresse: 'Ringstr. 17', status: 'geliefert', eta_min: null, km: 3.5, verspaetet_min: null, kundenwertung: 5 },
        { nr: 3, adresse: 'Feldweg 9', status: 'verspaetet', eta_min: 6, km: 3.5, verspaetet_min: 3, kundenwertung: null },
        { nr: 4, adresse: 'Parkstr. 33', status: 'ausstehend', eta_min: 14, km: 3.5, verspaetet_min: null, kundenwertung: null },
      ],
    },
  ],
};

export function DispatchPhase4935ScoreTourVisualisierungV11() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/dispatch/score-tour?v=11', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const teamPct = data.team_score_ziel > 0
    ? Math.min(100, Math.round((data.team_score / data.team_score_ziel) * 100))
    : 0;

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-base text-indigo-200">Score & Tour V11</span>
          <span className="text-xs text-slate-500">Zonen-Matrix</span>
        </div>
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold text-green-300">{data.co2_gesamt_kg.toFixed(1)} kg</span>
          <span className="text-xs text-slate-500">CO₂</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* Team Score + Fortschrittsbalken */}
      <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-3xl font-bold tabular-nums text-indigo-300">{data.team_score}</div>
            <div className="text-xs text-slate-500">Team-Score · Ziel {data.team_score_ziel}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-300">{data.active_tours} Touren</div>
            <div className="text-xs text-slate-500">aktiv</div>
          </div>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${teamPct >= 90 ? 'bg-green-500' : teamPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${teamPct}%` }}
          />
        </div>
        <div className="text-xs text-slate-600 mt-1 text-right">{teamPct}% des Ziels</div>
      </div>

      {/* 4-KPI-Grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Pünktl', value: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Ø Lieferzeit', value: `${data.avg_lieferzeit_min} min`, color: 'text-blue-400' },
          { label: 'ETA-Acc', value: `${data.eta_accuracy_pct}%`, color: data.eta_accuracy_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'CO₂/Tour', value: `${(data.co2_gesamt_kg / Math.max(data.active_tours, 1)).toFixed(1)}kg`, color: 'text-lime-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800">
            <div className={`text-base font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Zonen-Performance */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Activity className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Zonen-SLA</span>
        </div>
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-20 shrink-0">{z.zone}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-10 text-right tabular-nums ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-xs text-slate-600 w-14 text-right">{z.touren}T · {z.avg_min}min</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-1">
          <Route className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Fahrer & Touren</span>
        </div>
        {data.drivers.map(driver => {
          const isExpanded = expanded[driver.id];
          const stoppPct = driver.stopps_gesamt > 0 ? Math.round((driver.stopps_fertig / driver.stopps_gesamt) * 100) : 0;
          const kmPct = driver.km_gesamt > 0 ? Math.round((driver.km_gefahren / driver.km_gesamt) * 100) : 0;

          return (
            <div key={driver.id} className={`rounded-lg border p-3 ${TIER_COLORS[driver.tier]} border-opacity-50`}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(p => ({ ...p, [driver.id]: !p[driver.id] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{driver.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400">{TIER_COLORS[driver.tier] ? driver.tier.charAt(0).toUpperCase() + driver.tier.slice(1) : driver.tier}</span>
                </div>
                <div className="flex items-center gap-2">
                  {driver.score_delta !== 0 && (
                    driver.score_delta > 0
                      ? <TrendingUp className="w-3 h-3 text-green-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-lg font-bold tabular-nums">{driver.score}</span>
                  <span className="text-xs text-slate-500">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-12">Stopps</span>
                  <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stoppPct}%` }} />
                  </div>
                  <span className="text-slate-400 w-12 text-right">{driver.stopps_fertig}/{driver.stopps_gesamt}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-12">km</span>
                  <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${kmPct}%` }} />
                  </div>
                  <span className="text-slate-400 w-12 text-right">{driver.km_gefahren}/{driver.km_gesamt}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>ETA-Acc {driver.eta_accuracy_pct}%</span>
                <span className="text-lime-500">{driver.co2_kg} kg CO₂</span>
                {driver.eta_min && <span>~{driver.eta_min} min</span>}
              </div>

              {/* Expanded stops */}
              {isExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-3">
                  {driver.stopps.map(stop => {
                    const ss = STOP_STATUS_STYLE[stop.status];
                    return (
                      <div key={stop.nr} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 w-4">{stop.nr}.</span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ss.dot}`} />
                        <span className="flex-1 text-slate-300 truncate">{stop.adresse}</span>
                        {stop.verspaetet_min && (
                          <span className="text-red-400 shrink-0">+{stop.verspaetet_min}min</span>
                        )}
                        {stop.eta_min && <span className="text-slate-500 shrink-0">~{stop.eta_min}min</span>}
                        {stop.kundenwertung && (
                          <span className="text-yellow-400 shrink-0">★{stop.kundenwertung}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-600 text-right">Live · 20s Polling</div>
    </div>
  );
}
