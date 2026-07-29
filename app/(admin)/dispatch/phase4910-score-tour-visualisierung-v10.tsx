'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Zap, ChevronDown, ChevronUp, Navigation, Route, BarChart2, Target } from 'lucide-react';

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
  stopps: TourStop[];
  expanded: boolean;
}

interface KpiTrend {
  label: string;
  wert: number;
  ziel: number;
  einheit: string;
  trend: 'up' | 'down' | 'flat';
}

interface ApiResponse {
  team_score: number;
  team_score_ziel: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  eta_accuracy_pct: number;
  active_tours: number;
  alert: string | null;
  kpi_trends: KpiTrend[];
  drivers: DriverScore[];
}

const TIER_COLORS: Record<string, string> = {
  platin: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/30',
  gold:   'text-yellow-300 border-yellow-500/50 bg-yellow-950/30',
  gut:    'text-green-400 border-green-600/50 bg-green-950/20',
  schwach:'text-slate-400 border-slate-600/50 bg-slate-800/30',
};

const TIER_LABELS: Record<string, string> = {
  platin: 'Platin', gold: 'Gold', gut: 'Gut', schwach: 'Schwach',
};

const STOP_STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  geliefert:  { dot: 'bg-green-500',  label: 'Geliefert' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse', label: 'Aktiv' },
  ausstehend: { dot: 'bg-slate-500',  label: 'Ausstehend' },
  verspaetet: { dot: 'bg-red-500',    label: 'Verspätet' },
};

const MOCK: ApiResponse = {
  team_score: 86,
  team_score_ziel: 90,
  puenktlichkeit_pct: 79,
  avg_lieferzeit_min: 27,
  eta_accuracy_pct: 83,
  active_tours: 3,
  alert: null,
  kpi_trends: [
    { label: 'Pünktlichkeit', wert: 79, ziel: 85, einheit: '%', trend: 'up' },
    { label: 'Ø Lieferzeit', wert: 27, ziel: 25, einheit: 'min', trend: 'down' },
    { label: 'ETA-Accuracy', wert: 83, ziel: 90, einheit: '%', trend: 'up' },
    { label: 'Routen-Eff.', wert: 88, ziel: 90, einheit: '%', trend: 'flat' },
  ],
  drivers: [
    {
      id: 'd1', name: 'Lukas M.', score: 94, score_delta: +2,
      tier: 'platin', stopps_gesamt: 4, stopps_fertig: 3,
      km_gesamt: 18.4, km_gefahren: 14.2,
      eta_min: 6, eta_accuracy_pct: 92, routen_effizienz_pct: 91, avg_stop_zeit_min: 3.2,
      expanded: false,
      stopps: [
        { nr: 1, adresse: 'Musterstr. 12', status: 'geliefert', eta_min: null, km: 4.1, verspaetet_min: null, kundenwertung: 5 },
        { nr: 2, adresse: 'Hauptplatz 3',  status: 'geliefert', eta_min: null, km: 3.8, verspaetet_min: null, kundenwertung: 4 },
        { nr: 3, adresse: 'Bahnhofstr. 7', status: 'aktiv',     eta_min: 6,   km: 5.2, verspaetet_min: null, kundenwertung: null },
        { nr: 4, adresse: 'Rosenweg 15',   status: 'ausstehend',eta_min: 14,  km: 5.3, verspaetet_min: null, kundenwertung: null },
      ],
    },
    {
      id: 'd2', name: 'Sven K.', score: 77, score_delta: -1,
      tier: 'gut', stopps_gesamt: 3, stopps_fertig: 1,
      km_gesamt: 14.7, km_gefahren: 5.3,
      eta_min: 12, eta_accuracy_pct: 74, routen_effizienz_pct: 82, avg_stop_zeit_min: 4.8,
      expanded: false,
      stopps: [
        { nr: 1, adresse: 'Lindenallee 4', status: 'geliefert', eta_min: null, km: 5.3, verspaetet_min: null, kundenwertung: 4 },
        { nr: 2, adresse: 'Gartenstr. 22', status: 'verspaetet', eta_min: 12, km: 4.9, verspaetet_min: 4, kundenwertung: null },
        { nr: 3, adresse: 'Parkweg 8',     status: 'ausstehend', eta_min: 21, km: 4.5, verspaetet_min: null, kundenwertung: null },
      ],
    },
    {
      id: 'd3', name: 'Jan R.', score: 88, score_delta: 0,
      tier: 'gold', stopps_gesamt: 5, stopps_fertig: 4,
      km_gesamt: 21.3, km_gefahren: 18.9,
      eta_min: 4, eta_accuracy_pct: 88, routen_effizienz_pct: 94, avg_stop_zeit_min: 2.9,
      expanded: false,
      stopps: [
        { nr: 1, adresse: 'Kirchplatz 1',   status: 'geliefert', eta_min: null, km: 3.5, verspaetet_min: null, kundenwertung: 5 },
        { nr: 2, adresse: 'Bergstr. 30',    status: 'geliefert', eta_min: null, km: 4.2, verspaetet_min: null, kundenwertung: 5 },
        { nr: 3, adresse: 'Am Markt 5',     status: 'geliefert', eta_min: null, km: 5.1, verspaetet_min: null, kundenwertung: 4 },
        { nr: 4, adresse: 'Feldweg 2',      status: 'geliefert', eta_min: null, km: 3.8, verspaetet_min: null, kundenwertung: 5 },
        { nr: 5, adresse: 'Seestr. 19',     status: 'aktiv',     eta_min: 4,   km: 4.7, verspaetet_min: null, kundenwertung: null },
      ],
    },
  ],
};

export function DispatchPhase4910ScoreTourVisualisierungV10({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock fallback */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  const teamPct = Math.round((data.team_score / data.team_score_ziel) * 100);

  function toggleDriver(id: string) {
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function scoreRingColor(score: number) {
    if (score >= 90) return '#22d3ee';
    if (score >= 80) return '#facc15';
    if (score >= 65) return '#4ade80';
    return '#94a3b8';
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-indigo-950/30">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">Score + Tour-Visualisierung V10</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">
            {data.active_tours} Touren aktiv
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Ziel: {data.team_score_ziel}</span>
          <span className={`text-xl font-extrabold ml-2 ${data.team_score >= data.team_score_ziel ? 'text-green-400' : data.team_score >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.team_score}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-700/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Team-Score Fortschrittsbalken */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Team-Score Fortschritt</span>
          <span className="text-[10px] text-slate-500">{teamPct}% von Ziel</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${teamPct >= 100 ? 'bg-green-500' : teamPct >= 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, teamPct)}%` }}
          />
        </div>
      </div>

      {/* KPI-Trend-Grid */}
      <div className="grid grid-cols-4 divide-x divide-slate-700/70 border-b border-slate-700">
        {data.kpi_trends.map(k => (
          <div key={k.label} className="flex flex-col items-center py-2.5 gap-0.5 px-1">
            <div className="flex items-center gap-1">
              {k.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-400" /> : k.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400" /> : <BarChart2 className="w-3 h-3 text-slate-400" />}
              <span className={`text-sm font-bold ${k.wert >= k.ziel ? 'text-green-400' : 'text-yellow-400'}`}>
                {k.wert}{k.einheit}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 text-center">{k.label}</span>
            <span className="text-[10px] text-slate-600">Ziel: {k.ziel}{k.einheit}</span>
          </div>
        ))}
      </div>

      {/* Fahrer Score Karten */}
      <div className="divide-y divide-slate-800/60">
        {data.drivers.map(d => {
          const isExpanded = expanded.has(d.id);
          const ringColor = scoreRingColor(d.score);
          const stopsPct = d.stopps_gesamt > 0 ? Math.round((d.stopps_fertig / d.stopps_gesamt) * 100) : 0;
          const kmPct = d.km_gesamt > 0 ? Math.round((d.km_gefahren / d.km_gesamt) * 100) : 0;
          return (
            <div key={d.id}>
              <button
                onClick={() => toggleDriver(d.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-800/30 transition-colors"
              >
                {/* Score-Ring */}
                <div className="relative shrink-0 w-12 h-12">
                  <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#1e293b" strokeWidth="4" />
                    <circle
                      cx="20" cy="20" r="16" fill="none"
                      stroke={ringColor}
                      strokeWidth="4"
                      strokeDasharray={`${(d.score / 100) * 100.5} 100.5`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: ringColor }}>
                    {d.score}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{d.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${TIER_COLORS[d.tier]}`}>
                      {TIER_LABELS[d.tier]}
                    </span>
                    {d.score_delta !== 0 && (
                      <span className={`text-[10px] ${d.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {d.score_delta > 0 ? '+' : ''}{d.score_delta}
                      </span>
                    )}
                  </div>
                  {/* Dual-Progress */}
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${stopsPct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums">{d.stopps_fertig}/{d.stopps_gesamt}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Route className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${kmPct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums">{d.km_gefahren.toFixed(1)}/{d.km_gesamt.toFixed(1)} km</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {d.eta_min !== null && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-white font-medium">{d.eta_min} min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] text-slate-400">{d.routen_effizienz_pct}%</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

              {/* Stopp-Timeline */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {/* Sub-KPIs */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'ETA-Acc.', val: `${d.eta_accuracy_pct}%` },
                      { label: 'Routen-Eff.', val: `${d.routen_effizienz_pct}%` },
                      { label: 'Ø Stopp-Zeit', val: `${d.avg_stop_zeit_min} min` },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-xs font-semibold text-white">{kpi.val}</div>
                        <div className="text-[10px] text-slate-500">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                  {d.stopps.map((s, idx) => {
                    const style = STOP_STATUS_STYLE[s.status];
                    return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center mt-1 shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                          {idx < d.stopps.length - 1 && <div className="w-px flex-1 bg-slate-700 min-h-[10px] mt-0.5" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] text-slate-500 tabular-nums">{s.nr}.</span>
                              <span className="text-xs text-white truncate">{s.adresse}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {s.kundenwertung !== null && (
                                <span className="text-[10px] text-yellow-400">{'★'.repeat(s.kundenwertung)}</span>
                              )}
                              {s.verspaetet_min !== null && (
                                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5" />+{s.verspaetet_min}min
                                </span>
                              )}
                              {s.eta_min !== null && s.status !== 'geliefert' && (
                                <span className="text-[10px] text-blue-300">{s.eta_min}min</span>
                              )}
                              <span className="text-[10px] text-slate-500">{s.km.toFixed(1)}km</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{style.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>20-Sek-Polling · KPI-Trend · Kundenwertung je Stopp · Mock-Fallback</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
