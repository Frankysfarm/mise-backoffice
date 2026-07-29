'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Navigation2, Gauge } from 'lucide-react';

interface StoppStatus {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'batch' | 'verspaetet';
  eta_min: number | null;
  km: number | null;
  lieferzeit_min: number | null;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  score_ring: 'platin' | 'gold' | 'gut' | 'schwach';
  stopps: StoppStatus[];
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  sla_pct: number;
  verspaesung_alert: boolean;
}

interface ZoneKpi {
  zone: string;
  aktive_touren: number;
  avg_eta_min: number;
  sla_ok: boolean;
}

interface ApiResponse {
  fahrer: FahrerTour[];
  team_score: number;
  team_score_delta: number;
  team_ziel: number;
  kpi: {
    aktive_touren: number;
    gelieferte_stopps: number;
    avg_tour_score: number;
    verspaetet_count: number;
    sla_pct: number;
  };
  zonen: ZoneKpi[];
  alert: string | null;
}

const MOCK: ApiResponse = {
  fahrer: [
    {
      fahrer_id: '1', fahrer_name: 'Max M.', score: 93, score_delta: 4, score_ring: 'platin',
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 1.2, lieferzeit_min: 13 },
        { stopp_nr: 2, adresse: 'Marktpl. 5', status: 'aktiv', eta_min: 3, km: 0.8, lieferzeit_min: null },
        { stopp_nr: 3, adresse: 'Bahnhofstr. 8', status: 'ausstehend', eta_min: 14, km: 1.5, lieferzeit_min: null },
      ],
      puenktlichkeit_pct: 96, avg_lieferzeit_min: 13, sla_pct: 97, verspaesung_alert: false,
    },
    {
      fahrer_id: '2', fahrer_name: 'Sara K.', score: 72, score_delta: -1, score_ring: 'gut',
      stopps: [
        { stopp_nr: 1, adresse: 'Lindenweg 3', status: 'geliefert', eta_min: null, km: 2.1, lieferzeit_min: 23 },
        { stopp_nr: 2, adresse: 'Ringstr. 17', status: 'verspaetet', eta_min: 9, km: 1.3, lieferzeit_min: null },
      ],
      puenktlichkeit_pct: 67, avg_lieferzeit_min: 23, sla_pct: 69, verspaesung_alert: true,
    },
  ],
  team_score: 82,
  team_score_delta: 2,
  team_ziel: 85,
  kpi: { aktive_touren: 2, gelieferte_stopps: 3, avg_tour_score: 82, verspaetet_count: 1, sla_pct: 83 },
  zonen: [
    { zone: 'Innenstadt', aktive_touren: 3, avg_eta_min: 22, sla_ok: true },
    { zone: 'West', aktive_touren: 2, avg_eta_min: 31, sla_ok: true },
    { zone: 'Nord', aktive_touren: 1, avg_eta_min: 41, sla_ok: false },
  ],
  alert: '1 Fahrer mit Verspätung · Zone Nord über SLA',
};

function RingColor(ring: string) {
  if (ring === 'platin') return 'border-cyan-400 text-cyan-300';
  if (ring === 'gold') return 'border-yellow-400 text-yellow-300';
  if (ring === 'gut') return 'border-green-500 text-green-300';
  return 'border-red-500 text-red-300';
}

function StoppIcon({ status }: { status: StoppStatus['status'] }) {
  if (status === 'geliefert') return <span className="text-green-400">✓</span>;
  if (status === 'aktiv') return <span className="text-blue-400 animate-pulse">●</span>;
  if (status === 'verspaetet') return <span className="text-red-400">!</span>;
  if (status === 'batch') return <span className="text-indigo-400">⊕</span>;
  return <span className="text-gray-500">○</span>;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase4831ScoreTourVisualisierungV4({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const url = locationId
      ? `/api/delivery/dispatch/tour-score-visualisierung?location_id=${locationId}`
      : '/api/delivery/dispatch/tour-score-visualisierung';
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const progressPct = Math.min(100, (data.team_score / data.team_ziel) * 100);
  const teamColor = data.team_score >= data.team_ziel ? 'text-green-400' : data.team_score >= 75 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">Score + Tour-Visualisierung V4</span>
        <span className="ml-auto text-xs text-gray-500">20-Sek</span>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* Team Score */}
      <div className="bg-black/20 rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400">Team-Score</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-3xl font-bold ${teamColor}`}>{data.team_score}</span>
              <DeltaIcon delta={data.team_score_delta} />
              <span className="text-xs text-gray-500">Ziel: {data.team_ziel}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">SLA</div>
            <div className={`text-xl font-bold ${data.kpi.sla_pct >= 85 ? 'text-green-400' : data.kpi.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.kpi.sla_pct}%
            </div>
          </div>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${data.team_score >= data.team_ziel ? 'bg-green-500' : data.team_score >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Touren</div>
          <div className="text-base font-bold text-blue-400">{data.kpi.aktive_touren}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Geliefert</div>
          <div className="text-base font-bold text-green-400">{data.kpi.gelieferte_stopps}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Verspätet</div>
          <div className={`text-base font-bold ${data.kpi.verspaetet_count > 0 ? 'text-red-400' : 'text-slate-500'}`}>{data.kpi.verspaetet_count}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Ø Score</div>
          <div className="text-base font-bold text-slate-300">{data.kpi.avg_tour_score}</div>
        </div>
      </div>

      {/* Zone Overview */}
      <div className="mb-3 space-y-1.5">
        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
          <Gauge className="w-3 h-3" /> Zonen-SLA
        </div>
        {data.zonen.map(z => (
          <div key={z.zone} className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${z.sla_ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-slate-400 w-24 truncate">{z.zone}</span>
            <span className="text-gray-500">{z.aktive_touren} Tour(en)</span>
            <span className={`ml-auto ${z.avg_eta_min <= 35 ? 'text-green-400' : z.avg_eta_min <= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
              Ø {z.avg_eta_min}min
            </span>
          </div>
        ))}
      </div>

      {/* Fahrer Cards */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const isExpanded = expanded[f.fahrer_id] ?? false;
          const rc = RingColor(f.score_ring);
          return (
            <div key={f.fahrer_id} className="rounded-lg border border-slate-700 bg-slate-900/20 overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                onClick={() => setExpanded(e => ({ ...e, [f.fahrer_id]: !isExpanded }))}
              >
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${rc}`}>
                  <span className="text-sm font-bold">{f.score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-300 truncate">{f.fahrer_name}</span>
                    <DeltaIcon delta={f.score_delta} />
                    {f.verspaesung_alert && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.avg_lieferzeit_min}min</span>
                    <span className="flex items-center gap-1"><Navigation2 className="w-3 h-3" />{f.puenktlichkeit_pct}%</span>
                    <span className={`flex items-center gap-1 ${f.sla_pct >= 85 ? 'text-green-400' : f.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                      SLA {f.sla_pct}%
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-slate-800">
                  <div className="mt-2 space-y-1.5">
                    {f.stopps.map(s => (
                      <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-center shrink-0"><StoppIcon status={s.status} /></span>
                        <span className={`flex-1 truncate ${s.status === 'geliefert' ? 'text-gray-500 line-through' : s.status === 'verspaetet' ? 'text-red-300' : s.status === 'aktiv' ? 'text-blue-300 font-medium' : 'text-gray-400'}`}>
                          {s.stopp_nr}. {s.adresse}
                        </span>
                        {s.eta_min !== null && (
                          <span className="text-gray-500 shrink-0 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{s.eta_min}min
                          </span>
                        )}
                        {s.km !== null && (
                          <span className="text-gray-600 shrink-0 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{s.km}km
                          </span>
                        )}
                        {s.lieferzeit_min !== null && (
                          <span className="text-green-500 shrink-0">{s.lieferzeit_min}min</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
