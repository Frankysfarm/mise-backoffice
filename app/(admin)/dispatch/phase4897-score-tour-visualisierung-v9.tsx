'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Navigation, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Zap, ChevronDown, ChevronUp, Leaf } from 'lucide-react';

interface TourStop {
  nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km: number;
  verspaetet_min: number | null;
  co2_g: number;
}

interface Driver {
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
  co2_kg: number;
  wellbeing_score: number;
  stopps: TourStop[];
  expanded: boolean;
}

interface ApiResponse {
  team_score: number;
  team_score_ziel: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  eta_accuracy_pct: number;
  co2_gesamt_kg: number;
  alert: string | null;
  drivers: Driver[];
}

const MOCK: ApiResponse = {
  team_score: 84,
  team_score_ziel: 90,
  puenktlichkeit_pct: 77,
  avg_lieferzeit_min: 28,
  eta_accuracy_pct: 81,
  co2_gesamt_kg: 3.2,
  alert: null,
  drivers: [
    {
      id: 'd1', name: 'Marco S.', score: 92, score_delta: 2, tier: 'platin',
      stopps_gesamt: 4, stopps_fertig: 2, km_gesamt: 14.5, km_gefahren: 7.8,
      eta_min: 11, eta_accuracy_pct: 88, co2_kg: 0.9, wellbeing_score: 87, expanded: false,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12, Aachen', status: 'geliefert', eta_min: null, km: 2.1, verspaetet_min: null, co2_g: 220 },
        { nr: 2, adresse: 'Marktplatz 5, Aachen', status: 'geliefert', eta_min: null, km: 1.8, verspaetet_min: null, co2_g: 190 },
        { nr: 3, adresse: 'Bergweg 8, Aachen', status: 'aktiv', eta_min: 6, km: 3.2, verspaetet_min: null, co2_g: 340 },
        { nr: 4, adresse: 'Industriestr. 22, Aachen', status: 'ausstehend', eta_min: 18, km: 4.5, verspaetet_min: null, co2_g: 480 },
      ],
    },
    {
      id: 'd2', name: 'Lena K.', score: 78, score_delta: -1, tier: 'gut',
      stopps_gesamt: 3, stopps_fertig: 1, km_gesamt: 9.2, km_gefahren: 2.9,
      eta_min: 14, eta_accuracy_pct: 74, co2_kg: 0.7, wellbeing_score: 72, expanded: false,
      stopps: [
        { nr: 1, adresse: 'Römerstr. 3, Aachen', status: 'geliefert', eta_min: null, km: 1.5, verspaetet_min: null, co2_g: 160 },
        { nr: 2, adresse: 'Pontstr. 18, Aachen', status: 'aktiv', eta_min: 8, km: 2.8, verspaetet_min: 3, co2_g: 300 },
        { nr: 3, adresse: 'Südstr. 44, Aachen', status: 'ausstehend', eta_min: 20, km: 3.5, verspaetet_min: null, co2_g: 370 },
      ],
    },
    {
      id: 'd3', name: 'Tom B.', score: 65, score_delta: -3, tier: 'schwach',
      stopps_gesamt: 2, stopps_fertig: 0, km_gesamt: 7.1, km_gefahren: 0.4,
      eta_min: 22, eta_accuracy_pct: 62, co2_kg: 0.5, wellbeing_score: 58, expanded: false,
      stopps: [
        { nr: 1, adresse: 'Weststr. 9, Aachen', status: 'verspaetet', eta_min: 12, km: 3.2, verspaetet_min: 7, co2_g: 340 },
        { nr: 2, adresse: 'Nordstr. 71, Aachen', status: 'ausstehend', eta_min: 25, km: 3.9, verspaetet_min: null, co2_g: 410 },
      ],
    },
  ],
};

function tierColor(t: Driver['tier']) {
  if (t === 'platin') return 'text-cyan-300 border-cyan-500/40 bg-cyan-950/20';
  if (t === 'gold') return 'text-yellow-300 border-yellow-500/40 bg-yellow-950/20';
  if (t === 'gut') return 'text-green-300 border-green-600/40 bg-green-950/20';
  return 'text-slate-400 border-slate-600/40 bg-slate-800/20';
}

function stopIcon(s: TourStop['status']) {
  if (s === 'geliefert') return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  if (s === 'verspaetet') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (s === 'aktiv') return <Navigation className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
  return <MapPin className="w-3.5 h-3.5 text-slate-500" />;
}

function stopLine(s: TourStop['status']) {
  if (s === 'geliefert') return 'text-green-400/70';
  if (s === 'verspaetet') return 'text-red-400/70';
  if (s === 'aktiv') return 'text-blue-300';
  return 'text-slate-500';
}

export function DispatchPhase4897ScoreTourVisualisierungV9({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/dispatch/scores?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json();
          if (json?.drivers) setData(json as ApiResponse);
        }
      } catch { /* Mock-Fallback */ }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const scoreProgress = Math.min(100, (data.team_score / data.team_score_ziel) * 100);
  const scoreColor = data.team_score >= 85 ? 'text-green-400' : data.team_score >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Score + Tour-Visualisierung V9</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Leaf className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-400">{data.co2_gesamt_kg.toFixed(1)} kg CO₂</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded bg-red-900/30 border border-red-700/40 px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Team-Score Arc + Progress */}
      <div className="rounded-lg bg-slate-900/40 border border-slate-700/30 p-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-400">Team-Score</span>
          <span className={`text-lg font-bold ${scoreColor}`}>{data.team_score}</span>
          <span className="text-[10px] text-slate-500">Ziel: {data.team_score_ziel}</span>
        </div>
        <div className="w-full h-2 rounded bg-slate-700/50">
          <div
            className={`h-2 rounded transition-all ${data.team_score >= 85 ? 'bg-green-500' : data.team_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${scoreProgress}%` }}
          />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'Pünktlichkeit', val: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 80 ? 'text-green-400' : data.puenktlichkeit_pct >= 65 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Ø Lieferzeit', val: `${data.avg_lieferzeit_min} min`, color: data.avg_lieferzeit_min <= 30 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'ETA-Acc.', val: `${data.eta_accuracy_pct}%`, color: data.eta_accuracy_pct >= 80 ? 'text-green-400' : 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="rounded bg-slate-900/40 border border-slate-700/30 p-1.5 text-center">
            <div className={`text-sm font-bold ${k.color}`}>{k.val}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Driver Cards */}
      <div className="space-y-1.5">
        {data.drivers.map(d => {
          const isExpanded = expanded[d.id] ?? false;
          const stoppPct = d.stopps_gesamt > 0 ? (d.stopps_fertig / d.stopps_gesamt) * 100 : 0;
          const kmPct = d.km_gesamt > 0 ? (d.km_gefahren / d.km_gesamt) * 100 : 0;
          return (
            <div key={d.id} className={`rounded-lg border p-2 ${tierColor(d.tier)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">{d.name}</span>
                  <span className={`text-[9px] px-1 rounded border ${tierColor(d.tier)}`}>{d.tier.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-indigo-300">{d.score}</span>
                  <span className={`text-[9px] ${d.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.score_delta >= 0 ? '+' : ''}{d.score_delta}
                  </span>
                  {d.score_delta >= 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                  <button onClick={() => setExpanded(prev => ({ ...prev, [d.id]: !isExpanded }))} className="text-slate-500 hover:text-slate-300">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Progress bars */}
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Stopps {d.stopps_fertig}/{d.stopps_gesamt}</span>
                  <span>{d.km_gefahren.toFixed(1)}/{d.km_gesamt.toFixed(1)} km</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="h-1 rounded bg-slate-700/50"><div className="h-1 rounded bg-blue-500" style={{ width: `${stoppPct}%` }} /></div>
                  <div className="h-1 rounded bg-slate-700/50"><div className="h-1 rounded bg-indigo-500" style={{ width: `${kmPct}%` }} /></div>
                </div>
              </div>

              {/* Meta */}
              <div className="flex gap-3 mt-1">
                {d.eta_min && <span className="text-[9px] text-slate-500"><Clock className="w-2.5 h-2.5 inline mr-0.5" />ETA {d.eta_min} min</span>}
                <span className="text-[9px] text-green-500"><Leaf className="w-2.5 h-2.5 inline mr-0.5" />{d.co2_kg.toFixed(2)} kg</span>
                <span className="text-[9px] text-slate-500">Wellbeing {d.wellbeing_score}</span>
              </div>

              {/* Stopp-Timeline (expanded) */}
              {isExpanded && (
                <div className="mt-2 space-y-0.5 border-t border-slate-700/30 pt-1.5">
                  {d.stopps.map(st => (
                    <div key={st.nr} className="flex items-center gap-1.5">
                      {stopIcon(st.status)}
                      <span className={`text-[9px] flex-1 truncate ${stopLine(st.status)}`}>{st.nr}. {st.adresse}</span>
                      {st.eta_min && <span className="text-[9px] text-slate-500">{st.eta_min} min</span>}
                      {st.verspaetet_min && (
                        <span className="text-[9px] text-red-400">+{st.verspaetet_min} min</span>
                      )}
                      <span className="text-[9px] text-green-600">{st.co2_g}g</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
