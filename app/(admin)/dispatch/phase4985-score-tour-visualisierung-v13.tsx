'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, AlertTriangle, Navigation, Route, Target, Activity, Star, Zap, CheckCircle2, Package, Euro, RefreshCw } from 'lucide-react';

interface TourStop {
  nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  kundenwertung: number | null;
  betrag: number;
  distanz_km: number;
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
  co2_kg: number;
  stopps: TourStop[];
  expanded?: boolean;
}

interface ApiResponse {
  team_score: number;
  team_score_ziel: number;
  alert: string | null;
  aktive_touren: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  eta_accuracy_pct: number;
  schicht_umsatz: number;
  co2_gesamt_kg: number;
  drivers: DriverCard[];
}

const TIER_STYLE: Record<string, { card: string; badge: string; label: string }> = {
  platin:  { card: 'border-cyan-500/50 bg-cyan-950/20',    badge: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',    label: '🏆 Platin' },
  gold:    { card: 'border-yellow-500/50 bg-yellow-950/20', badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', label: '🥇 Gold' },
  gut:     { card: 'border-green-600/40 bg-green-950/20',  badge: 'bg-green-900/40 text-green-400 border-green-700',  label: '✅ Gut' },
  schwach: { card: 'border-slate-600/40 bg-slate-800/30',  badge: 'bg-slate-700/40 text-slate-400 border-slate-600', label: '⚠ Schwach' },
};

const STOP_STATUS: Record<string, { dot: string; text: string }> = {
  geliefert:  { dot: 'bg-green-500',   text: 'text-green-400' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse', text: 'text-blue-400' },
  ausstehend: { dot: 'bg-slate-500',   text: 'text-slate-400' },
  verspaetet: { dot: 'bg-red-500',     text: 'text-red-400' },
};

const MOCK: ApiResponse = {
  team_score: 82,
  team_score_ziel: 85,
  alert: null,
  aktive_touren: 4,
  avg_lieferzeit_min: 24,
  puenktlichkeit_pct: 83,
  eta_accuracy_pct: 79,
  schicht_umsatz: 2480,
  co2_gesamt_kg: 3.2,
  drivers: [
    {
      id: 'd1', name: 'Jonas M.', score: 94, score_delta: 3, tier: 'platin',
      stopps_gesamt: 8, stopps_fertig: 5, km_gesamt: 18, km_gefahren: 11,
      eta_naechster_min: 4, puenktlichkeit_pct: 92, eta_accuracy_pct: 88,
      avg_lieferzeit_min: 21, verdienst_shift: 87, touren_heute: 3, co2_kg: 0.7,
      stopps: [
        { nr: 1, adresse: 'Jülicher Str. 12', status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 18.50, distanz_km: 2.1 },
        { nr: 2, adresse: 'Adalbertsteinweg 44', status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 22.00, distanz_km: 1.8 },
        { nr: 3, adresse: 'Elisengarten 3', status: 'aktiv', eta_min: 4, kundenwertung: null, betrag: 15.50, distanz_km: 1.2 },
        { nr: 4, adresse: 'Pontstraße 58', status: 'ausstehend', eta_min: 12, kundenwertung: null, betrag: 31.00, distanz_km: 2.4 },
      ],
    },
    {
      id: 'd2', name: 'Sara K.', score: 78, score_delta: -2, tier: 'gut',
      stopps_gesamt: 6, stopps_fertig: 3, km_gesamt: 14, km_gefahren: 7,
      eta_naechster_min: 7, puenktlichkeit_pct: 78, eta_accuracy_pct: 74,
      avg_lieferzeit_min: 26, verdienst_shift: 62, touren_heute: 2, co2_kg: 0.9,
      stopps: [
        { nr: 1, adresse: 'Theaterstr. 10',  status: 'geliefert', eta_min: null, kundenwertung: 4, betrag: 12.00, distanz_km: 1.5 },
        { nr: 2, adresse: 'Wilhelmstr. 22',  status: 'geliefert', eta_min: null, kundenwertung: 5, betrag: 19.50, distanz_km: 2.0 },
        { nr: 3, adresse: 'Templergraben 7', status: 'verspaetet', eta_min: 7, kundenwertung: null, betrag: 24.00, distanz_km: 3.1 },
      ],
    },
    {
      id: 'd3', name: 'Max R.', score: 65, score_delta: 1, tier: 'gut',
      stopps_gesamt: 5, stopps_fertig: 2, km_gesamt: 11, km_gefahren: 5,
      eta_naechster_min: 9, puenktlichkeit_pct: 68, eta_accuracy_pct: 72,
      avg_lieferzeit_min: 29, verdienst_shift: 48, touren_heute: 2, co2_kg: 0.8,
      stopps: [
        { nr: 1, adresse: 'Alexanderstr. 30', status: 'geliefert', eta_min: null, kundenwertung: 4, betrag: 16.00, distanz_km: 1.9 },
        { nr: 2, adresse: 'Boxgraben 12', status: 'aktiv', eta_min: 9, kundenwertung: null, betrag: 21.00, distanz_km: 2.3 },
      ],
    },
  ],
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase4985ScoreTourVisualisierungV13({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/dispatch/score-tour-v13?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [locationId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const teamScorePct = Math.min(100, (data.team_score / data.team_score_ziel) * 100);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">Score & Tour V13</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
          <span className="text-xs text-slate-500">{data.aktive_touren} aktive Touren</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/40 border border-red-600/50">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Team Score */}
      <div className="bg-slate-800/60 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Team-Score</span>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-indigo-300">{data.team_score}</span>
            <span className="text-xs text-slate-500">/ {data.team_score_ziel}</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${teamScorePct >= 95 ? 'bg-green-500' : teamScorePct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${teamScorePct}%` }}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Clock size={12} />,       label: 'Ø Lieferzeit', val: `${data.avg_lieferzeit_min} Min`,      color: 'text-blue-300' },
          { icon: <Target size={12} />,       label: 'Pünktl.',      val: `${data.puenktlichkeit_pct}%`,         color: 'text-green-300' },
          { icon: <Activity size={12} />,     label: 'ETA-Acc.',     val: `${data.eta_accuracy_pct}%`,           color: 'text-indigo-300' },
          { icon: <Euro size={12} />,         label: 'Umsatz',       val: `€${data.schicht_umsatz}`,             color: 'text-yellow-300' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className={`flex items-center justify-center ${kpi.color} mb-1`}>{kpi.icon}</div>
            <div className={`text-xs font-bold ${kpi.color}`}>{kpi.val}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* CO2 Banner */}
      <div className="flex items-center gap-2 bg-lime-900/20 border border-lime-700/30 rounded-lg px-3 py-2">
        <span className="text-xs">🌱</span>
        <span className="text-xs text-lime-300 font-medium">CO₂ heute: {data.co2_gesamt_kg} kg</span>
        <span className="ml-auto text-[10px] text-lime-600">Schicht gesamt</span>
      </div>

      {/* Driver Cards */}
      <div className="space-y-3">
        {data.drivers.map(d => {
          const ts = TIER_STYLE[d.tier];
          const isExpanded = expanded.has(d.id);
          const progressPct = d.stopps_gesamt > 0 ? (d.stopps_fertig / d.stopps_gesamt) * 100 : 0;

          return (
            <div key={d.id} className={`rounded-xl border p-3 ${ts.card}`}>
              {/* Driver Header */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => toggleExpand(d.id)}
              >
                <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-200">
                  {d.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{d.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ts.badge}`}>{ts.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-bold text-indigo-300">{d.score}</span>
                    {d.score_delta !== 0 && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${d.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {d.score_delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {d.score_delta > 0 ? '+' : ''}{d.score_delta}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-300">€{d.verdienst_shift}</div>
                  {d.eta_naechster_min !== null && (
                    <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                      <Navigation size={10} /> {d.eta_naechster_min} Min
                    </div>
                  )}
                </div>
              </div>

              {/* Stop Progress Bar */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">Stopps {d.stopps_fertig}/{d.stopps_gesamt}</span>
                  <span className="text-[10px] text-slate-500">{d.km_gefahren}/{d.km_gesamt} km</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: d.stopps_gesamt }).map((_, i) => {
                    const stop = d.stopps[i];
                    const status = stop?.status ?? 'ausstehend';
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-sm ${
                          status === 'geliefert' ? 'bg-green-500' :
                          status === 'aktiv' ? 'bg-blue-500' :
                          status === 'verspaetet' ? 'bg-red-500' : 'bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* KPIs Row */}
              <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                <span>📍 {d.puenktlichkeit_pct}% pünktl.</span>
                <span>⏱ {d.avg_lieferzeit_min} Min Ø</span>
                <span>🌱 {d.co2_kg} kg CO₂</span>
              </div>

              {/* Expanded: Stop List */}
              {isExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-3">
                  {d.stopps.map(s => {
                    const ss = STOP_STATUS[s.status];
                    return (
                      <div key={s.nr} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ss.dot}`} />
                        <span className="text-[10px] text-slate-400 w-4 shrink-0">{s.nr}.</span>
                        <span className={`text-xs flex-1 truncate ${ss.text}`}>{s.adresse}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
                          <span>€{s.betrag.toFixed(2)}</span>
                          {s.eta_min !== null && <span>{s.eta_min} Min</span>}
                          {s.kundenwertung !== null && <span>{'★'.repeat(s.kundenwertung)}</span>}
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
    </div>
  );
}
